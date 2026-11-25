// 포토부스 기계 외관 — 레퍼런스 4장의 공통 요소를 조합한 오리지널 일러스트 (SVG + CSS 애니메이션)
// 마키 조명 간판 · 세로 줄무늬 원목 외장 · 반쯤 걷힌 버건디 커튼 · 짙은 초록 내벽 · 기하학 체크 바닥 ·
// 둥근 의자 · 샘플 스트립 창 · 동전 투입구 + 5 MIN · 크롬 배출구(T자 손잡이) + PHOTOS DELIVERED HERE 명판

import styles from "./BoothMachine.module.css";

export type BoothState = "idle" | "coin" | "open" | "flash" | "dispensing";

export const BOOTH_VIEWBOX = { w: 420, h: 780 };
/** 배출구 안쪽 슬롯 (HTML 오버레이 배치용, viewBox 좌표) */
export const DISPENSER_SLOT = { x: 55, y: 486, w: 36, h: 100 };

interface Props {
  state?: BoothState;
  decor?: boolean;
  className?: string;
  /** 간판 전구 깜빡임 끄기(아주 작게 그릴 때) */
  still?: boolean;
}

const SIGN = { x: 62, y: 18, w: 296, h: 96 };

function bulbPositions() {
  const pts: [number, number][] = [];
  const { x, y, w, h } = SIGN;
  const step = 18.5;
  for (let i = 0; i <= Math.round(w / step); i++) pts.push([x + (i * w) / Math.round(w / step), y]);
  for (let i = 1; i <= Math.round(h / step); i++) pts.push([x + w, y + (i * h) / Math.round(h / step)]);
  for (let i = Math.round(w / step) - 1; i >= 0; i--) pts.push([x + (i * w) / Math.round(w / step), y + h]);
  for (let i = Math.round(h / step) - 1; i >= 1; i--) pts.push([x, y + (i * h) / Math.round(h / step)]);
  return pts;
}
const BULBS = bulbPositions();

