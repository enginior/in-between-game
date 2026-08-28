/* Tiny WebAudio synth for table sounds — no assets, all procedural. */

let ctx: AudioContext | null = null;
let muted = false;

try {
  muted = localStorage.getItem("ib-muted") === "1";
} catch {
  /* ignore */
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem("ib-muted", m ? "1" : "0");
  } catch {
    /* ignore */
  }
}

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface ToneOpts {
  f: number;
  f2?: number;
  t?: OscillatorType;
  d?: number;
  g?: number;
  at?: number;
}

function tone({ f, f2, t = "sine", d = 0.12, g = 0.07, at = 0 }: ToneOpts): void {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const v = c.createGain();
    const t0 = c.currentTime + at;
    o.type = t;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t0 + d);
    v.gain.setValueAtTime(0, t0);
    v.gain.linearRampToValueAtTime(g, t0 + 0.012);
    v.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(v);
    v.connect(c.destination);
    o.start(t0);
    o.stop(t0 + d + 0.06);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  chip(): void {
    tone({ f: 2100, t: "square", d: 0.045, g: 0.045 });
    tone({ f: 2700, t: "square", d: 0.05, g: 0.04, at: 0.035 });
  },
  card(): void {
    tone({ f: 540, f2: 170, t: "triangle", d: 0.11, g: 0.06 });
  },
  flip(): void {
    tone({ f: 740, f2: 1300, t: "sine", d: 0.09, g: 0.055 });
  },
  click(): void {
    tone({ f: 660, t: "triangle", d: 0.05, g: 0.045 });
  },
  shuffle(): void {
    for (let i = 0; i < 6; i++) {
      tone({ f: 900 + Math.random() * 1000, t: "square", d: 0.03, g: 0.024, at: i * 0.045 });
    }
  },
  win(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ f, t: "triangle", d: 0.16, g: 0.06, at: i * 0.09 })
    );
    tone({ f: 1568, t: "sine", d: 0.32, g: 0.045, at: 0.4 });
  },
  coin(): void {
    [1800, 2300, 2900].forEach((f, i) => tone({ f, t: "square", d: 0.06, g: 0.035, at: i * 0.05 }));
  },
  lose(): void {
    tone({ f: 240, f2: 92, t: "sawtooth", d: 0.4, g: 0.05 });
    tone({ f: 132, f2: 58, t: "triangle", d: 0.5, g: 0.045, at: 0.05 });
  },
};
