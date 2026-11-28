// 얼굴 보정: 얼굴 랜드마크를 찾아서(MediaPipe Face Landmarker, 기기 안에서 실행) 갸름하게 / 눈 크게 비튼다.
// 모델과 wasm은 우리 사이트에서 내려받으므로 사진이 기기 밖으로 나가지 않는다.
import { boxBlur } from "./beauty";
import { hasFaceFx, type Tone } from "./tone";

export interface Pt {
  x: number;
  y: number;
}
export type Face = Pt[];

type Landmarker = { detect: (img: HTMLCanvasElement) => { faceLandmarks: Pt[][] } };

let landmarker: Promise<Landmarker> | null = null;

async function getLandmarker(): Promise<Landmarker> {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
      // CPU: iOS Safari에서 GPU 경로가 불안정해서 안전한 쪽을 쓴다
      return (await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 4,
      })) as unknown as Landmarker;
    })();
    landmarker.catch(() => {
      landmarker = null;
    });
  }
  return landmarker;
}

/** 모델을 미리 읽어 둔다 (첫 촬영의 지연을 줄인다) */
export function warmFaceModel() {
  void getLandmarker().catch(() => undefined);
}

/** 사진에서 얼굴들의 랜드마크(0~1로 정규화)를 찾는다. 못 찾으면 빈 배열, 모델을 못 읽으면 null */
export async function detectFaces(canvas: HTMLCanvasElement): Promise<Face[] | null> {
  try {
    const lm = await getLandmarker();
    return lm.detect(canvas).faceLandmarks;
  } catch {
    return null;
  }
}

