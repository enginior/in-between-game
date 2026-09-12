import { useEffect, useRef } from "react";
import type { ReactElement } from "react";

/* Lightweight particle canvas + floating text layer, driven imperatively. */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  kind: "spark" | "shard";
  rot: number;
  vr: number;
}

let push: ((p: Spark[]) => void) | null = null;

export function burst(x: number, y: number, colors: string[], count = 26, power = 6): void {
  if (!push) return;
  const arr: Spark[] = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (0.35 + Math.random()) * power;
    arr.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 2.2,
      life: 0,
      max: 40 + Math.random() * 34,
      size: 2 + Math.random() * 3.4,
      color: colors[i % colors.length],
      grav: 0.16,
      kind: "spark",
      rot: 0,
      vr: 0,
    });
  }
  push(arr);
}

export function coinShower(x: number, y: number): void {
  if (!push) return;
  const colors = ["#f6d789", "#e3b558", "#fff3cd", "#c9973f"];
  const arr: Spark[] = [];
  for (let i = 0; i < 36; i++) {
    arr.push({
      x: x + (Math.random() - 0.5) * 130,
      y: y - 20 - Math.random() * 60,
      vx: (Math.random() - 0.5) * 3.6,
      vy: -3 - Math.random() * 5,
      life: 0,
      max: 62 + Math.random() * 40,
      size: 3 + Math.random() * 4,
      color: colors[i % colors.length],
      grav: 0.22,
      kind: Math.random() > 0.45 ? "shard" : "spark",
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.5,
    });
  }
  push(arr);
}

export function floatText(x: number, y: number, text: string, cls: "ft-gold" | "ft-red"): void {
  const host = document.getElementById("fx-text-host");
  if (!host) return;
  const el = document.createElement("div");
  el.className = `float-text ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  host.appendChild(el);
  window.setTimeout(() => el.remove(), 1400);
}

export function ParticleLayer(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    let parts: Spark[] = [];
    push = (p) => {
      parts = parts.concat(p);
      if (parts.length > 420) parts = parts.slice(-420);
    };

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const loop = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts = parts.filter((p) => p.life < p.max);
      for (const p of parts) {
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.grav;
        p.vx *= 0.985;
        p.rot += p.vr;
        const k = 1 - p.life / p.max;
        g.globalAlpha = Math.max(0, k);
        g.fillStyle = p.color;
        if (p.kind === "shard") {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          g.fillRect(-p.size, -p.size * 0.6, p.size * 2, p.size * 1.2);
          g.restore();
        } else {
          g.beginPath();
          g.arc(p.x, p.y, p.size * k + 0.4, 0, Math.PI * 2);
          g.fill();
        }
      }
      g.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      push = null;
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0"
        style={{ width: "100vw", height: "100vh", zIndex: 60 }}
      />
      <div
        id="fx-text-host"
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex: 61 }}
      />
    </>
  );
}
