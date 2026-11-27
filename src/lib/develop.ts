// 현상: 컷 한 장을 흑백 은염 톤으로 만들고, 고른 컷들을 검정 프레임 스트립으로 합친다.
// SVG를 거치지 않고 canvas에 직접 그린다 (iOS Safari에서 가장 안정적).

import { CELL_PX, CUT_ASPECT } from "./config";
import { frameGeometry, type Frame } from "./frames";

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

function sourceSize(src: Source) {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

/** 소스 가운데를 칸 비율로 잘라(object-fit: cover와 같은 계산) 흑백 처리한 컷 */
export function developCut(src: Source): HTMLCanvasElement {
  const { w: sw, h: sh } = sourceSize(src);
  let cw = sw;
  let ch = sw / CUT_ASPECT;
  if (ch > sh) {
    ch = sh;
    cw = sh * CUT_ASPECT;
  }
  const out = document.createElement("canvas");
  out.width = CELL_PX;
  out.height = Math.round(CELL_PX / CUT_ASPECT);
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  // 저장본은 좌우 반전하지 않는다 (미리보기만 거울)
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, out.width, out.height);
  silver(ctx, out.width, out.height);
  vignette(ctx, out.width, out.height);
  return out;
}

/** 흑백 + 대비 + 필름 입자. ctx.filter는 iOS에서 불안정해 픽셀을 직접 만진다 */
function silver(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  let s = (Math.random() * 2 ** 31) | 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296 - 0.5;
  };
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let v = (lum - 128) * 1.3 + 128 + 8;
    const mid = 1 - Math.abs(v - 128) / 160;
    v += rand() * 24 * (0.5 + mid);
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[i] = Math.min(255, v + 4);
    d[i + 1] = v + 1;
    d[i + 2] = Math.max(0, v - 5);
  }
  ctx.putImageData(img, 0, 0);
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 열 수 없어요"));
    };
    img.src = url;
  });
}

function toBlob(c: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", quality));
}

function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

/** 자간을 넓힌 가운데 정렬 글자 (ctx.letterSpacing은 구형 Safari에 없다) */
function spaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, tracking: number) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + tracking;
  });
}

function noiseTile(alpha: number) {
  const n = document.createElement("canvas");
  n.width = n.height = 128;
  const nctx = n.getContext("2d")!;
  const nd = nctx.createImageData(128, 128);
  for (let i = 0; i < nd.data.length; i += 4) {
    nd.data[i] = nd.data[i + 1] = nd.data[i + 2] = Math.random() * 255;
    nd.data[i + 3] = alpha;
  }
  nctx.putImageData(nd, 0, 0);
  return n;
}

export interface Developed {
  full: Blob;
  thumb: Blob;
  w: number;
  h: number;
}

