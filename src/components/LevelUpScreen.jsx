import { useEffect, useMemo, useRef } from "react";
import { LEVEL_COUNT, getReward, percentLeft } from "../lib/rewards";

const PARTICLE_COUNT = 36;

// Bursts drawn purely with CSS shapes instead of glyphs.
const SHAPE_BURSTS = ["confetti", "fireworks", "rings", "rays"];

// Deterministic pseudo-random so a level's burst looks the same on every render.
const seeded = (seed) => {
  let x = seed * 9301 + 49297;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
};

const BURST_GLYPHS = {
  stars: ["⭐", "✨", "🌟"],
  hearts: ["💖", "💗", "💜"],
  bubbles: ["🫧", "○", "◌"],
  pixels: ["▪", "▫", "■"],
  snow: ["❄", "❅", "•"],
};

const buildParticles = (reward) => {
  const rand = seeded(reward.level);
  const glyphs = BURST_GLYPHS[reward.burst] ?? [reward.emoji];
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    left: rand() * 100,
    delay: rand() * 1.4,
    duration: 2.4 + rand() * 2.2,
    size: 10 + rand() * 18,
    drift: (rand() - 0.5) * 160,
    color: reward.colors[i % 2],
    glyph: glyphs[i % glyphs.length],
  }));
};

// Level-up overlay: every level has its own colours, emoji, text and particle style.
export default function LevelUpScreen({ level, queuedCount, confirmed, total, onDismiss, onDismissAll }) {
  const reward = getReward(level);
  const left = percentLeft(confirmed, total);
  const particles = useMemo(() => buildParticles(reward), [reward]);
  const openedAt = useRef(0);

  useEffect(() => {
    openedAt.current = performance.now();
    const onKeyDown = (e) => {
      // Ignore key repeat and the keypress that caused the level-up, so holding Enter
      // while confirming rows does not close the screen the instant it appears.
      if (e.repeat || performance.now() - openedAt.current < 700) return;
      if (e.key === "Escape" || e.key === "Enter") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [level, onDismiss]);

  const [from, to] = reward.colors;
  const complete = left === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Новий рівень ${level}: ${reward.title}`}
      className={`lvl-backdrop lvl-burst-${reward.burst}`}
      onClick={onDismiss}
      style={{ "--lvl-from": from, "--lvl-to": to }}
    >
      <div className="lvl-particles" aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="lvl-particle"
            style={{
              left: `${p.left}%`,
              fontSize: `${p.size}px`,
              color: p.color,
              background: SHAPE_BURSTS.includes(reward.burst) ? p.color : "transparent",
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              "--drift": `${p.drift}px`,
            }}
          >
            {SHAPE_BURSTS.includes(reward.burst) ? "" : p.glyph}
          </span>
        ))}
      </div>

      <div className="lvl-card" onClick={(e) => e.stopPropagation()}>
        <div className="lvl-emoji" aria-hidden="true">{reward.emoji}</div>
        <div className="lvl-level">Рівень {level} / {LEVEL_COUNT}</div>
        <h2 className="lvl-title">{reward.title}</h2>
        <p className="lvl-message">{reward.message}</p>
        <div className="lvl-perk">🎁 Нове: {reward.perk}</div>

        <div className="lvl-progress" role="progressbar" aria-valuenow={100 - left} aria-valuemin={0} aria-valuemax={100}>
          <div className="lvl-progress-fill" style={{ width: `${100 - left}%` }} />
        </div>
        <div className="lvl-left">
          {complete ? "Усе перекладено — 100%!" : `Залишилось перекласти: ${left}%`}
        </div>

        <button type="button" className="lvl-button" onClick={onDismiss}>
          Продовжити
        </button>
        {queuedCount > 1 && (
          <button type="button" className="lvl-skip" onClick={onDismissAll}>
            Пропустити решту ({queuedCount - 1})
          </button>
        )}
      </div>
    </div>
  );
}