// 468점 얼굴 메시(+ 홍채 10점)에서 쓰는 번호
/** 얼굴 윤곽의 왼쪽(화면 기준) 볼 → 턱 */
const JAW_L = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148];
/** 오른쪽 볼 → 턱 */
const JAW_R = [454, 323, 361, 288, 397, 365, 379, 378, 400, 377];
/** 윤곽을 당기는 정도: 볼은 약하게, 턱 쪽 볼은 가장 세게, 턱 끝은 다시 약하게 */
const JAW_W = [0.5, 0.85, 1, 1, 0.95, 0.85, 0.65, 0.45, 0.3, 0.15];
/** 눈: 홍채 중심과 눈초리 · 눈머리 */
const EYES = [
  { iris: 468, a: 33, b: 133 },
  { iris: 473, a: 362, b: 263 },
];
const EYE_POLY = [
  [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
  [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382],
];
const INNER_LIPS = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

interface Op {
  cx: number;
  cy: number;
  r: number;
  /** push: 이 방향으로 내용을 옮긴다 */
  dx?: number;
  dy?: number;
  /** bulge: 중심에서 바깥으로 부풀린다(눈 · 입술) */
  s?: number;
  /** squeeze: 세로로 눌러 줄인다(얼굴 길이) */
  ky?: number;
}

const fall = (t: number) => {
  const k = 1 - t * t;
  return k * k;
};

/** 얼굴 하나의 기하 정보 */
function geo(face: Face, w: number, h: number) {
  const P = (i: number) => ({ x: face[i].x * w, y: face[i].y * h });
  const left = P(234);
  const right = P(454);
  const top = P(10);
  const chin = P(152);
  return {
    P,
    faceW: Math.hypot(right.x - left.x, right.y - left.y),
    faceH: Math.hypot(chin.x - top.x, chin.y - top.y),
    axisX: P(6).x,
    top,
    chin,
  };
}

function opsFor(face: Face, w: number, h: number, t: Tone): Op[] {
  const { P, faceW, faceH, axisX, top, chin } = geo(face, w, h);
  const ops: Op[] = [];
  const toAxis = (x: number) => (axisX >= x ? 1 : -1);

  if (t.slim > 0) {
    const m = t.slim * 0.06 * faceW;
    for (const list of [JAW_L, JAW_R]) {
      list.forEach((idx, k) => {
        const p = P(idx);
        ops.push({ cx: p.x, cy: p.y, r: 0.24 * faceW, dx: toAxis(p.x) * m * JAW_W[k], dy: -m * JAW_W[k] * 0.22 });
      });
    }
  }
  for (const e of EYES) {
    const c = P(e.iris);
    const eyeW = Math.hypot(P(e.a).x - P(e.b).x, P(e.a).y - P(e.b).y);
    if (t.eyes > 0) ops.push({ cx: c.x, cy: c.y, r: 0.95 * eyeW, s: t.eyes * 0.3 });
    if (t.eyeDist !== 0) ops.push({ cx: c.x, cy: c.y, r: 1.1 * eyeW, dx: toAxis(c.x) * t.eyeDist * 0.03 * faceW });
  }
  if (t.nose > 0) {
    const m = t.nose * 0.035 * faceW;
    for (const idx of [129, 98, 358, 327]) {
      const p = P(idx);
      ops.push({ cx: p.x, cy: p.y, r: 0.1 * faceW, dx: toAxis(p.x) * m });
    }
  }
  if (t.chin !== 0) {
    // 양수: 턱 끝을 위로(짧게), 음수: 아래로(길게)
    const m = t.chin * 0.05 * faceH;
    for (const [idx, wt] of [[152, 1], [148, 0.6], [377, 0.6]] as const) {
      const p = P(idx);
      ops.push({ cx: p.x, cy: p.y, r: 0.2 * faceW, dy: -m * wt });
    }
  }
  if (t.faceLen > 0) {
    const cy = (top.y + chin.y) / 2;
    ops.push({ cx: axisX, cy, r: 0.78 * faceH, ky: t.faceLen * 0.07 });
  }
  if (t.forehead > 0) {
    const m = t.forehead * 0.05 * faceH;
    for (const idx of [10, 109, 338, 67, 297]) {
      const p = P(idx);
      ops.push({ cx: p.x, cy: p.y, r: 0.14 * faceW, dy: m });
    }
  }
  if (t.smile > 0) {
    for (const idx of [61, 291]) {
      const p = P(idx);
      ops.push({ cx: p.x, cy: p.y, r: 0.09 * faceW, dx: -toAxis(p.x) * t.smile * 0.012 * faceW, dy: -t.smile * 0.03 * faceH });
    }
  }
  if (t.lips > 0) {
    const a = P(13);
    const b = P(14);
    ops.push({ cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, r: 0.17 * faceW, s: t.lips * 0.2 });
  }
  if (t.brows > 0) {
    for (const idx of [105, 66, 334, 296]) {
      const p = P(idx);
      ops.push({ cx: p.x, cy: p.y, r: 0.12 * faceW, dy: -t.brows * 0.025 * faceH });
    }
  }
  return ops;
}

/** 얼굴마다 모양 효과를 적용한 새 canvas. 역방향 매핑 + 쌍선형 보간이라 구멍이 생기지 않는다 */
export function warpFaces(src: HTMLCanvasElement, faces: Face[], t: Tone): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const fx = new Float32Array(w * h);
  const fy = new Float32Array(w * h);
  let any = false;
  for (const face of faces) {
    for (const op of opsFor(face, w, h, t)) {
      any = true;
      const x0 = Math.max(0, Math.floor(op.cx - op.r));
      const x1 = Math.min(w - 1, Math.ceil(op.cx + op.r));
      const y0 = Math.max(0, Math.floor(op.cy - op.r));
      const y1 = Math.min(h - 1, Math.ceil(op.cy + op.r));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const ddx = x - op.cx;
          const ddy = y - op.cy;
          const d = Math.hypot(ddx, ddy);
          if (d >= op.r) continue;
          const f = fall(d / op.r);
          const i = y * w + x;
          if (op.s !== undefined) {
            // 확대: 원본에서는 중심 쪽 가까운 점을 가져온다
            fx[i] -= ddx * op.s * f;
            fy[i] -= ddy * op.s * f;
          } else if (op.ky !== undefined) {
            // 세로 압축: 원본에서는 중심에서 더 먼 점을 가져온다
            fy[i] += ddy * op.ky * f;
          } else {
            // 밀기: 출력의 (x, y)는 원본에서 d만큼 떨어진 곳을 가져온다
            fx[i] -= (op.dx ?? 0) * f;
            fy[i] -= (op.dy ?? 0) * f;
          }
        }
      }
    }
  }
  if (!any) return src;
  const sctx = src.getContext("2d", { willReadFrequently: true })!;
  const sd = sctx.getImageData(0, 0, w, h).data;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d", { willReadFrequently: true })!;
  const img = octx.createImageData(w, h);
  const od = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let sx = x + fx[i];
      let sy = y + fy[i];
      sx = sx < 0 ? 0 : sx > w - 1 ? w - 1 : sx;
      sy = sy < 0 ? 0 : sy > h - 1 ? h - 1 : sy;
      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const tx = sx - x0;
      const ty = sy - y0;
      const a = (y0 * w + x0) * 4;
      const b = (y0 * w + x1) * 4;
      const c = (y1 * w + x0) * 4;
      const d = (y1 * w + x1) * 4;
      const o = i * 4;
      for (let k = 0; k < 4; k++) {
        const top = sd[a + k] * (1 - tx) + sd[b + k] * tx;
        const bot = sd[c + k] * (1 - tx) + sd[d + k] * tx;
        od[o + k] = top * (1 - ty) + bot * ty;
      }
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// ───────────── 피부 · 눈 부분 보정: 얼굴의 일부 영역만 골라서(마스크) 밝기·색을 만진다

