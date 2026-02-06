"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LETTER = `Dear Robbie,

I'm grateful and glad that Berkeley has brought me one of my most unexpected friendships. There's so much I appreciate about both you and you being in my life\u2014and I'm glad we have become friends throughout and beyond Berkeley.

When we first met, I think I had skepticism that our friendship would endure. I was overly talkative, and you had a silent endurance. In some ways, I feel that our friendship was like Ellie and Gus from Up. In one of the starting scenes, Ellie says, \u201CYou don't talk a lot. I like you.\u201D During our first year, our commonality we bonded over was really just going out.
Only now have I come to appreciate that there was a real strength behind the silence\u2014or as Robbie would put it, \u201CReal Gs move in silence.\u201D There were and are so many things I take for granted from you.

The small details and compromises you make\u2014not out of a position of weakness\u2014but out of a position of strength. Things like holding the door, showing up for friends, picking them up, and being there to help. These small things reflect a more external devotion to people other than oneself.

More largely, you take on the silent burden without any complaint. Whether it is making the difficult choice to graduate early and move to Seattle, flying to Berkeley nearly every week, or commuting down to Amazon\u2019s office\u2014there are countless sacrifices you make.
The process of thinking of others first is something I\u2019m sure your father is incredibly proud of you for picking up from him, and something I am striving to emulate from you.

During sophomore and junior year, I felt the most isolated in college. Still, your friendship\u2014being there for me whenever I needed support\u2014truly meant the world to me. Despite being a swirl and source of negativity, and having little consideration for you, I\u2019m so indebted that you stood by me. During this time, we also started to bridge that gap. Namely, I\u2019ll always look back at our drive to Vancouver as a real turning point. Part of this may have been just a function of spending more time together outside of just partying.

However, it was during this time that I improperly associated \u201Ctrauma uncovering / dumping\u201D with depth or quality of conversation and connection. One concept I have been thinking a lot about recently is the idea of \u201Cflat conversations.\u201D I have realized that I feel pressure in conversations to create imbalance. I can take a higher position\u2014giving out advice to others. I can take a lower position\u2014putting myself in a spot of pity and asking others to pick me up.
I\u2019d say it wasn\u2019t until late junior year / last year that we were really able to bridge the conversation gap. A big part of the conversation quality improving is likely due to me being less self-centered and better at actually listening, as opposed to just talking. Importantly, I recognize that our friendship was initiated on a shaky base\u2014partying. I\u2019m glad that despite our near 180 of that life/allure, deep personal changes for both of us, and moving across the country, our friendship has endured.

During times of change and growth, I\u2019m glad that we are able to celebrate the wins for each other and accept each other for who we are hoping to become. Even now, times like talking on the subway in Japan, and the discomfort it caused you\u2014looking back, you were likely more mindful of others than I was being. This grace you extend to others\u2014and most especially to me\u2014is something I have increasing admiration for.

I\u2019m also incredibly glad, proud, and happy to see your growth. You have since become more confident in voicing your perspective. While you are still as considerate as ever, I\u2019ve noticed a noticeably stronger sense of self. With me, with others, you have continued your consideration of others without giving in. I\u2019m proud of the self-changes you underwent to find your voice, and I\u2019m glad to hear you voice your stronger views. I hope to continue to be there to hear your thoughts in the future.

In addition, I continue to admire the dedication you have to becoming a better version of yourself. Whether it is your interest in improving yourself through reading, pushing yourself to be more in the moment and less technology-focused, or reflecting on who you are as a person. The life you live is one filled with intention, and that, perhaps, is the most important thing we can carry forward in our current stage of life.

Thanks for giving me the chance to learn and to do over\u2014over and over\u2014by being in your presence. I\u2019m grateful to have been able to experience your growth, and your support for me in my darkest times.

I hope to be more present and to create space for who you are. I hope you join me in my attempt at more \u201Cflat\u201D conversations, where the goal of conversation is simply to have no goal.
Thanks for enduring my growing pains, picking up the slack in the friendship more often than not, the check-ins on how things are going, and so much more.

