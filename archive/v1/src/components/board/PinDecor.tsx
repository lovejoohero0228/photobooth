// 고정 도구: 압정 · 마스킹테이프 · 작은 나무집게 · 하트 자석
import type { PinType } from "@/lib/types";

export default function PinDecor({ type, size = 44, style }: { type: PinType; size?: number; style?: React.CSSProperties }) {
  const common: React.CSSProperties = { position: "absolute", left: "50%", top: 0, transform: "translate(-50%, -45%)", pointerEvents: "none", overflow: "visible", ...style };
  switch (type) {
    case "pushpin":
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" style={common} aria-hidden>
          <ellipse cx="22" cy="26" rx="8" ry="4" fill="rgba(0,0,0,.3)" />
          <circle cx="20" cy="20" r="9" fill="#7A1E2C" />
          <circle cx="20" cy="20" r="9" fill="url(#pd-shine)" />
          <circle cx="17" cy="17" r="2.6" fill="#ffffff" opacity=".55" />
          <defs>
            <radialGradient id="pd-shine" cx=".35" cy=".35">
              <stop offset="0" stopColor="#c8475a" />
              <stop offset="1" stopColor="#5a1220" stopOpacity="0.9" />
            </radialGradient>
          </defs>
        </svg>
      );
    case "tape":
      return (
        <svg width={size * 1.6} height={size * 0.7} viewBox="0 0 64 28" style={{ ...common, transform: "translate(-50%, -40%) rotate(-4deg)" }} aria-hidden>
          <path d="M2 4 L62 2 L60 26 L4 25 L6 18 L2 14 L5 9 Z" fill="#e9dcb4" opacity=".82" />
          <path d="M2 4 L62 2" stroke="#fff" strokeOpacity=".4" />
        </svg>
      );
    case "clip":
      return (
        <svg width={size * 0.55} height={size * 1.2} viewBox="0 0 22 48" style={{ ...common, transform: "translate(-50%, -55%)" }} aria-hidden>
          <rect x="3" y="2" width="16" height="44" rx="2" fill="#b98b57" />
          <rect x="3" y="2" width="7" height="44" rx="2" fill="#a37441" />
          <rect x="1" y="20" width="20" height="5" rx="1.5" fill="#9aa0a6" />
        </svg>
      );
    case "magnet":
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" style={common} aria-hidden>
          <path d="M20 33 C6 23 5 13 12 10 C16 8 19 11 20 13 C21 11 24 8 28 10 C35 13 34 23 20 33 Z" fill="rgba(0,0,0,.25)" transform="translate(1.5 2)" />
          <path d="M20 33 C6 23 5 13 12 10 C16 8 19 11 20 13 C21 11 24 8 28 10 C35 13 34 23 20 33 Z" fill="#b8323f" />
          <path d="M12 14 C13 12 15 12 16 13" stroke="#fff" strokeOpacity=".6" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      );
  }
}