type Shape = (ctx: CanvasRenderingContext2D) => void;

/** 도형들을 흰색으로 그린 뒤 가장자리를 번지게 한 0~1 마스크 */
function maskOf(w: number, h: number, draw: Shape, feather: number): Float32Array {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#fff";
  draw(ctx);
  const d = ctx.getImageData(0, 0, w, h).data;
  const m = new Float32Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4] / 255;
  return feather >= 1 ? boxBlur(m, w, h, Math.round(feather)) : m;
}

const ellipse = (ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
  ctx.fill();
};
const poly = (ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fill();
};

/** 눈 밑 · 눈 · 치아 · 번들거림 · 잡티 · 윤곽. 랜드마크는 비틀기 전 원본 기준이라 비틀기보다 먼저 적용한다 */
export function retouchFaces(src: HTMLCanvasElement, faces: Face[], t: Tone): HTMLCanvasElement {
  const need = t.underEye > 0 || t.eyeBright > 0 || t.teeth > 0 || t.shine > 0 || t.contour > 0 || t.blemish > 0;
  if (!faces.length || !need) return src;
  const w = src.width;
  const h = src.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);

  const fe = Math.max(2, Math.round(w * 0.008));
  const under = t.underEye > 0 ? maskOf(w, h, (c) => faces.forEach((f) => { const g = geo(f, w, h); EYES.forEach((e) => { const ir = g.P(e.iris); const ew = Math.hypot(g.P(e.a).x - g.P(e.b).x, g.P(e.a).y - g.P(e.b).y); ellipse(c, ir.x, ir.y + 0.5 * ew, 0.62 * ew, 0.22 * ew); }); }), fe * 1.5) : null;
  const eyeM = t.eyeBright > 0 ? maskOf(w, h, (c) => faces.forEach((f) => { const g = geo(f, w, h); EYE_POLY.forEach((ids) => poly(c, ids.map((i) => g.P(i)))); }), fe * 0.5) : null;
  const teethM = t.teeth > 0 ? maskOf(w, h, (c) => faces.forEach((f) => { const g = geo(f, w, h); poly(c, INNER_LIPS.map((i) => g.P(i))); }), fe * 0.4) : null;
  const shineM = t.shine > 0 ? maskOf(w, h, (c) => faces.forEach((f) => { const g = geo(f, w, h); const a = g.P(10); const b = g.P(168); ellipse(c, (a.x + b.x) / 2, (a.y + b.y) / 2, 0.2 * g.faceW, 0.5 * Math.hypot(a.x - b.x, a.y - b.y)); const n = g.P(4); ellipse(c, n.x, n.y, 0.09 * g.faceW, 0.13 * g.faceW); }), fe * 2) : null;
  const blemM = t.blemish > 0 ? maskOf(w, h, (c) => faces.forEach((f) => { const g = geo(f, w, h); for (const i of [50, 280]) { const p = g.P(i); ellipse(c, p.x, p.y + 0.03 * g.faceH, 0.17 * g.faceW, 0.13 * g.faceW); } const a = g.P(10); const b = g.P(168); ellipse(c, (a.x + b.x) / 2, (a.y + b.y) / 2, 0.2 * g.faceW, 0.5 * Math.hypot(a.x - b.x, a.y - b.y)); const ch = g.P(152); ellipse(c, ch.x, ch.y - 0.07 * g.faceH, 0.14 * g.faceW, 0.07 * g.faceH); }), fe * 2) : null;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  let bR: Float32Array | null = null;
  let bG: Float32Array | null = null;
  let bB: Float32Array | null = null;
  let bL: Float32Array | null = null;
  if (blemM) {
    const R = new Float32Array(n);
    const G = new Float32Array(n);
    const B = new Float32Array(n);
    const L = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      R[i] = d[j];
      G[i] = d[j + 1];
      B[i] = d[j + 2];
      L[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    }
    const r = Math.max(2, Math.round(w * 0.014));
    bR = boxBlur(R, w, h, r);
    bG = boxBlur(G, w, h, r);
    bB = boxBlur(B, w, h, r);
    bL = boxBlur(L, w, h, r);
  }
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let r = d[j];
    let g = d[j + 1];
    let b = d[j + 2];
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (blemM && bR && bG && bB && bL) {
      // 주변보다 어두운 작은 점(잡티)만 주변 색으로 메운다
      const diff = bL[i] - lum;
      const wgt = blemM[i] * t.blemish * Math.min(1, Math.max(0, (diff - 5) / 14));
      if (wgt > 0) {
        r += (bR[i] - r) * wgt;
        g += (bG[i] - g) * wgt;
        b += (bB[i] - b) * wgt;
        lum = 0.299 * r + 0.587 * g + 0.114 * b;
      }
    }
    if (under) {
      const up = under[i] * t.underEye * 34 * (1 - lum / 255);
      r += up;
      g += up;
      b += up;
    }
    if (eyeM) {
      const up = eyeM[i] * t.eyeBright * 38 * (lum / 255);
      r += up;
      g += up;
      b += up;
    }
    if (teethM) {
      // 치아 쪽만: 노란기를 빼고(회색으로 당김) 밝게
      const k = teethM[i] * t.teeth * (lum > 90 ? 0.75 : 0.25);
      r += (lum + 24 - r) * k;
      g += (lum + 24 - g) * k;
      b += (lum + 24 - b) * k;
    }
    if (shineM && lum > 150) {
      const down = shineM[i] * t.shine * (lum - 150) * 0.5;
      r -= down;
      g -= down;
      b -= down;
    }
    d[j] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[j + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[j + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
  ctx.putImageData(img, 0, 0);

  if (t.contour > 0) {
    // 광대 아래·턱선은 어둡게, 콧날·이마 가운데는 밝게. 부드러운 원형 그라데이션을 얹는다
    for (const f of faces) {
      const g = geo(f, w, h);
      const shade = (x: number, y: number, rx: number, ry: number, color: string, alpha: number, mode: GlobalCompositeOperation) => {
        ctx.save();
        ctx.globalCompositeOperation = mode;
        ctx.translate(x, y);
        ctx.scale(rx, ry);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        grad.addColorStop(0, `rgba(${color},${alpha})`);
        grad.addColorStop(1, `rgba(${color},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
      };
      for (const i of [205, 425]) {
        const p = g.P(i);
        shade(p.x, p.y + 0.05 * g.faceH, 0.16 * g.faceW, 0.1 * g.faceH, "0,0,0", 0.34 * t.contour, "multiply");
      }
      for (const [list] of [[JAW_L], [JAW_R]] as const) {
        const p = g.P(list[3]);
        shade(p.x, p.y, 0.13 * g.faceW, 0.1 * g.faceH, "0,0,0", 0.28 * t.contour, "multiply");
      }
      const br = g.P(168);
      const tp = g.P(6);
      shade((br.x + tp.x) / 2, (br.y + tp.y) / 2, 0.035 * g.faceW, 0.16 * g.faceH, "255,255,255", 0.32 * t.contour, "soft-light");
      const fo = g.P(10);
      shade(fo.x, fo.y + 0.13 * g.faceH, 0.2 * g.faceW, 0.1 * g.faceH, "255,255,255", 0.22 * t.contour, "soft-light");
    }
  }
  return out;
}

/** 모양 + 피부 보정을 한꺼번에: 부분 보정(원본 랜드마크 기준) → 비틀기 */
export function faceFx(src: HTMLCanvasElement, faces: Face[], t: Tone): HTMLCanvasElement {
  if (!faces.length || !hasFaceFx(t)) return src;
  return warpFaces(retouchFaces(src, faces, t), faces, t);
}

/** 촬영 직후: 얼굴 효과가 켜져 있을 때만 얼굴을 찾아 적용하고, 아니면 그대로 돌려준다 */
export async function prepareRaw(raw: HTMLCanvasElement, tone: Tone): Promise<HTMLCanvasElement> {
  if (!hasFaceFx(tone)) return raw;
  const faces = await detectFaces(raw);
  return faces && faces.length ? faceFx(raw, faces, tone) : raw;
}