Your friend,
Ethan Huang`;

type Line = { id: string; text: string; isEmpty: boolean };
type Dot = {
  id: string;
  topPct: number;
  leftPct: number;
  sizePx: number;
  opacity: number;
  dxPx: number;
  dyPx: number;
  durationS: number;
  delayS: number;
};

/* ────────────────────────────── helpers ────────────────────────────── */

function normalizeNewlines(letter: string): string {
  return letter.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function createTextMeasurer(font: string): (text: string) => number {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => 0;
  ctx.font = font;
  return (text: string) => ctx.measureText(text).width;
}

function splitWordAtHyphenToFit(
  word: string,
  maxWidthPx: number,
  measure: (s: string) => number
): string[] {
  if (!word.includes("-")) return [word];
  const parts = word.split("-");
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < parts.length; i++) {
    const piece = parts[i]!;
    const withHyphen = i < parts.length - 1 ? `${piece}-` : piece;
    const next = cur ? `${cur}${withHyphen}` : withHyphen;
    if (measure(next) <= maxWidthPx) {
      cur = next;
    } else {
      if (cur) out.push(cur);
      cur = withHyphen;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function wrapParagraphToMeasuredLines(
  paragraph: string,
  maxWidthPx: number,
  measure: (s: string) => number
): string[] {
  const trimmed = paragraph.trim();
  if (!trimmed) return [""];

  const rawWords = trimmed.split(/\s+/);
  const words: string[] = [];
  for (const w of rawWords) {
    if (measure(w) <= maxWidthPx) {
      words.push(w);
    } else {
      words.push(...splitWordAtHyphenToFit(w, maxWidthPx, measure));
    }
  }

  const lines: string[] = [];
  let cur = "";

  for (const w of words) {
    if (!cur) {
      cur = w;
      continue;
    }
    const candidate = `${cur} ${w}`;
    if (measure(candidate) <= maxWidthPx) {
      cur = candidate;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);

  // Widow control
  const minLastLineWords = 4;
  const minPrevLineWords = 5;

  while (lines.length >= 2) {
    const lastIdx = lines.length - 1;
    const prevIdx = lines.length - 2;
    const lastWords = lines[lastIdx]!.split(/\s+/).filter(Boolean);
    const prevWords = lines[prevIdx]!.split(/\s+/).filter(Boolean);

    const lastTooShort =
      lastWords.length > 0 && lastWords.length < minLastLineWords;
    if (!lastTooShort) break;
    if (prevWords.length <= minPrevLineWords) break;

    const moved = prevWords.pop();
    if (!moved) break;
    lastWords.unshift(moved);

    const newPrev = prevWords.join(" ");
    const newLast = lastWords.join(" ");
    if (measure(newPrev) > maxWidthPx || measure(newLast) > maxWidthPx) break;

    lines[prevIdx] = newPrev;
    lines[lastIdx] = newLast;
  }

  return lines;
}

function wrapLetterToMeasuredLines(
  letter: string,
  maxWidthPx: number,
  measure: (s: string) => number
): Line[] {
  const rawLines = normalizeNewlines(letter).split("\n");
  const out: Line[] = [];
  let idCounter = 0;

  for (const raw of rawLines) {
    if (raw.trim().length === 0) {
      out.push({ id: `l-${idCounter++}`, text: "", isEmpty: true });
      continue;
    }
    const wrapped = wrapParagraphToMeasuredLines(raw, maxWidthPx, measure);
    for (const w of wrapped) {
      out.push({
        id: `l-${idCounter++}`,
        text: w,
        isEmpty: w.trim().length === 0,
      });
    }
  }

  return out;
}

function generateDots(count: number): Dot[] {
  const dots: Dot[] = [];
  for (let i = 0; i < count; i++) {
    const r = Math.random();
    const sizePx = 3 + Math.floor(Math.random() * 6);
    dots.push({
      id: `dot-${i}-${Math.floor(r * 1e6)}`,
      topPct: Math.random() * 100,
      leftPct: Math.random() * 100,
      sizePx,
      opacity: 0.15 + Math.random() * 0.25,
      dxPx: (Math.random() - 0.5) * 200,
      dyPx: (Math.random() - 0.5) * 200,
      durationS: 2 + Math.random() * 3,
      delayS: Math.random() * -4,
    });
  }
  return dots;
}

/* ──────────────────────── emphasis rendering ──────────────────────── */

const EMPHASIZE_PHRASES = [
  "grateful",
  "strength",
  "devotion",
  "endured",
  "grace",
  "admiration",
  "growth",
  "intention",
  "proud",
  "indebted",
  "emulate",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderEmphasizedText(text: string): React.ReactNode {
  const phrases = EMPHASIZE_PHRASES;
  if (!text || phrases.length === 0) return text;

  const pattern = new RegExp(
    `(${phrases.map(escapeRegExp).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    const isMatch = phrases.some(
      (p) => p.toLowerCase() === part.toLowerCase()
    );
    if (!isMatch) return <span key={i}>{part}</span>;
    return (
      <span
        key={i}
        className="rounded-sm bg-amber-100/50 px-1 underline decoration-amber-700/30 underline-offset-4"
      >
        {part}
      </span>
    );
  });
}

