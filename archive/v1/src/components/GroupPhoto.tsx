// 단체컷 렌더러 — 레이아웃 데이터(computeGeometry)를 SVG 하나로 그린다.
// 화면 표시와 PNG 저장(composeGroupPhoto: 이 컴포넌트를 직렬화) 모두 이 렌더러를 쓴다.

import { useId, type ReactNode } from "react";
import { computeGeometry, slotCountFor, type Geometry, type SlotRect } from "@/lib/layouts";
import type { CutView, PhotoStatus } from "@/lib/types";

export interface GroupPhotoProps {
  layoutKey: string;
  status: PhotoStatus;
  cuts: CutView[];
  title?: string;
  printedAt?: string | null;
  /** 썸네일 사용(게시판 원거리용) */
  thumbs?: boolean;
  /** 깜빡이며 강조할 칸(부스 안 "내 자리") */
  highlightSlot?: number | null;
  /** 빈자리 탭 */
  onEmptySlot?: (slotIndex: number) => void;
  /** 빈자리 안내 문구 숨김(아주 작게 그릴 때) */
  hideEmptyLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** PNG 저장 시 애니메이션·인터랙션 제거 */
  forExport?: boolean;
  /** 직렬화 시 고유 id 충돌 방지용 */
  idOverride?: string;
  /** 종이 질감 필터 생략 (게시판에서 많이 그릴 때 성능) */
  noGrain?: boolean;
}

const PAPER = "#EDE4D0";
const INK = "#1A1714";
const STAMP = "#7A1E2C";

export function orderedCuts(cuts: CutView[]): CutView[] {
  return [...cuts].sort((a, b) => a.slotIndex - b.slotIndex);
}

export default function GroupPhoto(props: GroupPhotoProps) {
  const {
    layoutKey,
    status,
    cuts,
    title,
    printedAt,
    thumbs,
    highlightSlot = null,
    onEmptySlot,
    hideEmptyLabel,
    className,
    style,
    forExport,
    idOverride,
    noGrain,
  } = props;
  const rid = useId().replace(/[:«»]/g, "");
  const uid = idOverride ?? `gp${rid}`;
  const sorted = orderedCuts(cuts);
  const count = slotCountFor(sorted.length, status);
  const g = computeGeometry(layoutKey, count);
  const L = g.layout;
  const bg = L.frame === "film" ? INK : L.frame === "polaroid" ? "transparent" : PAPER;

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      width={forExport ? g.width : undefined}
      height={forExport ? g.height : undefined}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ fontFamily: "var(--font-ko), \"Noto Sans KR\", sans-serif", ...style }}
      role="img"
      aria-label={title ? `단체컷: ${title}` : "단체컷"}
    >
      <defs>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.09" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id={`${uid}-stamp`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="3" result="t" />
          <feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6" result="mask" />
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>
      </defs>

      {/* 바탕 종이 / 필름 */}
      {L.frame !== "polaroid" && <rect x={0} y={0} width={g.width} height={g.height} fill={bg} />}
      {L.frame === "contact" && <ContactEdge g={g} />}
      {g.bands.map((b, i) => (
        <FilmBandShape key={i} band={b} isContact={L.frame === "contact"} holeFill={L.frame === "film" ? "#2b2622" : PAPER} />
      ))}

      {/* 칸 */}
      {g.slots.map((s, i) => {
        const cut = sorted[i];
        const transform = s.rot ? `rotate(${s.rot} ${s.x + s.w / 2} ${s.y + s.h / 2})` : undefined;
        return (
          <g key={i} transform={transform}>
            {s.card && <PolaroidCard s={s} uid={uid} noGrain={noGrain} />}
            {cut ? (
              <CutImage s={s} href={thumbs ? cut.thumbUrl : cut.imageUrl} />
            ) : (
              <EmptySlot
                s={s}
                index={i}
                label={!hideEmptyLabel}
                dark={L.frame === "film" || L.frame === "contact"}
                onClick={onEmptySlot && !forExport ? () => onEmptySlot(i) : undefined}
              />
            )}
            {highlightSlot === i && !forExport && <Highlight s={s} />}
            {L.frame === "idsheet" && (
              <text
                x={s.x + s.w / 2}
                y={s.y + s.h + g.labelHeight * 0.62}
                textAnchor="middle"
                fontSize={g.labelHeight * 0.48}
               
                fill={cut ? INK : "#8a7f6c"}
              >
                {cut ? cut.name : ""}
              </text>
            )}
            {s.card && cut && (
              <text
                x={s.card.x + s.card.w / 2}
                y={s.card.y + s.card.h - (s.card.h - s.h - (s.y - s.card.y)) * 0.42}
                textAnchor="middle"
                fontSize={s.w * 0.075}
               
                fill="#3a332b"
              >
                {cut.name}
              </text>
            )}
          </g>
        );
      })}

      {/* 캡션: 사진 이름 */}
      {g.caption && title && (
        <text
          x={g.caption.x}
          y={g.caption.y}
          textAnchor="middle"
          fontSize={g.caption.size}
         
          letterSpacing={1}
          fill="#4a4136"
        >
          {title}
        </text>
      )}

      {/* 종이 질감 */}
      {L.frame !== "polaroid" && !noGrain && (
        <rect x={0} y={0} width={g.width} height={g.height} fill="#fff" filter={`url(#${uid}-grain)`} pointerEvents="none" />
      )}

      {status === "printed" && <DateStamp g={g} date={printedAt} filterId={`${uid}-stamp`} />}
    </svg>
  );
}