/** 고른 컷들을 검정 프레임 세로 스트립으로 */
export async function composeStrip(cuts: HTMLCanvasElement[], frame: Frame, date: Date): Promise<Developed> {
  const g = frameGeometry(frame);
  const u = CELL_PX;
  const c = document.createElement("canvas");
  c.width = Math.round(g.w * u);
  c.height = Math.round(g.h * u);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#0c0b0a";
  ctx.fillRect(0, 0, c.width, c.height);

  g.cells.forEach((cell, i) => {
    const cut = cuts[i];
    if (cut) ctx.drawImage(cut, Math.round(cell.x * u), Math.round(cell.y * u), Math.round(cell.w * u), Math.round(cell.h * u));
  });

  // 아래 여백에 작게 찍힌 날짜
  const font = cssFont("--font-en", "sans-serif");
  try {
    await document.fonts.load(`500 ${Math.round(u * 0.05)}px ${font}`);
  } catch {}
  ctx.fillStyle = "rgba(233,226,210,0.62)";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.round(u * 0.05)}px ${font}`;
  const ymd = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  spaced(ctx, `photos  ${ymd}`, c.width / 2, (g.footY + g.footH * 0.52) * u, u * 0.012);

  // 인화지 결
  ctx.fillStyle = ctx.createPattern(noiseTile(12), "repeat")!;
  ctx.fillRect(0, 0, c.width, c.height);

  const full = await toBlob(c, 0.92);
  const ts = Math.min(1, 480 / Math.max(c.width, c.height));
  const t = document.createElement("canvas");
  t.width = Math.round(c.width * ts);
  t.height = Math.round(c.height * ts);
  const tctx = t.getContext("2d")!;
  tctx.imageSmoothingQuality = "high";
  tctx.drawImage(c, 0, 0, t.width, t.height);
  const thumb = await toBlob(t, 0.82);
  return { full, thumb, w: c.width, h: c.height };
}

// ───────────────────────────── 스토리용 배경 (9:16)

/** public/bg 의 사진 배경 */
export interface BackdropDef {
  key: string;
  name: string;
  src: string;
}
const bg = (key: string, name: string): BackdropDef => ({ key, name, src: `/bg/${key}.jpeg` });
export const BACKDROPS: BackdropDef[] = [
  bg("green-cross", "Cross"),
  bg("navy-dots", "Navy"),
  bg("navy-lace", "Lace"),
  bg("lace-black-dots", "Lace Dots"),
  bg("red-pink-stripes", "Candy"),
  bg("blue-swirl", "Swirl"),
  bg("black-cream-dots", "Polka"),
  bg("pink-floral", "Floral"),
];
export type Backdrop = string;

const SW = 1080;
const SH = 1920;

const bgImages = new Map<string, Promise<HTMLImageElement>>();
function loadBackdrop(key: string): Promise<HTMLImageElement> {
  let p = bgImages.get(key);
  if (!p) {
    const def = BACKDROPS.find((b) => b.key === key);
    p = new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("배경을 열 수 없어요"));
      img.src = def?.src ?? "";
    });
    p.catch(() => bgImages.delete(key));
    bgImages.set(key, p);
  }
  return p;
}

/** 9:16 캔버스를 꽉 채운다(cover) */
async function paintBackdrop(ctx: CanvasRenderingContext2D, backdrop: Backdrop) {
  const img = await loadBackdrop(backdrop);
  const k = Math.max(SW / img.naturalWidth, SH / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (SW - w) / 2, (SH - h) / 2, w, h);
}

function grainOver(ctx: CanvasRenderingContext2D) {
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(noiseTile(26), "repeat")!;
  ctx.fillRect(0, 0, SW, SH);
  ctx.globalCompositeOperation = "source-over";
}

function storyCanvas() {
  const c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

/** 배경만 (화면에서 사진 뒤에 깔 때 쓴다) */
export async function composeBackdrop(backdrop: Backdrop): Promise<Blob> {
  const { c, ctx } = storyCanvas();
  await paintBackdrop(ctx, backdrop);
  return toBlob(c, 0.88);
}

/** 사진을 가운데 살짝 비스듬히 올린 9:16 이미지. 사진은 화면에서 보던 만큼 크게 */
export async function composeStory(strip: Blob, backdrop: Backdrop): Promise<Blob> {
  const img = await loadImage(strip);
  const { c, ctx } = storyCanvas();
  await paintBackdrop(ctx, backdrop);

  const k = Math.min(1500 / img.naturalHeight, 800 / img.naturalWidth);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.save();
  ctx.translate(SW / 2, SH * 0.5);
  ctx.rotate((-2 * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetX = 14;
  ctx.shadowOffsetY = 30;
  ctx.fillStyle = "#0c0b0a";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = "transparent";
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  grainOver(ctx);
  return toBlob(c, 0.9);
}

export function stripFilename(date = new Date(), tag = "") {
  const p = (n: number) => String(n).padStart(2, "0");
  return `photos-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${tag ? `-${tag}` : ""}.jpg`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** 공유 시트가 되면 공유, 안 되면 false */
export async function shareBlob(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare?.({ files: [file] })) return false;
  try {
    await navigator.share({ files: [file] });
  } catch {
    // 사용자가 공유 시트를 닫은 경우도 여기로 온다
  }
  return true;
}

/** 저장: 바로 내려받는다. 다운로드가 막힌 앱 내 브라우저에서만 공유 시트를 쓰고, 그것도 안 되면 길게 눌러 저장하도록 안내 */
export async function saveImage(blob: Blob, filename: string, downloadBlocked: boolean): Promise<"done" | "longpress"> {
  if (!downloadBlocked) {
    downloadBlob(blob, filename);
    return "done";
  }
  return (await shareBlob(blob, filename)) ? "done" : "longpress";
}
