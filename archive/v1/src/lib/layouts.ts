// 단체컷 레이아웃 — 데이터(파라미터)로 정의하고 computeGeometry() 하나로 칸 좌표를 만든다.
// 화면용 SVG 렌더러(GroupPhoto)와 저장용 canvas 렌더러(composeGroupPhoto)가 같은 좌표를 쓴다.

import { MAX_PARTICIPANTS, CUT_ASPECT } from "./config";
import type { PhotoStatus } from "./types";

export type Tier = 1 | 2 | 3 | 4;
/** 자동 전환 시 같은 계열을 유지하기 위한 분류 */
export type Family = "strip" | "grid" | "analog";
/** 종이/필름 외형 */
export type FrameStyle = "paper" | "film" | "contact" | "idsheet" | "polaroid";

export interface LayoutDef {
  key: string;
  name: string;
  tier: Tier;
  family: Family;
  frame: FrameStyle;
  /** 칸 수 → 열 수 */
  cols: (count: number) => number;
  /** 필름 스트립 두 줄처럼 행 수를 고정할 때 */
  rows?: (count: number) => number;
  /** 칸 가로/세로 비율 */
  cellAspect: number;
  /** 칸 간격 (칸 너비 대비 비율) */
  gap: number;
  /** 여백 [top, right, bottom, left] (칸 너비 대비 비율) */
  pad: [number, number, number, number];
}

export const TIERS: Record<Tier, { min: number; max: number; label: string }> = {
  1: { min: 1, max: 2, label: "1~2명" },
  2: { min: 3, max: 4, label: "3~4명" },
  3: { min: 5, max: 9, label: "5~9명" },
  4: { min: 10, max: MAX_PARTICIPANTS, label: "10~20명" },
};

const one = () => 1;

export const LAYOUTS: LayoutDef[] = [
  // ── 1~2명
  { key: "strip-v", name: "세로 스트립", tier: 1, family: "strip", frame: "paper", cols: one, cellAspect: CUT_ASPECT, gap: 0.06, pad: [0.08, 0.08, 0.3, 0.08] },
  { key: "side-2", name: "가로로 나란한 2컷", tier: 1, family: "grid", frame: "paper", cols: (n) => n, cellAspect: CUT_ASPECT, gap: 0.05, pad: [0.07, 0.07, 0.22, 0.07] },
  { key: "polaroid-2", name: "폴라로이드 겹치기", tier: 1, family: "analog", frame: "polaroid", cols: (n) => n, cellAspect: 1, gap: 0, pad: [0.12, 0.12, 0.12, 0.12] },
  // ── 3~4명
  { key: "strip-4", name: "클래식 4컷 스트립", tier: 2, family: "strip", frame: "paper", cols: one, cellAspect: CUT_ASPECT, gap: 0.05, pad: [0.08, 0.08, 0.3, 0.08] },
  { key: "grid-2x2", name: "2×2 격자", tier: 2, family: "grid", frame: "paper", cols: () => 2, cellAspect: CUT_ASPECT, gap: 0.05, pad: [0.07, 0.07, 0.22, 0.07] },
  { key: "film-h", name: "가로 필름 스트립", tier: 2, family: "analog", frame: "film", cols: (n) => n, cellAspect: CUT_ASPECT, gap: 0.06, pad: [0.22, 0.06, 0.22, 0.06] },
  // ── 5~9명
  { key: "grid-3col", name: "3열 격자", tier: 3, family: "grid", frame: "paper", cols: () => 3, cellAspect: CUT_ASPECT, gap: 0.05, pad: [0.07, 0.07, 0.22, 0.07] },
  { key: "film-2row", name: "필름 스트립 두 줄", tier: 3, family: "strip", frame: "film", cols: (n) => Math.ceil(n / 2), rows: () => 2, cellAspect: CUT_ASPECT, gap: 0.06, pad: [0.22, 0.06, 0.22, 0.06] },
  { key: "contact", name: "콘택트 시트", tier: 3, family: "analog", frame: "contact", cols: () => 3, cellAspect: CUT_ASPECT, gap: 0.05, pad: [0.3, 0.2, 0.36, 0.2] },
  // ── 10~20명
  { key: "contact-big", name: "큰 콘택트 시트", tier: 4, family: "analog", frame: "contact", cols: () => 5, cellAspect: CUT_ASPECT, gap: 0.05, pad: [0.3, 0.2, 0.36, 0.2] },
  { key: "id-sheet", name: "증명사진 시트", tier: 4, family: "grid", frame: "idsheet", cols: () => 5, cellAspect: CUT_ASPECT, gap: 0.12, pad: [0.18, 0.12, 0.28, 0.12] },
];