function CutImage({ s, href }: { s: SlotRect; href: string }) {
  return (
    <>
      <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#222" />
      <image href={href} x={s.x} y={s.y} width={s.w} height={s.h} preserveAspectRatio="xMidYMid slice" />
    </>
  );
}

function EmptySlot({
  s,
  index,
  label,
  dark,
  onClick,
}: {
  s: SlotRect;
  index: number;
  label: boolean;
  dark: boolean;
  onClick?: () => void;
}) {
  const stroke = dark ? "rgba(237,228,208,0.75)" : "rgba(26,23,20,0.45)";
  const fill = dark ? "#2a2521" : "#e4d9c1";
  const cx = s.x + s.w / 2;
  const headR = s.w * 0.16;
  const headY = s.y + s.h * 0.4;
  const sw = Math.max(2, s.w * 0.012);
  const dash = `${s.w * 0.035} ${s.w * 0.025}`;
  return (
    <g
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
      role={onClick ? "button" : undefined}
      aria-label={onClick ? `${index + 1}번 빈자리에 끼기` : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
    >
      <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={fill} />
      <rect
        x={s.x + sw * 2}
        y={s.y + sw * 2}
        width={s.w - sw * 4}
        height={s.h - sw * 4}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
        rx={s.w * 0.02}
      />
      {/* 점선 얼굴 실루엣 */}
      <circle cx={cx} cy={headY} r={headR} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dash} />
      <path
        d={`M ${cx - s.w * 0.34} ${s.y + s.h - sw * 3}
            Q ${cx - s.w * 0.32} ${headY + headR * 1.5} ${cx} ${headY + headR * 1.35}
            Q ${cx + s.w * 0.32} ${headY + headR * 1.5} ${cx + s.w * 0.34} ${s.y + s.h - sw * 3}`}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
      />
      {label && (
        <text
          x={cx}
          y={s.y + s.h * 0.17}
          textAnchor="middle"
          fontSize={s.w * 0.085}
         
          fontWeight={700}
          fill={stroke}
        >
          여기 네 자리
        </text>
      )}
    </g>
  );
}

function Highlight({ s }: { s: SlotRect }) {
  return (
    <rect
      x={s.x}
      y={s.y}
      width={s.w}
      height={s.h}
      fill="none"
      stroke="#F2C46B"
      strokeWidth={s.w * 0.035}
      className="gp-blink"
      pointerEvents="none"
    />
  );
}

