import { useEffect, useRef, useState } from "react";
import PlayingCard from "./components/PlayingCard";
import { ChipButton, StackChip } from "./components/Chip";
import { ParticleLayer, burst, coinShower, floatText } from "./fx";
import type { CardData } from "./game/cards";
import { cardName, chipsForBet, rankLabel, shuffledDeck } from "./game/cards";
import { isMuted, setMuted, sfx } from "./game/audio";

type Phase =
  | "start"
  | "bet"
  | "dealing"
  | "dealt"
  | "pairDraw"
  | "reveal"
  | "settle"
  | "busted";

type Tone = "neutral" | "win" | "lose";

interface Msg {
  title: string;
  sub: string;
  tone: Tone;
}

interface Outcome {
  kind: "win" | "auto" | "post" | "loss" | "double";
  net: number;
}

interface Stats {
  hands: number;
  wins: number;
  streak: number;
  bestStreak: number;
  rebuys: number;
}

const CHIPS = [5, 25, 100, 500];
const START_BANK = 1000;
const MIN_BET = 5;

const fmt = (n: number) => `$${n.toLocaleString("en-US")}`;

function useTween(target: number, dur = 620): number {
  const [v, setV] = useState(target);
  const ref = useRef(target);
  useEffect(() => {
    const from = ref.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      const nv = from + (target - from) * e;
      ref.current = nv;
      setV(nv);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return Math.round(v);
}

const center = (el: HTMLElement | null) => {
  if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export default function App() {
  const [phase, setPhase] = useState<Phase>("start");
  const [balance, setBalance] = useState(START_BANK);
  const [bet, setBet] = useState(0);
  const [lastBet, setLastBet] = useState(0);
  const [cards, setCards] = useState<(CardData | null)[]>([null, null, null]);
  const [faceUp, setFaceUp] = useState<boolean[]>([false, false, false]);
  const [dealVec, setDealVec] = useState<({ x: number; y: number } | null)[]>([null, null, null]);
  const [glow, setGlow] = useState<("win" | "lose" | null)[]>([null, null, null]);
  const [choice, setChoice] = useState<"in" | "out" | null>(null);
  const [result, setResult] = useState<Outcome | null>(null);
  const [msg, setMsg] = useState<Msg>({
    title: "Place your bet",
    sub: "Stack chips from the tray — minimum $5.",
    tone: "neutral",
  });
  const [history, setHistory] = useState<("W" | "L")[]>([]);
  const [stats, setStats] = useState<Stats>({
    hands: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    rebuys: 0,
  });
  const [bestBank, setBestBank] = useState(START_BANK);
  const [shake, setShake] = useState(false);
  const [mutedState, setMutedState] = useState(isMuted());

  const displayBalance = useTween(balance);

  const deckRef = useRef<HTMLDivElement>(null);
  const betSpotRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const setSlotRef = (i: number) => (el: HTMLDivElement | null) => {
    slotRefs.current[i] = el;
  };

  const timersRef = useRef<number[]>([]);
  const after = (ms: number, fn: () => void) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };
  useEffect(() => clearTimers, []);

  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);
  useEffect(() => {
    if (balance > bestBank) setBestBank(balance);
  }, [balance, bestBank]);

  const pendingRef = useRef<{ c1: CardData; c2: CardData; c3: CardData } | null>(null);

  const vec = (slotIdx: number) => {
    const d = deckRef.current;
    const s = slotRefs.current[slotIdx];
    if (!d || !s) return null;
    const dr = d.getBoundingClientRect();
    const sr = s.getBoundingClientRect();
    return {
      x: dr.left + dr.width / 2 - (sr.left + sr.width / 2),
      y: dr.top + dr.height / 2 - (sr.top + sr.height / 2),
    };
  };

  /* ---------------- betting ---------------- */

  const addChip = (v: number) => {
    if (phase !== "bet") return;
    if (balance - bet < v) {
      sfx.click();
      return;
    }
    setBet((b) => b + v);
    sfx.chip();
  };

  const clearBet = () => {
    if (phase !== "bet" || bet === 0) return;
    setBet(0);
    sfx.click();
  };

  const rebet = () => {
    if (phase !== "bet" || lastBet < MIN_BET) return;
    const v = Math.min(lastBet, balance);
    if (v < MIN_BET) return;
    setBet(v);
    sfx.chip();
  };

  const maxBet = () => {
    if (phase !== "bet" || balance < MIN_BET) return;
    setBet(balance);
    sfx.chip();
  };

  /* ---------------- round flow ---------------- */

  const startDeal = () => {
    if (phase !== "bet" || bet < MIN_BET || bet > balance) return;
    clearTimers();
    sfx.shuffle();
    setResult(null);
    setChoice(null);
    setGlow([null, null, null]);
    setBalance((b) => b - bet);
    setLastBet(bet);
    const deck = shuffledDeck();
    const [c1, c2, c3] = deck;
    pendingRef.current = { c1, c2, c3 };
    setFaceUp([false, false, false]);
    setDealVec([vec(0), vec(1), vec(2)]);
    setPhase("dealing");
    setMsg({ title: "No more bets", sub: "Two up, one to come…", tone: "neutral" });
    setCards([c1, null, null]);
    after(60, () => sfx.card());
    after(640, () => {
      setFaceUp((f) => [true, f[1], f[2]]);
      sfx.flip();
    });
    after(860, () => {
      setCards([c1, null, c2]);
      sfx.card();
    });
    after(1480, () => {
      setFaceUp((f) => [f[0], f[1], true]);
      sfx.flip();
    });
    after(1820, () => {
      const lo = Math.min(c1.rank, c2.rank);
      const hi = Math.max(c1.rank, c2.rank);
      if (hi - lo === 1) {
        finishRound(
          "auto",
          bet,
          bet * 2,
          `STRAIGHT SPREAD — INSTANT WIN +${fmt(bet)}`,
          `${rankLabel(lo)} and ${rankLabel(hi)} are consecutive. The table pays at once.`
        );
      } else if (hi === lo) {
        setPhase("pairDraw");
        setMsg({
          title: `Pair of ${rankLabel(hi)}s`,
          sub: "Draw one — break the pair and win. Match it and lose double.",
          tone: "neutral",
        });
      } else {
        setPhase("dealt");
        const gap = hi - lo - 1;
        setMsg({
          title: "Between or outside?",
          sub: `${gap} rank${gap > 1 ? "s" : ""} lie in the spread · ${gap * 4} of 50 cards land between.`,
          tone: "neutral",
        });
      }
    });
  };

  const dealThird = (onFlipDone: () => void) => {
    const p = pendingRef.current;
    if (!p) return;
    after(240, () => {
      setCards((prev) => [prev[0], p.c3, prev[2]]);
      sfx.card();
    });
    after(920, () => {
      setFaceUp((f) => [f[0], true, f[2]]);
      sfx.flip();
    });
    after(1680, onFlipDone);
  };

  const choose = (dir: "in" | "out") => {
    if (phase !== "dealt") return;
    const p = pendingRef.current;
    if (!p) return;
    setChoice(dir);
    setPhase("reveal");
    sfx.click();
    setMsg({
      title: dir === "in" ? "You called IN-BETWEEN" : "You called OUTSIDE",
      sub: "Third card coming — no more bets.",
      tone: "neutral",
    });
    dealThird(() => {
      const lo = Math.min(p.c1.rank, p.c2.rank);
      const hi = Math.max(p.c1.rank, p.c2.rank);
      const r3 = p.c3.rank;
      const post = r3 === lo || r3 === hi;
      const between = r3 > lo && r3 < hi;
      const win = dir === "in" ? between : !between && !post;
      if (win) {
        finishRound(
          "win",
          bet,
          bet * 2,
          `YOU WIN +${fmt(bet)}`,
          `The ${cardName(p.c3)} landed ${dir === "in" ? "inside the spread" : "outside it"}. Paid 1:1.`
        );
      } else if (post) {
        finishRound(
          "post",
          -bet,
          0,
          `POSTED — ${cardName(p.c3)} HITS THE POST`,
          "Matching either card forfeits the wager. The house takes it."
        );
      } else {
        finishRound(
          "loss",
          -bet,
          0,
          dir === "in"
            ? `OUTSIDE — ${cardName(p.c3)} ESCAPES`
            : `INSIDE — ${cardName(p.c3)} SNEAKS THROUGH`,
          `It landed ${dir === "in" ? "beyond the spread" : "between the cards"}. The house takes ${fmt(bet)}.`
        );
      }
    });
  };

  const drawPair = () => {
    if (phase !== "pairDraw") return;
    const p = pendingRef.current;
    if (!p) return;
    setPhase("reveal");
    sfx.click();
    setMsg({
      title: "Drawing to the pair",
      sub: "Any new rank wins. A match costs double.",
      tone: "neutral",
    });
    dealThird(() => {
      if (p.c3.rank === p.c1.rank) {
        const extra = Math.min(bet, balanceRef.current);
        finishRound(
          "double",
          -(bet + extra),
          -extra,
          `MATCHED — DOUBLE LOSS −${fmt(bet + extra)}`,
          `The ${cardName(p.c3)} paired the board. House rules: pay twice.`
        );
      } else {
        finishRound(
          "win",
          bet,
          bet * 2,
          `PAIR BROKEN — YOU WIN +${fmt(bet)}`,
          `The ${cardName(p.c3)} missed the pair. Paid 1:1.`
        );
      }
    });
  };

  const finishRound = (
    kind: Outcome["kind"],
    net: number,
    balanceDelta: number,
    title: string,
    sub: string
  ) => {
    if (balanceDelta !== 0) setBalance((b) => Math.max(0, b + balanceDelta));
    const win = net > 0;
    setResult({ kind, net });
    setPhase("settle");
    setMsg({ title, sub, tone: win ? "win" : "lose" });
    setGlow(win ? ["win", "win", "win"] : ["lose", "lose", "lose"]);
    setHistory((h) => [...h.slice(-11), win ? "W" : "L"]);
    setStats((s) => {
      const streak = win ? s.streak + 1 : 0;
      return {
        ...s,
        hands: s.hands + 1,
        wins: s.wins + (win ? 1 : 0),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      };
    });
    const spot = center(betSpotRef.current);
    if (win) {
      sfx.win();
      after(140, () => sfx.coin());
      coinShower(spot.x, spot.y - 10);
      const mid = center(slotRefs.current[1] ?? slotRefs.current[0]);
      burst(mid.x, mid.y, ["#f6d789", "#fff3cd", "#e3b558"], 30, 7);
      floatText(spot.x, spot.y - 70, `+${fmt(net)}`, "ft-gold");
    } else {
      sfx.lose();
      setShake(true);
      after(460, () => setShake(false));
      floatText(spot.x, spot.y - 70, `−${fmt(Math.abs(net))}`, "ft-red");
      const mid = slotRefs.current[1];
      if (mid) {
        const c = center(mid);
        burst(c.x, c.y, ["#c41e3a", "#7a1428", "#4d0813"], 16, 4.5);
      }
    }
  };

  const nextRound = () => {
    if (phase !== "settle") return;
    clearTimers();
    sfx.click();
    if (balance < MIN_BET) {
      setPhase("busted");
      sfx.lose();
      return;
    }
    setCards([null, null, null]);
    setFaceUp([false, false, false]);
    setDealVec([null, null, null]);
    setGlow([null, null, null]);
    setBet(0);
    setResult(null);
    setChoice(null);
    setPhase("bet");
    setMsg({
      title: "Place your bet",
      sub: "Stack chips from the tray — minimum $5.",
      tone: "neutral",
    });
  };

  const takeSeat = () => {
    sfx.click();
    setPhase("bet");
    setMsg({
      title: "Place your bet",
      sub: "Stack chips from the tray — minimum $5.",
      tone: "neutral",
    });
  };

  const rebuy = () => {
    sfx.chip();
    setBalance(START_BANK);
    setStats((s) => ({ ...s, streak: 0, rebuys: s.rebuys + 1 }));
    setCards([null, null, null]);
    setFaceUp([false, false, false]);
    setDealVec([null, null, null]);
    setGlow([null, null, null]);
    setBet(0);
    setResult(null);
    setChoice(null);
    setHistory([]);
    setPhase("bet");
    setMsg({
      title: "Fresh credit — place your bet",
      sub: "The house extends another $1,000. Spend it wisely.",
      tone: "neutral",
    });
  };

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (phase === "start" && (k === " " || k === "enter")) {
        e.preventDefault();
        takeSeat();
        return;
      }
      if (phase === "bet") {
        if (k === "1") addChip(5);
        else if (k === "2") addChip(25);
        else if (k === "3") addChip(100);
        else if (k === "4") addChip(500);
        else if (k === "c") clearBet();
        else if (k === "r") rebet();
        else if (k === "m") maxBet();
        else if (k === " " || k === "d" || k === "enter") {
          e.preventDefault();
          startDeal();
        }
      } else if (phase === "dealt") {
        if (k === "b") choose("in");
        else if (k === "o") choose("out");
      } else if (phase === "pairDraw" && (k === " " || k === "enter" || k === "d")) {
        e.preventDefault();
        drawPair();
      } else if (phase === "settle" && (k === " " || k === "enter")) {
        e.preventDefault();
        nextRound();
      } else if (phase === "busted" && (k === " " || k === "enter")) {
        e.preventDefault();
        rebuy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  /* ---------------- derived ---------------- */

  const stack = chipsForBet(bet);
  const spread =
    cards[0] && cards[2]
      ? (() => {
          const lo = Math.min(cards[0].rank, cards[2].rank);
          const hi = Math.max(cards[0].rank, cards[2].rank);
          const gap = hi - lo - 1;
          const inPct = Math.round(((gap * 4) / 50) * 100);
          const postPct = hi === lo ? 4 : 16;
          return { lo, hi, gap, inPct, postPct, outPct: 100 - inPct - postPct };
        })()
      : null;

  const actionLabel =
    phase === "bet"
      ? "DEAL"
      : phase === "settle"
      ? "NEXT HAND"
      : phase === "dealing"
      ? "DEALING…"
      : phase === "reveal"
      ? "NO MORE BETS"
      : phase === "dealt"
      ? "AWAITING CALL"
      : phase === "pairDraw"
      ? "AWAITING DRAW"
      : "DEAL";

  const actionEnabled =
    (phase === "bet" && bet >= MIN_BET && bet <= balance) || phase === "settle";

  const toneClass =
    msg.tone === "win"
      ? "text-[#f6d789] title-glow"
      : msg.tone === "lose"
      ? "text-[#ff9a9a]"
      : "text-[#f3ead6]";

  /* ---------------- render ---------------- */

  return (
    <div
      className={`felt-bg relative h-dvh w-full select-none overflow-hidden ${
        shake ? "shake" : ""
      }`}
    >
      {/* atmosphere */}
      <div className="noise-layer pointer-events-none absolute inset-0" />
      <div className="ambient-a pointer-events-none absolute inset-0" />
      <div className="ambient-b pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[92vmin] w-[150vmin] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-[#e8c268]/20"
        style={{ boxShadow: "inset 0 0 130px rgba(0,0,0,.45), 0 0 90px rgba(0,0,0,.4)" }}
      >
        <div className="absolute inset-5 rounded-[50%] border border-[#e8c268]/10" />
      </div>
      <div className="vignette pointer-events-none absolute inset-0" />

      <ParticleLayer />

      <div className="relative z-10 flex h-full flex-col">
        {/* ---------- header ---------- */}
        <header className="relative flex items-center justify-between border-b border-[#e8c268]/15 px-3 py-2 sm:px-6">
          <div className="flex items-center gap-2.5">
            <CoinIcon />
            <div>
              <div className="text-[9px] font-bold tracking-[0.28em] text-[#e8c268]/75">
                BANKROLL
              </div>
              <div className="text-xl font-extrabold leading-none tabular-nums text-[#f6efe0] sm:text-2xl">
                {fmt(displayBalance)}
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center">
            <div className="font-display text-base font-black tracking-[0.22em] text-[#f6d789] title-glow sm:text-xl">
              IN—BETWEEN
            </div>
            <div className="text-[8px] font-semibold tracking-[0.42em] text-[#e8c268]/60 sm:text-[9px]">
              ROYAL PALM CASINO · TABLE 21
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <div className="hidden text-right md:block">
              <div className="text-[9px] font-bold tracking-[0.24em] text-[#e8c268]/75">
                HAND {stats.hands + (phase === "bet" || phase === "dealing" ? 1 : 0)}
              </div>
              <div className="text-sm font-extrabold leading-tight tabular-nums text-[#f6efe0]">
                STREAK {stats.streak}
                <span className="ml-1.5 text-[10px] font-semibold text-[#e8c268]/60">
                  BEST {stats.bestStreak}
                </span>
              </div>
            </div>
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <div className="flex gap-1">
                {history.length === 0 ? (
                  <span className="text-[9px] tracking-[0.2em] text-[#e8c268]/45">NO HANDS</span>
                ) : (
                  history.slice(-8).map((h, i) => (
                    <span
                      key={`${i}-${h}`}
                      title={h === "W" ? "Won" : "Lost"}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        h === "W"
                          ? "bg-[#f6d789] shadow-[0_0_8px_rgba(246,215,137,.7)]"
                          : "border border-[#c0354d] bg-[#7a1428]"
                      }`}
                    />
                  ))
                )}
              </div>
              <div className="text-[9px] font-semibold tracking-[0.2em] text-[#e8c268]/60">
                BEST BANK {fmt(bestBank)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const m = !mutedState;
                setMuted(m);
                setMutedState(m);
                if (!m) sfx.chip();
              }}
              className="btn-dark grid h-9 w-9 place-items-center rounded-md"
              aria-label={mutedState ? "Unmute" : "Mute"}
            >
              <SpeakerIcon muted={mutedState} />
            </button>
          </div>
        </header>

        {/* ---------- table ---------- */}
        <main className="relative min-h-0 flex-1">
          {/* shoe */}
          <div
            ref={deckRef}
            className="absolute right-[3%] top-3 z-10 flex flex-col items-center gap-1.5 sm:right-[5%]"
          >
            <div className="relative h-[72px] w-[52px] sm:h-[86px] sm:w-[62px]">
              {[8, 4, 0].map((off) => (
                <div
                  key={off}
                  className="card-back-face absolute inset-0 rounded-[7px] border border-black/40"
                  style={{
                    transform: `translate(${off * 0.7}px, ${-off * 0.7}px)`,
                    boxShadow: "0 6px 14px rgba(0,0,0,.5)",
                  }}
                >
                  <div className="card-lattice" />
                </div>
              ))}
            </div>
            <span className="font-display text-[9px] font-bold tracking-[0.3em] text-[#e8c268]/70">
              SHOE
            </span>
          </div>

          {/* card row */}
          <div className="absolute inset-0 flex items-center justify-center pb-14">
            <div className="flex items-center gap-[clamp(14px,3vw,46px)]">
              <Slot
                idx={0}
                label="FIRST"
                card={cards[0]}
                faceUp={faceUp[0]}
                vec={dealVec[0]}
                glow={glow[0]}
                setRef={setSlotRef(0)}
              />
              <Slot
                idx={1}
                label="THIRD"
                card={cards[1]}
                faceUp={faceUp[1]}
                vec={dealVec[1]}
                glow={glow[1]}
                suspense={phase === "reveal" && !faceUp[1]}
                setRef={setSlotRef(1)}
              />
              <Slot
                idx={2}
                label="SECOND"
                card={cards[2]}
                faceUp={faceUp[2]}
                vec={dealVec[2]}
                glow={glow[2]}
                setRef={setSlotRef(2)}
              />
            </div>
          </div>

          {/* message + decisions */}
          <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-2 px-4">
            <div key={msg.title} className="msg-pop text-center">
              <div
                className={`font-display text-base font-black leading-tight tracking-[0.06em] sm:text-2xl ${toneClass}`}
              >
                {msg.title}
              </div>
              <div className="mt-0.5 text-xs font-medium text-emerald-100/70 sm:text-sm">
                {msg.sub}
              </div>
            </div>

            {phase === "dealt" && spread && (
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
                <button
                  type="button"
                  onClick={() => choose("in")}
                  className="btn-gold rounded-lg px-5 py-2.5 font-display text-sm font-bold tracking-[0.12em] sm:px-8 sm:text-base"
                >
                  BETWEEN
                  <span className="block font-body text-[11px] font-bold tracking-normal opacity-75">
                    {spread.inPct}% of shoe
                  </span>
                </button>
                <div className="text-center">
                  <div className="text-[10px] font-bold tracking-[0.22em] text-[#ff9a9a]/85">
                    POST {spread.postPct}%
                  </div>
                  <div className="text-[9px] font-medium tracking-widest text-emerald-100/50">
                    B / O keys
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => choose("out")}
                  className="btn-crimson rounded-lg px-5 py-2.5 font-display text-sm font-bold tracking-[0.12em] sm:px-8 sm:text-base"
                >
                  OUTSIDE
                  <span className="block font-body text-[11px] font-bold tracking-normal opacity-75">
                    {spread.outPct}% of shoe
                  </span>
                </button>
              </div>
            )}

            {phase === "pairDraw" && (
              <button
                type="button"
                onClick={drawPair}
                className="btn-gold rounded-lg px-8 py-3 font-display text-sm font-bold tracking-[0.14em] sm:text-base"
              >
                DRAW THIRD CARD
                <span className="block font-body text-[11px] font-bold tracking-normal opacity-75">
                  match loses double · space
                </span>
              </button>
            )}

            {phase === "settle" && (
              <div className="text-[10px] font-semibold tracking-[0.3em] text-[#e8c268]/55">
                {balance < MIN_BET ? "SPACE — SETTLE UP" : "SPACE — NEXT HAND"}
              </div>
            )}

            {(phase === "bet" || phase === "dealing") && (
              <div className="text-[10px] font-semibold tracking-[0.3em] text-[#e8c268]/45">
                1–4 CHIPS · D DEALS · C CLEARS
              </div>
            )}
          </div>
        </main>

        {/* ---------- footer tray ---------- */}
        <footer className="relative z-10 border-t border-[#e8c268]/25 bg-[#052015]/90 px-3 py-2.5 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:justify-between">
            {/* chips + controls */}
            <div className="order-2 flex items-center gap-2 sm:order-1 sm:gap-2.5">
              {CHIPS.map((v) => (
                <ChipButton
                  key={v}
                  value={v}
                  size={54}
                  disabled={phase !== "bet" || balance - bet < v}
                  onClick={() => addChip(v)}
                />
              ))}
              <div className="ml-1 flex flex-col gap-1">
                <button
                  type="button"
                  className="btn-dark rounded px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em]"
                  onClick={clearBet}
                  disabled={phase !== "bet" || bet === 0}
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  className="btn-dark rounded px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em]"
                  onClick={rebet}
                  disabled={phase !== "bet" || lastBet < MIN_BET || Math.min(lastBet, balance) < MIN_BET}
                >
                  REBET
                </button>
                <button
                  type="button"
                  className="btn-dark rounded px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em]"
                  onClick={maxBet}
                  disabled={phase !== "bet" || balance < MIN_BET}
                >
                  MAX
                </button>
              </div>
            </div>

            {/* bet spot */}
            <div ref={betSpotRef} className="order-1 flex flex-col items-center sm:order-2">
              <div className="relative h-[74px] w-[92px] sm:h-[84px] sm:w-[100px]">
                <div className="absolute inset-0 rounded-[50%] border-2 border-dashed border-[#e8c268]/45 bg-[#0a3323]/70 shadow-[inset_0_4px_16px_rgba(0,0,0,.5)]" />
                <div className="absolute inset-2.5 rounded-[50%] border border-[#e8c268]/20" />
                <span className="font-display absolute inset-0 grid place-items-center text-[10px] font-bold tracking-[0.32em] text-[#e8c268]/55">
                  {stack.length === 0 ? "BET" : ""}
                </span>
                {stack.slice(0, 12).map((v, i) => (
                  <StackChip
                    key={`${i}-${v}`}
                    value={v}
                    index={i}
                    fresh={phase === "bet" && i === stack.length - 1}
                  />
                ))}
              </div>
              <div
                className={`mt-1 text-base font-extrabold leading-none tabular-nums sm:text-lg ${
                  bet > 0 ? "text-[#f6d789]" : "text-[#f3ead6]/35"
                }`}
              >
                {fmt(bet)}
              </div>
            </div>

            {/* main action */}
            <div className="order-3">
              <button
                type="button"
                className="btn-gold rounded-lg px-8 py-3 font-display text-base font-black tracking-[0.16em] sm:px-10 sm:py-3.5 sm:text-lg"
                onClick={() => (phase === "settle" ? nextRound() : startDeal())}
                disabled={!actionEnabled}
              >
                {actionLabel}
              </button>
            </div>
          </div>
          <div className="mt-1.5 text-center text-[9px] font-medium tracking-[0.3em] text-[#e8c268]/35">
            ROYAL PALM CASINO · IN-BETWEEN PAYS 1:1 · POST FORFEITS · PAIR MATCH LOSES DOUBLE
          </div>
        </footer>
      </div>

      {/* ---------- overlays ---------- */}
      {phase === "start" && <StartOverlay onStart={takeSeat} />}
      {phase === "busted" && (
        <BustedOverlay
          stats={stats}
          bestBank={bestBank}
          onRebuy={rebuy}
        />
      )}
    </div>
  );
}

/* ================= slots & bits ================= */

function Slot({
  idx,
  label,
  card,
  faceUp,
  vec,
  glow,
  suspense,
  setRef,
}: {
  idx: number;
  label: string;
  card: CardData | null;
  faceUp: boolean;
  vec: { x: number; y: number } | null;
  glow: "win" | "lose" | null;
  suspense?: boolean;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  void idx;
  return (
    <div
      ref={setRef}
      className="relative"
      style={{ width: "clamp(64px,15vmin,120px)", aspectRatio: "5 / 7" }}
    >
      <div
        className={`absolute inset-0 rounded-[clamp(6px,1vw,11px)] border-2 border-dashed bg-[#0a3323]/40 ${
          suspense ? "suspense-glow border-[#f6d789]/70" : "border-[#e8c268]/25"
        }`}
      />
      <span className="font-display absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold tracking-[0.28em] text-[#e8c268]/55">
        {label}
      </span>
      {card && <PlayingCard card={card} faceUp={faceUp} dealFrom={vec} glow={glow} />}
    </div>
  );
}

function CoinIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden>
      <circle cx="15" cy="15" r="13" fill="#e3b558" stroke="#8a6420" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="9.5" fill="none" stroke="#8a6420" strokeWidth="1" strokeDasharray="2.4 2" />
      <text
        x="15"
        y="19.5"
        textAnchor="middle"
        fontFamily="Cinzel, serif"
        fontWeight="900"
        fontSize="13"
        fill="#5c3d0c"
      >
        $
      </text>
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H3v6h3l5 4V5z" fill="currentColor" stroke="none" />
      {muted ? (
        <>
          <line x1="16" y1="9" x2="22" y2="15" />
          <line x1="22" y1="9" x2="16" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M18.5 5.5a9.5 9.5 0 0 1 0 13" />
        </>
      )}
    </svg>
  );
}

/* ================= overlays ================= */

function StartOverlay({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#03130c]/90 p-4 backdrop-blur-[2px]">
      <div className="overlay-pop relative w-full max-w-xl border-2 border-[#e8c268]/45 bg-gradient-to-b from-[#0c3a28] to-[#07231a] px-6 py-8 shadow-[0_30px_90px_rgba(0,0,0,.75)] sm:px-10 sm:py-10">
        <div className="pointer-events-none absolute inset-2 border border-[#e8c268]/20" />

        <div className="relative text-center">
          <div className="text-lg tracking-[0.5em] text-[#e8c268]/80">
            <span className="text-[#f3ead6]">♠</span> <span className="text-[#c0354d]">♥</span>{" "}
            <span className="text-[#c0354d]">♦</span> <span className="text-[#f3ead6]">♣</span>
          </div>
          <h1 className="font-display title-glow mt-2 text-4xl font-black tracking-[0.1em] text-[#f6d789] sm:text-5xl">
            IN—BETWEEN
          </h1>
          <p className="mt-2 text-[10px] font-bold tracking-[0.4em] text-[#e8c268]/70 sm:text-[11px]">
            THE CLASSIC CASINO CALL · TABLE LIMITS $5–$1,000
          </p>

          <div className="mx-auto mt-5 flex max-w-md items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#e8c268]/50" />
            <span className="text-[#e8c268]">◆</span>
            <span className="font-display text-[11px] font-bold tracking-[0.3em] text-[#e8c268]/85">
              HOUSE RULES
            </span>
            <span className="text-[#e8c268]">◆</span>
            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#e8c268]/50" />
          </div>

          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-[13px] font-medium leading-snug text-emerald-50/85 sm:text-sm">
            {[
              ["Stack your chips and the shoe deals two cards up.", "#f6d789"],
              ["Call it — the third card lands BETWEEN the two, or OUTSIDE. Winners paid 1:1.", "#f6d789"],
              ["A third card matching either one hits the POST — the house takes the wager.", "#ff9a9a"],
              ["Consecutive cards pay instantly. A pair draws once: break it to win, match it and lose DOUBLE.", "#f6d789"],
            ].map(([t, c], i) => (
              <li key={i} className="flex gap-2.5">
                <span style={{ color: c }}>◆</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onStart}
            className="btn-gold font-display mt-7 rounded-lg px-10 py-3.5 text-lg font-black tracking-[0.2em]"
          >
            TAKE A SEAT
          </button>
          <div className="mt-3 text-[10px] font-semibold tracking-[0.3em] text-[#e8c268]/50">
            PRESS SPACE · $1,000 HOUSE CREDIT
          </div>
        </div>
      </div>
    </div>
  );
}

function BustedOverlay({
  stats,
  bestBank,
  onRebuy,
}: {
  stats: Stats;
  bestBank: number;
  onRebuy: () => void;
}) {
  const winRate = stats.hands > 0 ? Math.round((stats.wins / stats.hands) * 100) : 0;
  const rows: [string, string][] = [
    ["HANDS DEALT", String(stats.hands)],
    ["HANDS WON", String(stats.wins)],
    ["WIN RATE", `${winRate}%`],
    ["BEST STREAK", String(stats.bestStreak)],
    ["BEST BANKROLL", fmt(bestBank)],
    ["REBUYS", String(stats.rebuys)],
  ];
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[#130406]/92 p-4 backdrop-blur-[2px]">
      <div className="overlay-pop relative w-full max-w-md border-2 border-[#c0354d]/60 bg-gradient-to-b from-[#3d0a16] to-[#1c040a] px-6 py-8 text-center shadow-[0_30px_90px_rgba(0,0,0,.8)] sm:px-10">
        <div className="pointer-events-none absolute inset-2 border border-[#c0354d]/30" />
        <h2 className="font-display text-4xl font-black tracking-[0.14em] text-[#ff6b6b] sm:text-5xl" style={{ textShadow: "0 0 24px rgba(192,53,77,.5), 0 2px 0 rgba(0,0,0,.7)" }}>
          BUSTED
        </h2>
        <p className="mt-2 text-[11px] font-semibold tracking-[0.3em] text-[#ffb4b4]/70">
          THE HOUSE THANKS YOU FOR YOUR CHIPS
        </p>

        <div className="mx-auto mt-6 grid max-w-xs grid-cols-2 gap-x-6 gap-y-2.5">
          {rows.map(([k, v]) => (
            <div key={k} className="text-left">
              <div className="text-[9px] font-bold tracking-[0.22em] text-[#ff9a9a]/60">{k}</div>
              <div className="text-lg font-extrabold tabular-nums text-[#ffe9d8]">{v}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onRebuy}
          className="btn-gold font-display mt-7 rounded-lg px-9 py-3.5 text-base font-black tracking-[0.18em]"
        >
          REBUY $1,000
        </button>
        <div className="mt-3 text-[10px] font-semibold tracking-[0.3em] text-[#ff9a9a]/45">
          PRESS SPACE · THE TABLE NEVER SLEEPS
        </div>
      </div>
    </div>
  );
}
