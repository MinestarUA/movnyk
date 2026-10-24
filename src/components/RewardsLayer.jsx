import { useEffect, useRef } from "react";

// Purely decorative overlay for rewards mode. Everything is pointer-events: none and
// sits below dialogs; each effect switches on at its level (see getReward in rewards.js).
const PALETTE = ["#ff5fa2", "#b25ef0", "#ffd84d", "#4fd1ff", "#63d68a"];
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const makeAmbient = (count, make) => Array.from({ length: count }, make);

const createAmbient = (w, h) => ({
  stars: makeAmbient(45, () => ({ x: rand(0, w), y: rand(0, h), r: rand(0.6, 1.6), phase: rand(0, 6.28) })),
  fireflies: makeAmbient(14, () => ({ x: rand(0, w), y: rand(0, h), a: rand(0, 6.28), phase: rand(0, 6.28) })),
  petals: makeAmbient(14, () => ({ x: rand(0, w), y: rand(-h, 0), s: rand(4, 8), v: rand(0.4, 1), sway: rand(0, 6.28) })),
  bubbles: makeAmbient(12, () => ({ x: rand(0, w), y: rand(0, h), r: rand(3, 9), v: rand(0.3, 0.8), phase: rand(0, 6.28) })),
  dust: makeAmbient(30, () => ({ x: rand(0, w), y: rand(0, h), vx: rand(-0.15, 0.15), vy: rand(-0.1, 0.2) })),
  parallax: makeAmbient(25, () => ({ x: rand(0, w), y: rand(0, h), depth: rand(0.01, 0.04), r: rand(1, 2.5) })),
});

