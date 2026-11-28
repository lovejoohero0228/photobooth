// 뷰티 후보정: 피부 매끈하게(결은 살리는 에지 보존 블러), 부드러운 빛번짐, 그늘 밝히기.
// ctx.filter는 iOS Safari에서 불안정해서, 상자 블러를 직접 구현한다.

/** 상자 블러(가로 → 세로, 두 번 반복해 가우시안에 가깝게). 가장자리는 끝 값을 늘려 쓴다 */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const a = new Float32Array(src);
  const b = new Float32Array(src.length);
  const size = 2 * r + 1;
  for (let it = 0; it < 2; it++) {
    // 가로
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = a[row] * r;
      for (let x = 0; x <= r; x++) sum += a[row + Math.min(x, w - 1)];
      for (let x = 0; x < w; x++) {
        b[row + x] = sum / size;
        const add = a[row + Math.min(x + r + 1, w - 1)];
        const sub = a[row + Math.max(x - r, 0)];
        sum += add - sub;
      }
    }
    // 세로
    for (let x = 0; x < w; x++) {
      let sum = b[x] * r;
      for (let y = 0; y <= r; y++) sum += b[Math.min(y, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = sum / size;
        const add = b[Math.min(y + r + 1, h - 1) * w + x];
        const sub = b[Math.max(y - r, 0) * w + x];
        sum += add - sub;
      }
    }
  }
  return a;
}

export interface BeautyParams {
  smooth: number;
  glow: number;
  lift: number;
}

/** RGBA 픽셀 배열을 제자리에서 고친다. 반지름은 이미지 폭에 비례해서, 미리보기와 저장본이 같은 모양이 된다 */
export function applyBeauty(d: Uint8ClampedArray, w: number, h: number, p: BeautyParams) {
  if (p.smooth <= 0 && p.glow <= 0 && p.lift <= 0) return;
  const n = w * h;
  const R = new Float32Array(n);
  const G = new Float32Array(n);
  const B = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    R[i] = d[j];
    G[i] = d[j + 1];
    B[i] = d[j + 2];
  }

  if (p.smooth > 0) {
    const r = Math.max(1, Math.round(w * 0.0075));
    const bR = boxBlur(R, w, h, r);
    const bG = boxBlur(G, w, h, r);
    const bB = boxBlur(B, w, h, r);
    for (let i = 0; i < n; i++) {
      const lum = 0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i];
      const lumB = 0.299 * bR[i] + 0.587 * bG[i] + 0.114 * bB[i];
      const diff = Math.abs(lum - lumB);
      // 잔 대비(잡티·피부결)는 많이 줄이고, 눈·입술·머리카락 같은 큰 대비는 남긴다
      const wgt = p.smooth * Math.exp(-((diff / 16) ** 2));
      R[i] += (bR[i] - R[i]) * wgt;
      G[i] += (bG[i] - G[i]) * wgt;
      B[i] += (bB[i] - B[i]) * wgt;
    }
  }

  if (p.glow > 0) {
    const r = Math.max(2, Math.round(w * 0.028));
    const bR = boxBlur(R, w, h, r);
    const bG = boxBlur(G, w, h, r);
    const bB = boxBlur(B, w, h, r);
    const k = 0.55 * p.glow;
    for (let i = 0; i < n; i++) {
      // 소프트 포커스: 흐린 사진을 섞고, 밝은 곳은 스크린으로 살짝 번지게
      R[i] = R[i] * (1 - k) + bR[i] * k;
      G[i] = G[i] * (1 - k) + bG[i] * k;
      B[i] = B[i] * (1 - k) + bB[i] * k;
      const glow = (0.299 * bR[i] + 0.587 * bG[i] + 0.114 * bB[i]) / 255;
      const add = 26 * p.glow * glow * glow;
      R[i] += add;
      G[i] += add;
      B[i] += add;
    }
  }

  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let r = R[i];
    let g = G[i];
    let b = B[i];
    if (p.lift > 0) {
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const up = p.lift * 60 * (1 - lum) * (1 - lum);
      r += up;
      g += up;
      b += up;
    }
    d[j] = r < 0 ? 0 : r > 255 ? 255 : r;
    d[j + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
    d[j + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
  }
}