/* ─────────────────────── splash screen ─────────────────────── */

function SplashScreen({ onContinue }: { onContinue: () => void }) {
  const [ready, setReady] = useState(false);
  const [dots, setDots] = useState<Dot[]>([]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setDots(generateDots(30));
    });
    const t = window.setTimeout(() => setReady(true), 3500);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const handler = () => onContinue();
    window.addEventListener("keydown", handler);
    window.addEventListener("pointerdown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("pointerdown", handler);
    };
  }, [ready, onContinue]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FDFAF6]">
      <style>{`
        @keyframes floatDot {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(var(--dx), var(--dy), 0); }
        }
        @keyframes promptIn {
          0% {
            opacity: 0;
            transform: translate3d(0, 10px, 0) scale(0.96);
            filter: blur(6px);
            letter-spacing: 0.08em;
          }
          60% {
            opacity: 1;
            transform: translate3d(0, -2px, 0) scale(1.04);
            filter: blur(0px);
            letter-spacing: 0.02em;
          }
          100% {
            opacity: 1;
            transform: translate3d(0, 0px, 0) scale(1);
            filter: blur(0px);
            letter-spacing: 0.03em;
          }
        }
        @keyframes promptPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      {/* floating dots */}
      <div className="pointer-events-none absolute inset-0">
        {dots.map((d) => {
          const style: React.CSSProperties & {
            "--dx": string;
            "--dy": string;
          } = {
            top: `${d.topPct}%`,
            left: `${d.leftPct}%`,
            width: `${d.sizePx}px`,
            height: `${d.sizePx}px`,
            opacity: d.opacity,
            "--dx": `${d.dxPx}px`,
            "--dy": `${d.dyPx}px`,
            animation: `floatDot ${d.durationS}s ease-in-out ${d.delayS}s infinite alternate`,
            filter: "blur(0.3px)",
          };

          return (
            <div
              key={d.id}
              className="absolute rounded-full bg-[#C4A97D]"
              style={style}
            />
          );
        })}
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
        <div className="text-center">
          <div className="font-serif text-5xl font-medium tracking-tight text-[#2C2318] sm:text-6xl">
            Robbie
          </div>
          <div className="mt-3 text-sm tracking-wide text-[#9C8E7C]">
            a letter for you
          </div>
          <div
            className={[
              "mt-8 text-xs italic text-[#B5A48E]",
              "transition-opacity duration-500",
              ready ? "opacity-100" : "opacity-0",
            ].join(" ")}
            style={
              ready
                ? ({
                    animation:
                      "promptIn 520ms cubic-bezier(0.2, 0.9, 0.2, 1) both, promptPulse 2s ease-in-out 700ms infinite",
                  } as React.CSSProperties)
                : undefined
            }
          >
            press any key to continue
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────── letter view ─────────────────────── */

function LetterView() {
  const [lines, setLines] = useState<Line[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);

  const [activeIdx, setActiveIdx] = useState<number>(0);

  // Auto-focus the scroll container so keyboard scrolling works immediately
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const recomputeActive = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const crect = container.getBoundingClientRect();
    const centerY = crect.top + crect.height / 2;

    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;

    for (let i = 0; i < lineRefs.current.length; i++) {
      const el = lineRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const mid = r.top + r.height / 2;
      const dist = Math.abs(mid - centerY);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    setActiveIdx((prev) => (prev === bestIdx ? prev : bestIdx));
  }, []);

  const onScroll = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recomputeActive);
  }, [recomputeActive]);

  const recomputeWrap = useCallback(() => {
    const content = contentRef.current;
    const measureEl = measureRef.current;
    if (!content || !measureEl) return;

    const width = content.getBoundingClientRect().width;
    const cs = window.getComputedStyle(measureEl);
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const measure = createTextMeasurer(font);
    // Account for the 1.12x scale on the active line so text doesn't overflow
    const wrapped = wrapLetterToMeasuredLines(LETTER, width * 0.88, measure);
    setLines(wrapped);
    setActiveIdx((prev) => Math.max(0, Math.min(prev, wrapped.length - 1)));
    requestAnimationFrame(recomputeActive);
  }, [recomputeActive]);

  useEffect(() => {
    const t = requestAnimationFrame(() => {
      recomputeWrap();
      recomputeActive();
    });
    const onResize = () => {
      recomputeWrap();
      recomputeActive();
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [recomputeWrap, recomputeActive]);

  return (
    <div className="min-h-screen bg-[#FDFAF6]">
      <style>{`
        @keyframes letterFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <main
        className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-8"
        style={{ animation: "letterFadeIn 800ms ease-out both" }}
      >
        <div className="flex items-baseline justify-between">
          <div className="font-serif text-sm font-medium text-[#9C8E7C]">
            A letter for Robbie
          </div>
          <div className="text-xs text-[#B5A48E]">scroll to read</div>
        </div>

        <div
          ref={containerRef}
          onScroll={onScroll}
          tabIndex={0}
          className="relative mt-6 h-[75vh] snap-y snap-mandatory overflow-y-auto overflow-x-hidden rounded-2xl border border-[#E8DFD0] bg-white px-6 py-10 shadow-[0_2px_24px_rgba(44,35,24,0.05)] outline-none"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
            maskImage:
              "linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)",
          }}
        >
          {/* hidden measure element: matches the ACTIVE line serif typography */}
          <span
            ref={measureRef}
            className="pointer-events-none absolute -left-[99999px] top-0 font-serif text-[28px] font-semibold leading-9 sm:text-[32px]"
            aria-hidden="true"
          >
            Measure
          </span>

          <div
            ref={contentRef}
            className="mx-auto flex max-w-prose flex-col gap-2 py-[20vh]"
          >
            {lines.map((line, idx) => {
              const dist = Math.abs(idx - activeIdx);

              const opacity =
                dist === 0
                  ? 1
                  : dist === 1
                    ? 0.72
                    : dist === 2
                      ? 0.35
                      : 0.1;

              const fontSizeClass =
                dist === 0
                  ? "text-[28px] leading-9 sm:text-[32px]"
                  : dist === 1
                    ? "text-[22px] leading-8 sm:text-[24px]"
                    : "text-[20px] leading-7 sm:text-[21px]";

              const scale = dist === 0 ? 1.12 : dist === 1 ? 1.04 : 1;
              const weightClass =
                dist === 0
                  ? "font-semibold"
                  : dist === 1
                    ? "font-medium"
                    : "font-normal";

              const displayText = line.isEmpty ? "\u00A0" : line.text;
              const minH = line.isEmpty
                ? dist === 0
                  ? "min-h-[26px]"
                  : "min-h-[18px]"
                : dist === 0
                  ? "min-h-[44px]"
                  : "min-h-[30px]";
              const leadingClass =
                dist === 0
                  ? "leading-9"
                  : dist === 1
                    ? "leading-8"
                    : "leading-7";

              return (
                <div
                  key={line.id}
                  ref={(el) => {
                    lineRefs.current[idx] = el;
                  }}
                  className={[
                    "snap-center",
                    "font-serif",
                    "transition-[opacity,transform,color] duration-200 ease-out",
                    minH,
                    fontSizeClass,
                    weightClass,
                    leadingClass,
                    "text-[#2C2318]",
                    "whitespace-nowrap",
                    "will-change-transform",
                  ].join(" ")}
                  style={{
                    opacity,
                    transform: `scale(${scale})`,
                  }}
                >
                  {line.isEmpty
                    ? displayText
                    : renderEmphasizedText(displayText)}
                </div>
              );
            })}
          </div>

          {/* center guide (very subtle) */}
          <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#E8DFD0]/30" />
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────── root component ─────────────────────── */

export default function Home() {
  const [phase, setPhase] = useState<"splash" | "fading" | "letter">("splash");

  const handleContinue = useCallback(() => {
    setPhase("fading");
    setTimeout(() => setPhase("letter"), 650);
  }, []);

  if (phase === "letter") {
    return <LetterView />;
  }

  return (
    <div
      style={{
        opacity: phase === "fading" ? 0 : 1,
        transition: "opacity 600ms ease-out",
      }}
    >
      <SplashScreen onContinue={handleContinue} />
    </div>
  );
}