/** 계열 × 구간 → 레이아웃 키. 구간이 바뀌면 같은 계열의 다음 레이아웃으로 자동 전환 */
const FAMILY_TIER: Record<Family, Record<Tier, string>> = {
  strip: { 1: "strip-v", 2: "strip-4", 3: "film-2row", 4: "contact-big" },
  grid: { 1: "side-2", 2: "grid-2x2", 3: "grid-3col", 4: "id-sheet" },
  analog: { 1: "polaroid-2", 2: "film-h", 3: "contact", 4: "contact-big" },
};

export const DEFAULT_LAYOUT_KEY = "strip-v";

export function getLayout(key: string): LayoutDef {
  return LAYOUTS.find((l) => l.key === key) ?? LAYOUTS[0];
}

/** 참여 인원 → 구간. 1명(만든 직후)도 2명 구간 */
export function tierOf(participants: number): Tier {
  const n = Math.max(1, participants);
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 9) return 3;
  return 4;
}

export function layoutsForTier(tier: Tier): LayoutDef[] {
  return LAYOUTS.filter((l) => l.tier === tier);
}

/** 인원 변화 후 쓸 레이아웃. 같은 구간이면 그대로, 구간이 바뀌면 같은 계열로 전환 */
export function resolveLayoutKey(currentKey: string, participants: number): string {
  const def = getLayout(currentKey);
  const tier = tierOf(participants);
  if (def.tier === tier) return def.key;
  return FAMILY_TIER[def.family][tier];
}

/** 화면에 그릴 칸 수: 현상 중이면 빈자리 1칸 추가(최소 2칸), 인화 완료면 참여 인원 그대로 */
export function slotCountFor(participants: number, status: PhotoStatus): number {
  if (status === "printed") return Math.max(1, participants);
  return Math.min(MAX_PARTICIPANTS, Math.max(2, participants + 1));
}

// ───────────────────────────── geometry

export interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 칸 중심 기준 회전(도) */
  rot: number;
  /** 폴라로이드처럼 칸마다 종이가 따로 있는 경우의 종이 사각형 */
  card?: { x: number; y: number; w: number; h: number };
}

export interface FilmBand {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 구멍 행의 y 좌표(위/아래) */
  holeRows: [number, number];
  holeSize: number;
  holePitch: number;
  /** 칸 번호 표기용 (콘택트 시트) */
  frameNumbers: { x: number; y: number; label: string }[];
}

export interface Geometry {
  layout: LayoutDef;
  width: number;
  height: number;
  slots: SlotRect[];
  bands: FilmBand[];
  /** 이름 라벨 높이(증명사진 시트) */
  labelHeight: number;
  /** 날짜 도장 / 서명 위치 */
  stamp: { x: number; y: number; r: number };
  /** 하단 캡션(사진 이름) 위치 */
  caption: { x: number; y: number; size: number } | null;
}

/** 기준 칸 너비(px). 최종 출력 크기는 렌더러에서 스케일 */
export const BASE_CELL = 300;

