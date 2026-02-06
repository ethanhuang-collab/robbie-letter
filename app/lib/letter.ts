export type RecipientRecord = Record<string, string>;

export type Placeholder = {
  raw: string;
  key: string;
  defaultValue?: string;
};

const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

export type AutoPersonalizeOptions = {
  enableGreeting: boolean;
  greetingStyle: "Hi" | "Hello" | "Dear";
  enableClosing: boolean;
  closingStyle: "Love" | "Sincerely" | "Best";
  fromName?: string;
};

export function extractPlaceholders(template: string): Placeholder[] {
  const seen = new Set<string>();
  const placeholders: Placeholder[] = [];

  for (const match of template.matchAll(PLACEHOLDER_RE)) {
    const rawInner = (match[1] ?? "").trim();
    if (!rawInner) continue;

    // Support: {{ key | default value }}
    const [keyPart, ...defaultParts] = rawInner.split("|");
    const key = (keyPart ?? "").trim();
    const defaultValue = defaultParts.length
      ? defaultParts.join("|").trim()
      : undefined;

    if (!key) continue;

    const signature = `${key}|||${defaultValue ?? ""}`;
    if (seen.has(signature)) continue;
    seen.add(signature);

    placeholders.push({ raw: match[0], key, defaultValue });
  }

  return placeholders;
}

function getPathValue(record: RecipientRecord, path: string): string | undefined {
  // allow simple keys as well as dot paths: "person.firstName"
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;

  let cur: unknown = record;
  for (const part of parts) {
    if (cur && typeof cur === "object" && part in (cur as any)) {
      cur = (cur as any)[part];
    } else {
      return undefined;
    }
  }
  if (cur === null || cur === undefined) return undefined;
  return String(cur);
}

export function getRecipientDisplayName(record: RecipientRecord): string {
  const name =
    record.name ||
    [record.firstName, record.lastName].filter(Boolean).join(" ").trim() ||
    record.firstName ||
    record.email ||
    "";
  return name.trim();
}

function normalizeNewlines(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function ensureTrailingNewline(s: string): string {
  return s.endsWith("\n") ? s : `${s}\n`;
}

function replaceGreetingLine(
  text: string,
  greetingLine: string
): { text: string; changed: boolean } {
  const normalized = normalizeNewlines(text);
  const lines = normalized.split("\n");
  const firstNonEmptyIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyIdx === -1) return { text: greetingLine, changed: true };

  const line = lines[firstNonEmptyIdx]!;
  // Replace common greetings if present, otherwise "no change"
  if (/^\s*(dear|hi|hello)\b/i.test(line)) {
    lines[firstNonEmptyIdx] = greetingLine;
    return { text: lines.join("\n"), changed: true };
  }
  return { text: normalized, changed: false };
}

function addGreeting(text: string, greetingLine: string): string {
  const normalized = normalizeNewlines(text).trimStart();
  return `${greetingLine}\n\n${normalized}`;
}

function replaceClosingBlock(
  text: string,
  closingLine: string,
  fromName: string
): { text: string; changed: boolean } {
  const normalized = normalizeNewlines(text);
  const lines = normalized.split("\n");

  // Find last non-empty line
  let i = lines.length - 1;
  while (i >= 0 && lines[i]!.trim().length === 0) i--;
  if (i < 0) return { text: `${closingLine},\n${fromName}\n`, changed: true };

  // If last line is a name, and the line above is a closing word, replace them
  const lastLine = lines[i]!;
  const prevLine = i - 1 >= 0 ? lines[i - 1]! : "";

  if (/^\s*(love|sincerely|best|yours truly|warmly)\s*,?\s*$/i.test(prevLine)) {
    lines[i - 1] = `${closingLine},`;
    lines[i] = fromName;
    return { text: lines.join("\n"), changed: true };
  }

  if (/^\s*(love|sincerely|best|yours truly|warmly)\s*,?\s*$/i.test(lastLine)) {
    // Closing line exists but no name after it — append name
    lines[i] = `${closingLine},`;
    lines.splice(i + 1, 0, fromName);
    return { text: lines.join("\n"), changed: true };
  }

  return { text: normalized, changed: false };
}

function addClosing(text: string, closingLine: string, fromName: string): string {
  const normalized = normalizeNewlines(text).trimEnd();
  return `${normalized}\n\n${closingLine},\n${fromName}\n`;
}

