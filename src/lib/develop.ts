// 현상: 컷 한 장을 흑백 은염 톤으로 만들고, 고른 컷들을 검정 프레임 스트립으로 합친다.
// SVG를 거치지 않고 canvas에 직접 그린다 (iOS Safari에서 가장 안정적).

import { CELL_PX, CUT_ASPECT } from "./config";
import { frameGeometry, getFrame, type Frame } from "./frames";
import { applyBeauty } from "./beauty";
import { getTone, type Tone } from "./tone";

type Source = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement;

function sourceSize(src: Source) {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  return { w: src.width, h: src.height };
}

/** 소스 가운데를 칸 비율로 잘라(object-fit: cover와 같은 계산) 색 그대로 옮긴 컷 */
export function rawCut(src: Source, zoom = 1): HTMLCanvasElement {
  const { w: sw, h: sh } = sourceSize(src);
  let cw = sw;
  let ch = sw / CUT_ASPECT;
  if (ch > sh) {
    ch = sh;
    cw = sh * CUT_ASPECT;
  }
  // 디지털 확대: 가운데를 더 좁게 잘라 쓴다
  cw /= zoom;
  ch /= zoom;
  const out = document.createElement("canvas");
  out.width = CELL_PX;
  out.height = Math.round(CELL_PX / CUT_ASPECT);
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  // 저장본은 좌우 반전하지 않는다 (미리보기만 거울)
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, 0, 0, out.width, out.height);
  return out;
}

/** 흑백으로 현상한 컷 (잘라낸 컷에 톤을 입힌다) */
export function developRaw(raw: HTMLCanvasElement, toneArg?: Tone): HTMLCanvasElement {
  const tone = toneArg ?? getTone();
  const out = document.createElement("canvas");
  out.width = raw.width;
  out.height = raw.height;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(raw, 0, 0);
  silver(ctx, out.width, out.height, tone);
  vignette(ctx, out.width, out.height, tone.vignette);
  return out;
}

export function developCut(src: Source, zoom = 1, tone?: Tone): HTMLCanvasElement {
  return developRaw(rawCut(src, zoom), tone);
}

/** 뷰티 → 색(채도) → 노출/대비 → 필름 입자 → 색조. ctx.filter는 iOS에서 불안정해 픽셀을 직접 만진다 */
function silver(ctx: CanvasRenderingContext2D, w: number, h: number, t: Tone) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  applyBeauty(d, w, h, t);
  let s = (Math.random() * 2 ** 31) | 1;
  const rand = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296 - 0.5;
  };
  const inv = 1 / t.gamma;
  // 노출(gain) → 감마(중간 톤) → 대비 → 밝기
  const curve = (v: number) => {
    v *= t.gain;
    if (t.gamma !== 1) v = 255 * Math.pow(v > 255 ? 1 : v < 0 ? 0 : v / 255, inv);
    return (v - 128) * t.contrast + 128 + t.offset;
  };
  const mono = t.saturation === 0;
  const wr = 4 * t.warmth;
  const wg = 1 * t.warmth;
  const wb = -5 * t.warmth;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let r: number;
    let g: number;
    let b: number;
    let mid: number;
    if (mono) {
      r = g = b = curve(lum);
      mid = 1 - Math.abs(r - 128) / 160;
    } else {
      r = curve(lum + (d[i] - lum) * t.saturation);
      g = curve(lum + (d[i + 1] - lum) * t.saturation);
      b = curve(lum + (d[i + 2] - lum) * t.saturation);
      mid = 1 - Math.abs(0.299 * r + 0.587 * g + 0.114 * b - 128) / 160;
    }
    const n = rand() * t.grain * (0.5 + mid);
    r += n + wr;
    g += n + wg;
    b += n + wb;
    d[i] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(img, 0, 0);
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number) {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
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
      reject(new Error("could not open the image"));
    };
    img.src = url;
  });
}

function toBlob(c: HTMLCanvasElement, quality: number, type = "image/jpeg"): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("could not convert the image"))), type, quality));
}