export function computeGeometry(layoutKey: string, count: number): Geometry {
  const L = getLayout(layoutKey);
  const n = Math.max(1, count);
  const cw = BASE_CELL;
  const ch = cw / L.cellAspect;
  const gap = L.gap * cw;
  const [pt, pr, pb, pl] = L.pad.map((p) => p * cw);

  if (L.frame === "polaroid") return polaroidGeometry(L, n);

  let cols: number;
  let rows: number;
  if (L.rows) {
    rows = Math.min(L.rows(n), n);
    cols = Math.ceil(n / rows);
  } else {
    cols = Math.min(L.cols(n), n);
    rows = Math.ceil(n / cols);
  }

  const isFilm = L.frame === "film" || L.frame === "contact";
  const labelHeight = L.frame === "idsheet" ? cw * 0.22 : 0;
  // 필름은 행마다 위아래로 구멍 띠가 붙는다
  const bandExtra = isFilm ? cw * 0.22 : 0;
  const rowGap = isFilm ? (L.frame === "contact" ? cw * 0.18 : cw * 0.06) : gap + labelHeight;
  const rowH = ch + (isFilm ? bandExtra * 2 : 0);

  const gridW = cols * cw + (cols - 1) * gap;
  const gridH = rows * rowH + (rows - 1) * rowGap + (L.frame === "idsheet" ? labelHeight : 0);

  // 필름 스트립은 위/아래 패딩을 구멍 띠가 대신하므로 0
  const padT = L.frame === "film" ? cw * 0.04 : pt;
  const padB = L.frame === "film" ? cw * 0.04 : pb;
  const padX = L.frame === "film" ? 0 : pl;
  const width = gridW + padX + (L.frame === "film" ? 0 : pr) + (L.frame === "film" ? cw * 0.12 : 0);
  const height = gridH + padT + padB;
  const originX = L.frame === "film" ? cw * 0.06 : padX;

  const slots: SlotRect[] = [];
  const bands: FilmBand[] = [];
  for (let r = 0; r < rows; r++) {
    const rowY = padT + r * (rowH + rowGap);
    const cellY = rowY + (isFilm ? bandExtra : 0);
    const inRow = Math.min(cols, n - r * cols);
    for (let c = 0; c < inRow; c++) {
      slots.push({ x: originX + c * (cw + gap), y: cellY, w: cw, h: ch, rot: 0 });
    }
    if (isFilm) {
      const bandW = L.frame === "film" ? width : inRow * cw + (inRow - 1) * gap + gap * 2;
      const bandX = L.frame === "film" ? 0 : originX - gap;
      const holeSize = cw * 0.075;
      bands.push({
        x: bandX,
        y: rowY,
        w: bandW,
        h: rowH,
        holeRows: [rowY + bandExtra / 2, rowY + rowH - bandExtra / 2],
        holeSize,
        holePitch: holeSize * 2.4,
        frameNumbers: Array.from({ length: inRow }, (_, c) => ({
          x: originX + c * (cw + gap) + cw / 2,
          y: rowY + rowH - bandExtra * 0.12,
          label: `${r * cols + c + 1}${(r * cols + c) % 2 ? "A" : ""}`,
        })),
      });
    }
  }

  const caption =
    L.frame === "paper" || L.frame === "contact" || L.frame === "idsheet"
      ? { x: width / 2, y: height - padB * 0.42, size: Math.min(cw * 0.1, 30) }
      : null;

  return {
    layout: L,
    width,
    height,
    slots,
    bands,
    labelHeight,
    stamp: { x: width - Math.min(width * 0.2, cw * 0.55), y: height - Math.min(height * 0.12, cw * 0.4), r: cw * 0.26 },
    caption,
  };
}

function polaroidGeometry(L: LayoutDef, n: number): Geometry {
  const cw = BASE_CELL;
  const img = cw; // 정사각 사진
  const border = cw * 0.07;
  const cardW = img + border * 2;
  const cardH = img + border * 1 + cw * 0.3; // 아래 여백이 넓은 폴라로이드
  const overlap = cardW * 0.22; // 살짝 겹치기
  const step = cardW - overlap;
  const pad = cw * 0.18;
  const rots = [-5, 4, -2.5, 5.5, -4];
  const width = pad * 2 + cardW + step * (n - 1);
  const height = pad * 2 + cardH + cw * 0.12;
  const slots: SlotRect[] = [];
  for (let i = 0; i < n; i++) {
    const cx = pad + i * step;
    const cy = pad + (i % 2 ? cw * 0.12 : 0);
    slots.push({
      x: cx + border,
      y: cy + border,
      w: img,
      h: img,
      rot: rots[i % rots.length],
      card: { x: cx, y: cy, w: cardW, h: cardH },
    });
  }
  return {
    layout: L,
    width,
    height,
    slots,
    bands: [],
    labelHeight: 0,
    stamp: { x: width - cw * 0.45, y: height - cw * 0.35, r: cw * 0.26 },
    caption: null,
  };
}