export function autoPersonalizeLetter(
  letterBody: string,
  recipient: RecipientRecord,
  opts: AutoPersonalizeOptions
): { output: string; warnings: string[] } {
  const warnings: string[] = [];
  let out = normalizeNewlines(letterBody);

  const displayName = getRecipientDisplayName(recipient);
  if (opts.enableGreeting) {
    if (!displayName) {
      warnings.push(
        "Greeting enabled, but recipient has no name/firstName/email to greet."
      );
    } else {
      const greetingLine = `${opts.greetingStyle} ${displayName},`;
      const replaced = replaceGreetingLine(out, greetingLine);
      out = replaced.changed ? replaced.text : addGreeting(out, greetingLine);
    }
  }

  if (opts.enableClosing) {
    const from = (opts.fromName ?? "").trim();
    if (!from) {
      warnings.push("Closing enabled, but From name is empty.");
    } else {
      const replaced = replaceClosingBlock(out, opts.closingStyle, from);
      out = replaced.changed
        ? ensureTrailingNewline(replaced.text)
        : addClosing(out, opts.closingStyle, from);
    }
  }

  return { output: out, warnings };
}

export function renderTemplate(
  template: string,
  recipient: RecipientRecord
): { output: string; missingKeys: string[] } {
  const missing = new Set<string>();

  const output = template.replace(PLACEHOLDER_RE, (_full, inner) => {
    const rawInner = String(inner ?? "").trim();
    if (!rawInner) return "";

    const [keyPart, ...defaultParts] = rawInner.split("|");
    const key = (keyPart ?? "").trim();
    const defaultValue = defaultParts.length
      ? defaultParts.join("|").trim()
      : undefined;

    if (!key) return "";

    const v = getPathValue(recipient, key);
    const normalized = (v ?? "").trim();
    if (normalized) return normalized;

    if (defaultValue !== undefined && defaultValue.length) return defaultValue;

    missing.add(key);
    // Keep the placeholder visible if missing so it's easy to spot in output
    return `{{${key}}}`;
  });

  return { output, missingKeys: Array.from(missing).sort() };
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  // Basic CSV/TSV parser supporting quotes for CSV.
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;

    if (delimiter === "," && ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseRecipientsFromText(input: string): {
  recipients: RecipientRecord[];
  headers: string[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const rawLines = input
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (rawLines.length === 0) {
    return { recipients: [], headers: [], warnings };
  }

  // Detect delimiter from header line: prefer tab if present (paste from Sheets)
  const headerLine = rawLines[0]!;
  const delimiter = headerLine.includes("\t") ? "\t" : ",";
  const headers = parseDelimitedLine(headerLine, delimiter).map((h) =>
    h.replace(/^"|"$/g, "").trim()
  );

  const normalizedHeaders = headers.map((h) => h.trim()).filter(Boolean);
  const headerSet = new Set<string>();
  const dedupedHeaders = normalizedHeaders.map((h) => {
    if (!headerSet.has(h)) {
      headerSet.add(h);
      return h;
    }
    let i = 2;
    while (headerSet.has(`${h}_${i}`)) i++;
    const renamed = `${h}_${i}`;
    headerSet.add(renamed);
    warnings.push(`Duplicate header "${h}" renamed to "${renamed}".`);
    return renamed;
  });

  const recipients: RecipientRecord[] = [];
  for (let rowIdx = 1; rowIdx < rawLines.length; rowIdx++) {
    const cols = parseDelimitedLine(rawLines[rowIdx]!, delimiter);
    if (cols.every((c) => c.trim().length === 0)) continue;

    const record: RecipientRecord = {};
    for (let colIdx = 0; colIdx < dedupedHeaders.length; colIdx++) {
      const key = dedupedHeaders[colIdx]!;
      record[key] = (cols[colIdx] ?? "").replace(/^"|"$/g, "").trim();
    }
    recipients.push(record);
  }

  if (dedupedHeaders.length === 0) {
    warnings.push("No headers found in the first row.");
  }
  if (recipients.length === 0) {
    warnings.push("No recipient rows found (need at least one row under the header).");
  }

  return { recipients, headers: dedupedHeaders, warnings };
}

export function slugifyFilename(s: string): string {
  const cleaned = s
    .toLowerCase()
    .trim()
    .replace(/[\s/\\]+/g, "-")
    .replace(/[^a-z0-9._-]+/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "letter";
}