export default function BoothMachine({ state = "idle", decor = false, className, still }: Props) {
  const curtainScale = state === "open" ? 0.22 : state === "flash" ? 1 : 0.55;
  return (
    <svg
      viewBox={`0 0 ${BOOTH_VIEWBOX.w} ${BOOTH_VIEWBOX.h}`}
      className={`${styles.booth} ${className ?? ""}`}
      data-state={state}
      role="img"
      aria-label="빈티지 흑백 포토부스"
    >
      <defs>
        <pattern id="bm-wood" width="14" height="40" patternUnits="userSpaceOnUse">
          <rect width="14" height="40" fill="#8B5A33" />
          <rect x="0" width="1.6" height="40" fill="#5f3a1d" opacity="0.55" />
          <rect x="6" width="5" height="40" fill="#9a6a3f" opacity="0.5" />
          <path d="M3 0 Q4 20 3 40" stroke="#6b4224" strokeWidth="0.6" fill="none" opacity="0.5" />
        </pattern>
        <pattern id="bm-floor" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#EDE4D0" />
          <path d="M0 0 H8 V8 H0 Z M8 8 H16 V16 H8 Z M8 0 L16 0 L8 8 Z M0 8 L8 16 L0 16 Z" fill="#1A1714" />
        </pattern>
        <linearGradient id="bm-chrome" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="0.45" stopColor="#C8CCD1" />
          <stop offset="0.55" stopColor="#9da3aa" />
          <stop offset="1" stopColor="#e2e5e8" />
        </linearGradient>
        <linearGradient id="bm-chrome-h" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#9da3aa" />
          <stop offset="0.3" stopColor="#f4f6f8" />
          <stop offset="0.7" stopColor="#C8CCD1" />
          <stop offset="1" stopColor="#8a9096" />
        </linearGradient>
        <linearGradient id="bm-brass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c9a95c" />
          <stop offset="1" stopColor="#8d7337" />
        </linearGradient>
        <linearGradient id="bm-fold" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#4a0f1a" />
          <stop offset="0.35" stopColor="#8e2636" />
          <stop offset="0.6" stopColor="#7A1E2C" />
          <stop offset="1" stopColor="#3d0c15" />
        </linearGradient>
        <radialGradient id="bm-glow">
          <stop offset="0" stopColor="#fff3cf" />
          <stop offset="0.5" stopColor="#F2C46B" />
          <stop offset="1" stopColor="#F2C46B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bm-inner-light" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff6dd" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff6dd" stopOpacity="0" />
        </linearGradient>
        <filter id="bm-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.16" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <clipPath id="bm-shape">
          <rect x={SIGN.x - 8} y={SIGN.y - 8} width={SIGN.w + 16} height={SIGN.h + 16} rx="8" />
          <rect x="20" y="126" width="380" height="600" />
        </clipPath>
        <clipPath id="bm-door">
          <rect x="170" y="170" width="168" height="520" />
        </clipPath>
      </defs>

      {/* 바닥 그림자 */}
      <ellipse cx="210" cy="738" rx="215" ry="16" fill="rgba(0,0,0,0.35)" />

      {/* ── 간판 지지대 */}
      <rect x="100" y="112" width="6" height="18" fill="url(#bm-chrome-h)" />
      <rect x="314" y="112" width="6" height="18" fill="url(#bm-chrome-h)" />

      {/* ── 마키 간판 */}
      <g className={styles.sign}>
        <rect x={SIGN.x - 8} y={SIGN.y - 8} width={SIGN.w + 16} height={SIGN.h + 16} rx="8" fill="url(#bm-chrome)" />
        <rect x={SIGN.x} y={SIGN.y} width={SIGN.w} height={SIGN.h} rx="4" fill="#F4E9CF" />
        <rect x={SIGN.x} y={SIGN.y} width={SIGN.w} height={SIGN.h} rx="4" fill="url(#bm-inner-light)" />
        <text x="210" y="44" textAnchor="middle" className={styles.signSmall}>
          ★ BLACK &amp; WHITE · DEVELOPED WHILE YOU WAIT ★
        </text>
        <text x="210" y="98" textAnchor="middle" className={styles.signBig}>
          PHOTOS
        </text>
        {BULBS.map(([bx, by], i) => (
          <g key={i} className={still ? undefined : styles.bulb} style={{ animationDelay: `${(i % 3) * 0.35}s` }}>
            <circle cx={bx} cy={by} r="7" fill="url(#bm-glow)" className={styles.bulbGlow} />
            <circle cx={bx} cy={by} r="2.6" fill="#fff1c4" />
          </g>
        ))}
      </g>

      {/* ── 본체 */}
      <rect x="20" y="126" width="380" height="12" rx="2" fill="url(#bm-chrome)" />
      <rect x="22" y="138" width="376" height="562" fill="url(#bm-wood)" />
      {/* 문틀 크롬 */}
      <rect x="164" y="164" width="180" height="532" fill="url(#bm-chrome-h)" />

      {/* ── 부스 내부 */}
      <g clipPath="url(#bm-door)">
        <rect x="170" y="170" width="168" height="250" fill="#EDE4D0" />
        <rect x="170" y="420" width="168" height="200" fill="#1F3A2E" />
        <rect x="170" y="416" width="168" height="6" fill="#16291f" />
        <rect x="170" y="616" width="168" height="5" fill="#16291f" />
        {/* 바닥 타일 */}
        <rect x="170" y="620" width="168" height="70" fill="url(#bm-floor)" />
        <rect x="170" y="620" width="168" height="70" fill="rgba(0,0,0,0.18)" />
        {/* 내부 조명 */}
        <rect x="170" y="170" width="168" height="520" fill="url(#bm-inner-light)" />
        {/* 둥근 의자 */}
        <rect x="284" y="562" width="7" height="104" fill="url(#bm-chrome-h)" />
        <ellipse cx="287.5" cy="668" rx="20" ry="5" fill="#8a9096" />
        <ellipse cx="287.5" cy="558" rx="32" ry="9" fill="#d8cfbd" />
        <ellipse cx="287.5" cy="555" rx="32" ry="8" fill="#EDE4D0" />
        {/* 플래시가 새어 나옴 */}
        <rect x="170" y="170" width="168" height="520" fill="#fff" className={styles.flash} />
      </g>

      {/* ── 커튼 레일 + 버건디 벨벳 커튼 */}
      <rect x="166" y="168" width="176" height="5" rx="2" fill="url(#bm-chrome-h)" />
      <g className={styles.curtain} style={{ transform: `scaleX(${curtainScale})` }}>
        <g className={styles.sway}>
          {Array.from({ length: 9 }, (_, i) => (
            <path
              key={i}
              d={`M ${170 + i * 18.7} 172 h 19 v 498 q -9.5 ${i % 2 ? 8 : 4} -19 0 Z`}
              fill="url(#bm-fold)"
            />
          ))}
          <rect x="170" y="172" width="168" height="10" fill="#561421" />
        </g>
      </g>

      {/* ── 왼쪽 패널: 샘플 스트립 창 */}
      <rect x="34" y="178" width="122" height="176" rx="3" fill="url(#bm-chrome)" />
      <rect x="40" y="184" width="110" height="164" fill="#1A1714" />
      <text x="95" y="203" textAnchor="middle" className={styles.plateText} fontSize="10" fill="#EDE4D0">
        TAKE YOUR OWN
      </text>
      <text x="95" y="216" textAnchor="middle" className={styles.plateText} fontSize="10" fill="#F2C46B">
        PORTRAITS
      </text>
      {[0, 1, 2].map((s) => (
        <g key={s} transform={`translate(${52 + s * 32} 226) rotate(${(s - 1) * 3} 12 55)`}>
          <rect width="24" height="104" fill="#EDE4D0" />
          {[0, 1, 2, 3].map((f) => (
            <g key={f}>
              <rect x="3" y={3 + f * 25} width="18" height="22" fill={["#6d6862", "#8b857d", "#5b5651", "#7a746d"][(f + s) % 4]} />
              <circle cx="12" cy={11 + f * 25} r="4.2" fill="#c9c2b6" />
              <path d={`M5 ${25 + f * 25} q7 -9 14 0`} fill="#3c3834" />
            </g>
          ))}
        </g>
      ))}

      {/* ── 동전 투입구 + 5 MIN */}
      <g>
        <rect x="44" y="378" width="58" height="72" rx="4" fill="url(#bm-chrome)" />
        <rect x="68" y="390" width="10" height="34" rx="3" fill="#1A1714" />
        <text x="73" y="440" textAnchor="middle" className={styles.plateText} fontSize="8" fill="#1A1714">
          COIN
        </text>
        <g className={styles.coin}>
          <circle cx="73" cy="372" r="11" fill="#d9b65a" stroke="#a68535" strokeWidth="2" />
          <circle cx="73" cy="372" r="6" fill="none" stroke="#f3dc95" strokeWidth="1.2" />
        </g>
        <rect x="110" y="388" width="44" height="30" rx="2" fill="#F4F1EA" stroke="#1A1714" strokeWidth="2" />
        <text x="122" y="412" textAnchor="middle" className={styles.signText} fontSize="22" fill="#1A1714">
          5
        </text>
        <text x="141" y="411" textAnchor="middle" className={styles.plateText} fontSize="8" fill="#1A1714">
          MIN
        </text>
      </g>

      {/* ── 크롬 배출구 + T자 손잡이 + 명판 */}
      <g>
        <rect x="46" y="474" width="54" height="124" rx="5" fill="url(#bm-chrome-h)" />
        <rect x={DISPENSER_SLOT.x} y={DISPENSER_SLOT.y} width={DISPENSER_SLOT.w} height={DISPENSER_SLOT.h} rx="2" fill="#2b2925" />
        <rect x={DISPENSER_SLOT.x + 2} y={DISPENSER_SLOT.y + 2} width={DISPENSER_SLOT.w - 4} height="10" fill="#45423c" />
        {/* T자 손잡이 */}
        <rect x="58" y="506" width="30" height="5" rx="2.5" fill="url(#bm-chrome)" />
        <rect x="71" y="510" width="4.5" height="72" rx="2" fill="url(#bm-chrome-h)" />
        <rect x="106" y="482" width="54" height="54" rx="3" fill="url(#bm-chrome)" stroke="#9da3aa" />
        {[
          [111, 487],
          [155, 487],
          [111, 531],
          [155, 531],
        ].map(([sx, sy], i) => (
          <g key={i}>
            <circle cx={sx} cy={sy} r="2.4" fill="#aeb3b9" stroke="#7d838a" strokeWidth="0.6" />
            <path d={`M${sx - 1.6} ${sy} h3.2 M${sx} ${sy - 1.6} v3.2`} stroke="#6b7076" strokeWidth="0.6" />
          </g>
        ))}
        <text x="133" y="503" textAnchor="middle" className={styles.plateText} fontSize="11" fill="#1A1714" fontWeight={700}>
          PHOTOS
        </text>
        <text x="133" y="515" textAnchor="middle" className={styles.plateText} fontSize="7.5" fill="#1A1714">
          DELIVERED
        </text>
        <text x="133" y="526" textAnchor="middle" className={styles.plateText} fontSize="7.5" fill="#1A1714">
          HERE
        </text>
      </g>

      {/* ── 오른쪽 패널: 세로 PHOTOS 사인 */}
      <rect x="350" y="190" width="40" height="396" rx="3" fill="url(#bm-chrome)" />
      <rect x="354" y="194" width="32" height="388" fill="#F4F1EA" />
      {"PHOTOS".split("").map((ch, i) => (
        <text key={i} x="370" y={250 + i * 62} textAnchor="middle" className={styles.signText} fontSize="46" fill="#1A1714">
          {ch}
        </text>
      ))}

      {/* ── 하단 황동 킥플레이트 */}
      <rect x="22" y="690" width="142" height="36" fill="url(#bm-brass)" />
      <rect x="344" y="690" width="54" height="36" fill="url(#bm-brass)" />
      <rect x="164" y="690" width="180" height="36" fill="#6f5a2b" />

      {/* 연말 장식: 리스 */}
      {decor && (
        <g transform="translate(254 150)">
          <circle r="15" fill="none" stroke="#2f5a3a" strokeWidth="9" />
          <circle r="15" fill="none" stroke="#3f7349" strokeWidth="4" strokeDasharray="3 4" />
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={15 * Math.cos((a * Math.PI) / 180)} cy={15 * Math.sin((a * Math.PI) / 180)} r="2.4" fill="#c0283a" />
          ))}
          <path d="M-6 13 L0 19 L6 13 L3 26 M0 19 L-3 26" stroke="#7A1E2C" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* 전체 질감 */}
      <rect x="0" y="0" width="420" height="780" fill="#fff" filter="url(#bm-grain)" clipPath="url(#bm-shape)" pointerEvents="none" />
    </svg>
  );
}
