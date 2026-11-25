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

export type Backdrop = "wood" | "dots" | "xmas";
export const BACKDROPS: { key: Backdrop; name: string }[] = [
  { key: "wood", name: "Wood" },
  { key: "dots", name: "Dots" },
  { key: "xmas", name: "Xmas" },
];

const SW = 1080;
const SH = 1920;

function rng(seed: number) {
  let s = seed | 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function paintWood(ctx: CanvasRenderingContext2D) {
  const r = rng(77);
  ctx.fillStyle = "#8a5428";
  ctx.fillRect(0, 0, SW, SH);
  // 넓은 판마다 조금 다른 색
  const planks = 3;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = ["rgba(60,25,0,0.14)", "rgba(255,190,120,0.07)", "rgba(40,15,0,0.2)"][i];
    ctx.fillRect((SW / planks) * i, 0, SW / planks, SH);
  }
  // 세로 결: 굵기와 진하기가 제각각인 선 수천 개
  for (let i = 0; i < 2600; i++) {
    const x = r() * SW;
    const w = 0.6 + r() * r() * 7;
    const dark = r() < 0.62;
    ctx.fillStyle = dark ? `rgba(45,18,2,${0.05 + r() * 0.22})` : `rgba(255,205,140,${0.03 + r() * 0.12})`;
    const y0 = r() < 0.35 ? r() * SH : 0;
    ctx.fillRect(x, y0, w, r() < 0.35 ? r() * SH * 0.7 : SH);
  }
  for (let i = 1; i < planks; i++) {
    ctx.fillStyle = "rgba(25,8,0,0.6)";
    ctx.fillRect((SW / planks) * i, 0, 2, SH);
    ctx.fillStyle = "rgba(255,210,150,0.18)";
    ctx.fillRect((SW / planks) * i + 2, 0, 2, SH);
  }
  // 니스 반사
  const gl = ctx.createLinearGradient(0, 0, SW, SH * 0.25);
  gl.addColorStop(0.1, "rgba(255,244,225,0)");
  gl.addColorStop(0.22, "rgba(255,244,225,0.16)");
  gl.addColorStop(0.34, "rgba(255,244,225,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(0, 0, SW, SH);
}

function paintDots(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#0d0c0b";
  ctx.fillRect(0, 0, SW, SH);
  ctx.fillStyle = "#e9e1cf";
  const step = 270;
  const rad = 78;
  for (let row = -1; row * (step / 2) < SH + step; row++) {
    for (let col = -1; col * step < SW + step; col++) {
      ctx.beginPath();
      ctx.arc(col * step + (row % 2 ? step / 2 : 0), row * (step / 2), rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintXmas(ctx: CanvasRenderingContext2D) {
  const r = rng(1225);
  const bg = ctx.createLinearGradient(0, 0, 0, SH);
  bg.addColorStop(0, "#16382a");
  bg.addColorStop(1, "#0a1f17");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SW, SH);
  // 눈: 초점이 나간 큰 눈송이와 또렷한 작은 눈송이
  for (let i = 0; i < 150; i++) {
    const big = r() < 0.2;
    const x = r() * SW;
    const y = r() * SH;
    const rad = big ? 14 + r() * 22 : 2 + r() * 5;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(255,250,240,${big ? 0.22 : 0.85})`);
    g.addColorStop(1, "rgba(255,250,240,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // 위아래로 늘어진 꼬마전구 줄
  const colors = ["#ffd27a", "#e5533d", "#ffd27a", "#7fd1a0"];
  for (const [y0, sag, flip] of [
    [150, 120, 1],
    [SH - 190, 110, -1],
  ] as const) {
    const at = (t: number) => ({ x: t * SW, y: y0 + flip * Math.sin(t * Math.PI * 2.5) * sag * 0.5 + flip * sag * 0.5 });
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.01) {
      const p = at(t);
      if (t === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const p = at((i + 0.5) / 12);
      const col = colors[i % colors.length];
      const glow = ctx.createRadialGradient(p.x, p.y + 20, 0, p.x, p.y + 20, 90);
      glow.addColorStop(0, col + "aa");
      glow.addColorStop(1, col + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(p.x - 90, p.y - 70, 180, 180);
      ctx.fillStyle = "#1c1a17";
      ctx.fillRect(p.x - 8, p.y - 2, 16, 14);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 28, 15, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.beginPath();
      ctx.ellipse(p.x - 5, p.y + 21, 4, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintBackdrop(ctx: CanvasRenderingContext2D, backdrop: Backdrop) {
  if (backdrop === "wood") paintWood(ctx);
  else if (backdrop === "dots") paintDots(ctx);
  else paintXmas(ctx);
  // 가장자리 어둡게
  const v = ctx.createRadialGradient(SW / 2, SH * 0.48, SH * 0.3, SW / 2, SH / 2, SH * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, SW, SH);
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
export function composeBackdrop(backdrop: Backdrop): Promise<Blob> {
  const { c, ctx } = storyCanvas();
  paintBackdrop(ctx, backdrop);
  grainOver(ctx);
  return toBlob(c, 0.85);
}

/** 사진을 가운데 살짝 비스듬히 올린 9:16 이미지. 사진은 화면에서 보던 만큼 크게 */
export async function composeStory(strip: Blob, backdrop: Backdrop): Promise<Blob> {
  const img = await loadImage(strip);
  const { c, ctx } = storyCanvas();
  paintBackdrop(ctx, backdrop);

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