function PolaroidCard({ s, uid, noGrain }: { s: SlotRect; uid: string; noGrain?: boolean }) {
  const c = s.card!;
  return (
    <>
      <rect x={c.x + 4} y={c.y + 7} width={c.w} height={c.h} fill="rgba(0,0,0,0.25)" rx={3} />
      <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#F4EEE0" rx={3} />
      {!noGrain && <rect x={c.x} y={c.y} width={c.w} height={c.h} fill="#fff" filter={`url(#${uid}-grain)`} rx={3} />}
    </>
  );
}

function FilmBandShape({ band, isContact, holeFill }: { band: Geometry["bands"][number]; isContact: boolean; holeFill: string }) {
  const holes: ReactNode[] = [];
  const n = Math.floor((band.w - band.holePitch * 0.5) / band.holePitch);
  const startX = band.x + (band.w - n * band.holePitch) / 2 + (band.holePitch - band.holeSize) / 2;
  for (const hy of band.holeRows) {
    for (let i = 0; i < n; i++) {
      holes.push(
        <rect
          key={`${hy}-${i}`}
          x={startX + i * band.holePitch}
          y={hy - band.holeSize * 0.65}
          width={band.holeSize}
          height={band.holeSize * 1.3}
          rx={band.holeSize * 0.22}
          fill={holeFill}
        />,
      );
    }
  }
  return (
    <g>
      <rect x={band.x} y={band.y} width={band.w} height={band.h} fill={INK} />
      {holes}
      {isContact &&
        band.frameNumbers.map((f, i) => (
          <text key={i} x={f.x} y={f.y} textAnchor="middle" fontSize={band.holeSize * 0.9} fill="#d9a441" fontFamily="monospace">
            {f.label} ▸
          </text>
        ))}
    </g>
  );
}

function ContactEdge({ g }: { g: Geometry }) {
  return (
    <text x={g.width * 0.06} y={g.height - g.height * 0.035} fontSize={Math.max(12, g.width * 0.014)} fill="#8a7f6c" fontFamily="monospace" letterSpacing={2}>
      SAFETY FILM 400 · CONTACT PRINT
    </text>
  );
}

function DateStamp({ g, date, filterId }: { g: Geometry; date?: string | null; filterId: string }) {
  const d = date ? new Date(date) : new Date();
  const label = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  const { x, y, r } = g.stamp;
  return (
    <g transform={`rotate(-14 ${x} ${y})`} opacity={0.82} filter={`url(#${filterId})`} pointerEvents="none">
      <circle cx={x} cy={y} r={r} fill="none" stroke={STAMP} strokeWidth={r * 0.07} />
      <circle cx={x} cy={y} r={r * 0.82} fill="none" stroke={STAMP} strokeWidth={r * 0.025} />
      <text x={x} y={y - r * 0.28} textAnchor="middle" fontSize={r * 0.26} fontWeight={800} fill={STAMP} style={{ fontFamily: "var(--font-sign), Oswald, sans-serif" }} letterSpacing={r * 0.02}>
        PRINTED
      </text>
      <line x1={x - r * 0.62} x2={x + r * 0.62} y1={y - r * 0.12} y2={y - r * 0.12} stroke={STAMP} strokeWidth={r * 0.03} />
      <text x={x} y={y + r * 0.2} textAnchor="middle" fontSize={r * 0.25} fontWeight={700} fill={STAMP} fontFamily="monospace">
        {label}
      </text>
      <text x={x} y={y + r * 0.5} textAnchor="middle" fontSize={r * 0.16} fill={STAMP} style={{ fontFamily: "var(--font-sign), Oswald, sans-serif" }} letterSpacing={r * 0.03}>
        ★ DEVELOPED ★
      </text>
    </g>
  );
}
