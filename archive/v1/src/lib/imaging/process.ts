// 컷 한 장 처리: 프레이밍 크롭 → 흑백+대비 → 필름 입자 → 비네팅 → 날짜 각인
// 모든 처리는 클라이언트 canvas에서. ctx.filter는 iOS Safari 지원이 불안정해 픽셀 루프로 직접 처리한다.

import { CUT_ASPECT, CUT_LONG_EDGE, THUMB_LONG_EDGE } from "../config";
import { drawDateImprint } from "./sevenSeg";

export interface Framing {
  /** 1 = 꽉 찬 크롭, 클수록 확대 (의자 높이 다이얼) */
  zoom: number;
  /** -1(위) ~ 1(아래): 크롭 창의 세로 위치 */
  offsetY: number;
}

export const DEFAULT_FRAMING: Framing = { zoom: 1.15, offsetY: 0 };

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

function sourceSize(src: Source): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

/** 소스에서 3:4 크롭 사각형 계산. 미리보기 CSS와 같은 수식을 써야 찍힌 결과가 미리보기와 일치한다 */
export function cropRect(sw: number, sh: number, framing: Framing) {
  // 소스 안에 들어가는 최대 3:4 사각형
  let cw = sw;
  let ch = cw / CUT_ASPECT;
  if (ch > sh) {
    ch = sh;
    cw = ch * CUT_ASPECT;
  }
  cw /= framing.zoom;
  ch /= framing.zoom;
  const cx = (sw - cw) / 2;
  const maxDy = (sh - ch) / 2;
  const cy = maxDy + framing.offsetY * maxDy;
  return { x: cx, y: cy, w: cw, h: ch };
}

export interface ProcessOptions {
  framing?: Framing;
  date?: Date;
  /** 테스트용 고정 시드 */
  seed?: number;
}

export function processCut(src: Source, opts: ProcessOptions = {}): HTMLCanvasElement {
  const framing = opts.framing ?? DEFAULT_FRAMING;
  const { w: sw, h: sh } = sourceSize(src);
  const r = cropRect(sw, sh, framing);

  const outH = CUT_LONG_EDGE;
  const outW = Math.round(outH * CUT_ASPECT);
  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  // 저장 이미지는 좌우 반전하지 않는다 (미리보기만 거울 모드)
  ctx.drawImage(src as CanvasImageSource, r.x, r.y, r.w, r.h, 0, 0, outW, outH);

  applyMonochromeGrain(ctx, outW, outH, opts.seed);
  applyVignette(ctx, outW, outH);
  drawDateImprint(ctx, outW, outH, opts.date ?? new Date());
  return canvas;
}

/** 흑백 + 대비 + 필름 입자. 한 번의 픽셀 루프 */
function applyMonochromeGrain(ctx: CanvasRenderingContext2D, w: number, h: number, seed?: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const contrast = 1.28;
  const brightness = 6;
  const grain = 22;
  let s = seed ?? (Math.random() * 2 ** 31) | 0;
  const rand = () => {
    // xorshift — Math.random보다 빠르고 시드 고정 가능
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) - 0.5;
  };
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let v = (lum - 128) * contrast + 128 + brightness;
    // 입자는 중간톤에서 가장 강하게
    const midtone = 1 - Math.abs(v - 128) / 160;
    v += rand() * grain * (0.5 + midtone);
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    // 약간 따뜻한 은염 톤
    d[i] = Math.min(255, v + 3);
    d[i + 1] = v;
    d[i + 2] = Math.max(0, v - 4);
  }
  ctx.putImageData(img, 0, 0);
}

function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function resizeCanvas(src: HTMLCanvasElement, longEdge: number): HTMLCanvasElement {
  const scale = longEdge / Math.max(src.width, src.height);
  if (scale >= 1) return src;
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = "image/jpeg", quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), type, quality),
  );
}

/** 업로드용 원본 + 썸네일 Blob 생성. WebP 미지원 브라우저(구형 iOS)는 JPEG로 */
export async function encodeCut(c: HTMLCanvasElement): Promise<{ full: Blob; thumb: Blob }> {
  const type = supportsWebp() ? "image/webp" : "image/jpeg";
  const full = await canvasToBlob(c, type, 0.85);
  const thumb = await canvasToBlob(resizeCanvas(c, THUMB_LONG_EDGE), type, 0.8);
  return { full, thumb };
}

let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport === null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpSupport = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSupport;
}
