"use client";

// 의자 높이 다이얼 — 실제 부스에서 의자를 돌려 높이를 맞추듯, 돌려서 프레이밍(확대·세로 위치)을 조절
import { useRef } from "react";

const MIN_A = -135;
const MAX_A = 135;

export default function ChairDial({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const angle = MIN_A + value * (MAX_A - MIN_A);
  const drag = useRef<{ startAngle: number; startValue: number } | null>(null);

  function pointerAngle(e: React.PointerEvent) {
    const r = ref.current!.getBoundingClientRect();
    return (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180) / Math.PI;
  }

  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
      <svg
        ref={ref}
        viewBox="0 0 100 100"
        width="84"
        height="84"
        role="slider"
        aria-label="의자 높이"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
        style={{ touchAction: "none", cursor: "grab" }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowRight") onChange(Math.min(1, value + 0.05));
          if (e.key === "ArrowDown" || e.key === "ArrowLeft") onChange(Math.max(0, value - 0.05));
        }}
        onPointerDown={(e) => {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {}
          drag.current = { startAngle: pointerAngle(e), startValue: value };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          let d = pointerAngle(e) - drag.current.startAngle;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          onChange(Math.min(1, Math.max(0, drag.current.startValue + d / (MAX_A - MIN_A))));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <defs>
          <radialGradient id="cd-seat" cx="0.4" cy="0.35">
            <stop offset="0" stopColor="#f6efdf" />
            <stop offset="1" stopColor="#c9bea6" />
          </radialGradient>
        </defs>
        {/* 눈금 */}
        {Array.from({ length: 11 }, (_, i) => {
          const a = ((MIN_A + (i * (MAX_A - MIN_A)) / 10) * Math.PI) / 180;
          return <line key={i} x1={50 + Math.sin(a) * 44} y1={50 - Math.cos(a) * 44} x2={50 + Math.sin(a) * 48} y2={50 - Math.cos(a) * 48} stroke="#EDE4D0" strokeOpacity={0.5} strokeWidth="2" />;
        })}
        {/* 둥근 의자 좌판을 위에서 본 모양 */}
        <g transform={`rotate(${angle} 50 50)`}>
          <circle cx="50" cy="50" r="36" fill="url(#cd-seat)" stroke="#8a9096" strokeWidth="3" />
          <circle cx="50" cy="50" r="28" fill="none" stroke="#b5a988" strokeWidth="1" />
          <circle cx="50" cy="50" r="5" fill="#8a9096" />
          <rect x="47.5" y="16" width="5" height="14" rx="2.5" fill="#7A1E2C" />
        </g>
      </svg>
      <span style={{ fontSize: 12, opacity: 0.75 }}>의자 높이 ↕</span>
    </div>
  );
}
