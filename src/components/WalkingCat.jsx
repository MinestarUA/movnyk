import { useEffect, useRef, useState } from "react";
import { restBucket, catStep } from "./catStep.js";

// Animated progress indicator: an SVG cat that walks along a ground line.
// Position snaps to 5% marks; confirming a row without crossing a mark bobs the
// cat in place; crossing a mark plays a walk stride; 100% swaps to a happy pose.
export default function WalkingCat({ progress = 0, confirmedCount = 0, total }) {
  const rest = restBucket(progress);
  const complete = progress >= 100;
  const prevRestRef = useRef(rest);
  const prevCountRef = useRef(confirmedCount);
  const [anim, setAnim] = useState({ move: "none", pose: "walking" });

  useEffect(() => {
    const prevRest = prevRestRef.current;
    const countChanged = confirmedCount !== prevCountRef.current;
    const step = catStep(prevRest, rest, complete, countChanged);
    prevRestRef.current = rest;
    prevCountRef.current = confirmedCount;
    setAnim(step);
    if (step.move !== "none") {
      // Clear the class once the animation has run so the same move can retrigger.
      const t = setTimeout(() => setAnim((a) => ({ ...a, move: "none" })), 480);
      return () => clearTimeout(t);
    }
  }, [rest, confirmedCount, complete]);

  const valueNow = confirmedCount != null ? confirmedCount : progress;
  const valueMax = total != null ? total || 1 : 100;

  return (
    <div
      role="progressbar"
      aria-label="Прогрес перекладу"
      aria-valuenow={valueNow}
      aria-valuemax={valueMax}
      style={{
        flex: 1,
        minWidth: "150px",
        marginRight: "6px",
        position: "relative",
        height: "22px",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <style>{catKeyframes}</style>

      {/* Ground line = the track the cat walks on */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "3px",
          height: "2px",
          borderRadius: "2px",
          background: "var(--color-neutral-800)",
          overflow: "hidden",
        }}
      >
        {/* Pink trail up to the cat = distance covered */}
        <div
          style={{
            height: "100%",
            width: `${Math.max(progress, total ? 0.6 : 0)}%`,
            background: "linear-gradient(90deg,#ff5fa2,#c860e8)",
            transition: "width 0.35s ease",
          }}
        />
      </div>

      {/* The cat, positioned along the track by rest bucket */}
      <div
        data-pose={anim.pose}
        data-move={anim.move}
        className={
          "cat" +
          (anim.move === "hop" ? " cat--hop" : "") +
          (anim.move === "walk-forward" || anim.move === "walk-backward" ? " cat--walk" : "") +
          (anim.pose === "happy" ? " cat--happy" : "")
        }
        style={{
          position: "absolute",
          bottom: "5px",
          // Traverse the full track: 0% → flush left, 100% → flush right
          // (minus the cat's own width so it never clips or overlaps the counter).
          left: `calc(${rest} * (100% - 22px) / 100)`,
          transition: "left 0.42s cubic-bezier(.4,1.3,.5,1)",
          width: "22px",
          height: "16px",
        }}
      >
        <CatSvg pose={anim.pose} />
      </div>
    </div>
  );
}

// Inline SVG cat. Walking pose = tail level, eyes o o. Happy pose = tail up,
// eyes ^^. Legs are the four <line>s animated by the .cat--walk keyframes.
function CatSvg({ pose }) {
  const happy = pose === "happy";
  return (
    <svg viewBox="0 0 22 16" width="22" height="16" aria-hidden="true" style={{ overflow: "visible", transform: "scaleX(-1)" }}>
      {/* body */}
      <ellipse cx="10" cy="8" rx="7" ry="4.2" fill="#f7a8cf" />
      {/* head */}
      <circle cx="3.5" cy="6.5" r="3.2" fill="#f7a8cf" />
      {/* ears */}
      <path d="M1.2 4.2 L2 1.5 L3.4 3.8 Z" fill="#f7a8cf" />
      <path d="M4 3.6 L5.4 1.4 L6 4.2 Z" fill="#f7a8cf" />
      {/* eyes */}
      {happy ? (
        <>
          <path d="M2 6 q0.8 -1 1.6 0" stroke="#3a2140" strokeWidth="0.7" fill="none" strokeLinecap="round" />
          <path d="M4.2 6 q0.8 -1 1.6 0" stroke="#3a2140" strokeWidth="0.7" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="2.9" cy="6.4" r="0.6" fill="#3a2140" />
          <circle cx="5" cy="6.4" r="0.6" fill="#3a2140" />
        </>
      )}
      {/* tail */}
      <path
        d={happy ? "M16.5 7 q4 -1 3 -5.5" : "M16.5 8 q4 0 4.5 -2.5"}
        stroke="#f7a8cf"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      {/* legs (alternating a/b pairs) */}
      <g stroke="#e07bb0" strokeWidth="1.4" strokeLinecap="round">
        <line className="leg leg-a" x1="6" y1="11.5" x2="6" y2="15" />
        <line className="leg leg-b" x1="9" y1="11.5" x2="9" y2="15" />
        <line className="leg leg-a" x1="12" y1="11.5" x2="12" y2="15" />
        <line className="leg leg-b" x1="15" y1="11.5" x2="15" y2="15" />
      </g>
    </svg>
  );
}

const catKeyframes = `
@keyframes cat-hop { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-4px); } }
@keyframes cat-bounce { 0%,100% { transform: translateY(0); } 30% { transform: translateY(-5px); } 60% { transform: translateY(-1px); } }
@keyframes leg-swing-a { 0%,100% { transform: rotate(14deg); } 50% { transform: rotate(-14deg); } }
@keyframes leg-swing-b { 0%,100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
.cat--hop { animation: cat-hop 0.42s ease; }
.cat--happy { animation: cat-bounce 0.5s ease; }
.cat--walk .leg-a { animation: leg-swing-a 0.21s linear 2; transform-origin: top; transform-box: fill-box; }
.cat--walk .leg-b { animation: leg-swing-b 0.21s linear 2; transform-origin: top; transform-box: fill-box; }
@media (prefers-reduced-motion: reduce) {
  .cat { transition: none !important; }
  .cat--hop, .cat--happy { animation: none !important; }
  .cat--walk .leg-a, .cat--walk .leg-b { animation: none !important; }
}
`;