function cssFont(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

/** 자간을 넓힌 글자 (ctx.letterSpacing은 구형 Safari에 없다) */
function spaced(ctx: CanvasRenderingContext2D, text: string, ax: number, y: number, tracking: number, align: "center" | "right" = "center") {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1);
  let x = align === "right" ? ax - total : ax - total / 2;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + tracking;
  });
}

/** 인화지 결: 인화한 스트립 전체에 얹는 아주 옅은 잡음 (/tone 페이지의 "as printed"도 같은 걸 쓴다) */
export function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = ctx.createPattern(noiseTile(12), "repeat")!;
  ctx.fillRect(0, 0, w, h);
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

  // 아래 여백에 작게 찍힌 날짜: 사진 오른쪽 끝에 맞춘다
  const font = cssFont("--font-en", "sans-serif");
  try {
    await document.fonts.load(`500 ${Math.round(CELL_PX * 0.03)}px ${font}`);
  } catch {}
  ctx.fillStyle = "rgba(233,226,210,0.62)";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.round(CELL_PX * 0.03)}px ${font}`;
  const ymd = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  spaced(ctx, ymd, (g.cells[0].x + g.cells[0].w) * u, (g.footY + g.footH * 0.52) * u, CELL_PX * 0.008, "right");

  paperGrain(ctx, c.width, c.height);

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

// ───────────────────────────── 스토리용 배경 (3:4)

/** public/bg 의 사진 배경 */
export interface BackdropDef {
  key: string;
  name: string;
  src: string;
}
const bg = (key: string, name: string): BackdropDef => ({ key, name, src: `/bg/${key}.jpeg` });
export const BACKDROPS: BackdropDef[] = [
  bg("blue-stars", "sky stars"),
  bg("cream-wrinkled-dots", "wrinkle"),
  bg("taupe-lace", "taupe"),
  bg("fir-lights", "tree"),
  bg("pink-knit", "knit"),
  bg("orange-linen", "orange"),
  bg("green-cross", "cross"),
  bg("navy-dots", "navy"),
  bg("red-pink-stripes", "candy"),
  bg("black-cream-dots", "polka"),
  bg("blue-swirl", "swirl"),
  bg("purple-dots", "purple"),
  bg("wine-velvet", "wine"),
  bg("dusty-blue", "dusty"),
  bg("indigo-paper", "indigo"),
];
export type Backdrop = string;

/** 저장 이미지 비율: 인스타 피드용 3:4, 스토리용 9:16 */
export type Ratio = "3:4" | "9:16";
export const RATIOS: Ratio[] = ["3:4", "9:16"];
const SW = 1080;
const heightOf = (r: Ratio) => (r === "9:16" ? 1920 : 1440);
/** 사진 그림자 (저장 이미지 기준 px) */
export const SHADOW = { blur: 26, x: 8, y: 14 };

const bgImages = new Map<string, Promise<HTMLImageElement>>();
function loadBackdrop(key: string): Promise<HTMLImageElement> {
  let p = bgImages.get(key);
  if (!p) {
    const def = BACKDROPS.find((b) => b.key === key);
    p = new Promise<HTMLImageElement>((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => rej(new Error("could not open the background"));
      img.src = def?.src ?? "";
    });
    p.catch(() => bgImages.delete(key));
    bgImages.set(key, p);
  }
  return p;
}

/** 캔버스를 꽉 채운다(cover). 사진 가운데를 기준으로 위아래를 잘라 비율에 맞춘다 */
async function paintBackdrop(ctx: CanvasRenderingContext2D, backdrop: Backdrop, ratio: Ratio) {
  const SH = heightOf(ratio);
  const img = await loadBackdrop(backdrop);
  const k = Math.max(SW / img.naturalWidth, SH / img.naturalHeight);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (SW - w) / 2, (SH - h) / 2, w, h);
}

function grainOver(ctx: CanvasRenderingContext2D, SH: number) {
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(noiseTile(26), "repeat")!;
  ctx.fillRect(0, 0, SW, SH);
  ctx.globalCompositeOperation = "source-over";
}

function storyCanvas(ratio: Ratio) {
  const SH = heightOf(ratio);
  const c = document.createElement("canvas");
  c.width = SW;
  c.height = SH;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  return { c, ctx };
}

/** 배경만 (화면에서 사진 뒤에 깔 때 쓴다) */
export async function composeBackdrop(backdrop: Backdrop, ratio: Ratio): Promise<Blob> {
  const { c, ctx } = storyCanvas(ratio);
  await paintBackdrop(ctx, backdrop, ratio);
  return toBlob(c, 0.88);
}

/** 프레임을 뺀 사진: 컷은 제자리에 두고 프레임 자리는 투명한 빈 공간으로 둔다 (날짜도 없다) */
export async function composeFlat(cuts: HTMLCanvasElement[], frameKey: string): Promise<{ blob: Blob; w: number; h: number }> {
  const fr = getFrame(frameKey);
  const g = frameGeometry(fr);
  const u = CELL_PX;
  const c = document.createElement("canvas");
  c.width = Math.round(g.w * u);
  c.height = Math.round(g.h * u);
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  g.cells.forEach((cell, i) => {
    if (cuts[i]) ctx.drawImage(cuts[i], Math.round(cell.x * u), Math.round(cell.y * u), Math.round(cell.w * u), Math.round(cell.h * u));
  });
  return { blob: await toBlob(c, 1, "image/png"), w: c.width, h: c.height };
}

/** 레이아웃별 최대 크기. 높이는 캔버스가 길어진 만큼(9:16) 같이 늘어난다 */
function storyBox(frameKey: string, ratio: Ratio) {
  const b = getFrame(frameKey).story;
  // 9:16은 세로로 길어도 사진은 3:4보다 조금 작게 놓는다 (여백이 더 많이 보이도록)
  return ratio === "9:16" ? { w: b.w * 0.86, h: b.h * 0.92 } : { w: b.w, h: b.h };
}

/** 저장 이미지에서 사진이 차지하는 폭의 비율 — 화면 미리보기도 같은 식으로 맞춘다.
 *  레이아웃마다 허용 크기가 달라, 컷이 적을수록 사진이 작고 배경 여백이 넓다 */
export function storyPhotoFrac(nw: number, nh: number, frameKey: string, ratio: Ratio) {
  const { w, h } = storyBox(frameKey, ratio);
  return Math.min((h * nw) / nh, w) / SW;
}

/** 사진을 가운데 올린 3:4 이미지(tilt면 살짝 비스듬히). 배경 안에서 사진은 조금 작게 */
export async function composeStory(strip: Blob, backdrop: Backdrop, frameKey: string, ratio: Ratio, tilt = true): Promise<Blob> {
  const SH = heightOf(ratio);
  const img = await loadImage(strip);
  const { c, ctx } = storyCanvas(ratio);
  await paintBackdrop(ctx, backdrop, ratio);

  const box = storyBox(frameKey, ratio);
  const k = Math.min(box.h / img.naturalHeight, box.w / img.naturalWidth);
  const w = img.naturalWidth * k;
  const h = img.naturalHeight * k;
  ctx.save();
  ctx.translate(SW / 2, SH * 0.5);
  ctx.rotate(((tilt ? -2 : 0) * Math.PI) / 180);
  // 작고 가까운 그림자 (프레임이 없으면 컷 모양대로 생긴다)
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = SHADOW.blur;
  ctx.shadowOffsetX = SHADOW.x;
  ctx.shadowOffsetY = SHADOW.y;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  grainOver(ctx, SH);
  return toBlob(c, 0.9);
}

export function stripFilename(date = new Date(), tag = "", ext = "jpg") {
  const p = (n: number) => String(n).padStart(2, "0");
  return `photos-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${tag ? `-${tag}` : ""}.${ext}`;
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