export default function RewardsLayer({ level }) {
  const canvasRef = useRef(null);
  const butterflyRef = useRef(null);
  const ringRef = useRef(null);
  const levelRef = useRef(level);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = 0;
    let h = 0;
    let ambient = null;
    let rafId = 0;
    let lastSpark = 0;
    let nextFirework = performance.now() + 6000;
    let nextShootingStar = performance.now() + 4000;
    const mouse = { x: -100, y: -100 };
    const follower = { bx: -100, by: -100, rx: -100, ry: -100 };
    let particles = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ambient = createAmbient(w, h);
    };

    const burst = (x, y, count, kind) => {
      for (let i = 0; i < count; i += 1) {
        const angle = rand(0, 6.28);
        const speed = rand(1, kind === "firework" ? 4.5 : 3.5);
        particles.push({
          kind: kind === "firework" ? "spark" : "confetti",
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (kind === "firework" ? 0 : 1.5),
          life: 0,
          max: kind === "firework" ? rand(40, 70) : rand(30, 50),
          size: rand(2, 5),
          color: pick(PALETTE),
        });
      }
    };

    const onMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      const now = performance.now();
      if (levelRef.current >= 2 && now - lastSpark > 28) {
        lastSpark = now;
        particles.push({
          kind: "spark", x: mouse.x, y: mouse.y,
          vx: rand(-0.6, 0.6), vy: rand(-0.6, 0.6),
          life: 0, max: 28, size: rand(1.5, 3.2), color: pick(PALETTE),
        });
      }
    };

    const onClick = (e) => {
      if (levelRef.current >= 3) {
        particles.push({ kind: "ripple", x: e.clientX, y: e.clientY, life: 0, max: 32, size: 6, color: "#b25ef0" });
      }
      if (levelRef.current >= 13) burst(e.clientX, e.clientY, 14, "confetti");
    };

    const drawParticle = (p) => {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.max(0, 1 - t);
      if (p.kind === "ripple") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + t * 34, 0, 6.28);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        if (p.kind === "confetti") ctx.fillRect(p.x, p.y, p.size, p.size * 0.6);
        else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, 6.28);
          ctx.fill();
        }
      }
    };

    const drawAmbient = (lv, time) => {
      const a = ambient;
      if (lv >= 4) {
        ctx.fillStyle = "#fff";
        a.stars.forEach((s) => {
          ctx.globalAlpha = 0.12 + 0.2 * (0.5 + 0.5 * Math.sin(time / 900 + s.phase));
          ctx.fillRect(s.x, s.y, s.r, s.r);
        });
      }
      if (lv >= 28) {
        ctx.fillStyle = "#c471f5";
        ctx.globalAlpha = 0.2;
        a.parallax.forEach((d) => {
          ctx.beginPath();
          ctx.arc(d.x + (mouse.x - w / 2) * d.depth, d.y + (mouse.y - h / 2) * d.depth, d.r, 0, 6.28);
          ctx.fill();
        });
      }
      if (lv >= 7) {
        a.fireflies.forEach((f) => {
          f.a += rand(-0.15, 0.15);
          f.x = (f.x + Math.cos(f.a) * 0.4 + w) % w;
          f.y = (f.y + Math.sin(f.a) * 0.4 + h) % h;
          ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(time / 500 + f.phase));
          ctx.fillStyle = "#d6ff6e";
          ctx.shadowColor = "#d6ff6e";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(f.x, f.y, 2, 0, 6.28);
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }
      if (lv >= 12) {
        ctx.fillStyle = "#ffb3d1";
        ctx.globalAlpha = 0.45;
        a.petals.forEach((p) => {
          p.y += p.v;
          p.sway += 0.02;
          p.x += Math.sin(p.sway) * 0.6;
          if (p.y > h + 10) { p.y = -10; p.x = rand(0, w); }
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.s, p.s * 0.55, p.sway, 0, 6.28);
          ctx.fill();
        });
      }
      if (lv >= 17) {
        ctx.strokeStyle = "#9fe8e0";
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        a.bubbles.forEach((b) => {
          b.y -= b.v;
          b.phase += 0.02;
          if (b.y < -10) { b.y = h + 10; b.x = rand(0, w); }
          ctx.beginPath();
          ctx.arc(b.x + Math.sin(b.phase) * 6, b.y, b.r, 0, 6.28);
          ctx.stroke();
        });
      }
      if (lv >= 26) {
        ctx.fillStyle = "#cfe3ff";
        ctx.globalAlpha = 0.25;
        a.dust.forEach((d) => {
          d.x = (d.x + d.vx + w) % w;
          d.y = (d.y + d.vy + h) % h;
          ctx.fillRect(d.x, d.y, 2, 2);
        });
      }
    };

    const frame = (time) => {
      rafId = requestAnimationFrame(frame);
      if (document.hidden) return;
      const lv = levelRef.current;
      ctx.clearRect(0, 0, w, h);
      drawAmbient(lv, time);

      if (lv >= 20 && time > nextShootingStar) {
        nextShootingStar = time + rand(7000, 14000);
        particles.push({ kind: "star", x: rand(w * 0.3, w), y: rand(0, h * 0.3), life: 0, max: 36 });
      }
      if (lv >= 25 && time > nextFirework) {
        nextFirework = time + rand(9000, 16000);
        burst(pick([rand(60, 200), w - rand(60, 200)]), rand(60, 200), 40, "firework");
      }

      particles = particles.filter((p) => p.life < p.max);
      particles.forEach((p) => {
        p.life += 1;
        if (p.kind === "star") {
          const x = p.x - p.life * 9;
          const y = p.y + p.life * 5;
          ctx.globalAlpha = 1 - p.life / p.max;
          ctx.strokeStyle = "#fff6c9";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 40, y - 22);
          ctx.stroke();
          return;
        }
        if (p.kind !== "ripple") {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.kind === "confetti" ? 0.12 : 0.03;
        }
        drawParticle(p);
      });
      ctx.globalAlpha = 1;

      // Butterfly and ring lag behind the cursor for a soft follow effect.
      follower.bx += (mouse.x - follower.bx) * 0.04;
      follower.by += (mouse.y - follower.by) * 0.04;
      follower.rx += (mouse.x - follower.rx) * 0.18;
      follower.ry += (mouse.y - follower.ry) * 0.18;
      if (butterflyRef.current) {
        const flap = Math.sin(time / 90) * 6;
        butterflyRef.current.style.transform = `translate(${follower.bx + 14}px, ${follower.by + 14 + flap}px)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${follower.rx - 14}px, ${follower.ry - 14}px)`;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("click", onClick, { passive: true });
    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div className="rw-layer" aria-hidden="true">
      {level >= 8 && <div className={`rw-aurora ${level >= 30 ? "rw-aurora-gold" : ""}`} />}
      {level >= 24 && <div className="rw-daynight" />}
      {level >= 22 && <div className="rw-vignette" />}
      {level >= 29 && <div className="rw-rays" />}
      {level >= 11 && <div className={`rw-topline ${level >= 16 ? "rw-topline-rainbow" : ""}`} />}
      {level >= 19 && <div className="rw-moon">🌙</div>}
      <canvas ref={canvasRef} className="rw-canvas" />
      {level >= 1 && (
        <div className="rw-pet rw-duck">
          {level >= 21 && <span className="rw-crown">👑</span>}
          🦆
        </div>
      )}
      {level >= 23 && <div className="rw-pet rw-duckling">🐥</div>}
      {level >= 15 && <div className="rw-pet rw-pig">🐷</div>}
      {level >= 9 && <div ref={butterflyRef} className="rw-follow">🦋</div>}
      {level >= 18 && <div ref={ringRef} className="rw-ring" />}
    </div>
  );
}
