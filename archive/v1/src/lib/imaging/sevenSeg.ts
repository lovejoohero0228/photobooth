// 필름 카메라식 주황색 디지털 날짜 각인 ('26 12 24). 폰트 없이 7-세그먼트를 직접 그린다.

// 세그먼트: a(위) b(오른위) c(오른아래) d(아래) e(왼아래) f(왼위) g(가운데)
const DIGITS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};

export function formatImprint(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `'${yy} ${mm} ${dd}`;
}

function drawDigit(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, h: number, t: number) {
  const segs = DIGITS[ch];
  if (!segs) return;
  const half = h / 2;
  const s = (name: string, x0: number, y0: number, x1: number, y1: number) => {
    if (!segs.includes(name)) return;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  // 살짝 기울인 이탤릭 7세그
  const k = 0.12 * w;
  const X = (xx: number, yy: number) => xx + k * (1 - (yy - y) / h);
  ctx.lineWidth = t;
  ctx.lineCap = "round";
  s("a", X(x + t, y), y, X(x + w - t, y), y);
  s("b", X(x + w, y + t), y + t, X(x + w, y + half - t), y + half - t);
  s("c", X(x + w, y + half + t), y + half + t, X(x + w, y + h - t), y + h - t);
  s("d", X(x + t, y + h), y + h, X(x + w - t, y + h), y + h);
  s("e", X(x, y + half + t), y + half + t, X(x, y + h - t), y + h - t);
  s("f", X(x, y + t), y + t, X(x, y + half - t), y + half - t);
  s("g", X(x + t, y + half), y + half, X(x + w - t, y + half), y + half);
}

export function drawDateImprint(ctx: CanvasRenderingContext2D, w: number, h: number, date: Date) {
  const text = formatImprint(date);
  const dh = h * 0.032;
  const dw = dh * 0.52;
  const t = Math.max(2, dh * 0.15);
  const gapDigit = dw * 0.45;
  const gapSpace = dw * 0.9;
  // 전체 폭 계산
  let total = 0;
  for (const ch of text) total += ch === " " ? gapSpace : ch === "'" ? dw * 0.4 : dw + gapDigit;
  const x = w - total - w * 0.06;
  const y = h - dh - h * 0.045;

  ctx.save();
  ctx.strokeStyle = "#ff8a1e";
  ctx.fillStyle = "#ff8a1e";
  ctx.globalCompositeOperation = "screen";
  // 번짐(헐레이션) 레이어 → 본 레이어
  for (const pass of [0, 1]) {
    ctx.shadowColor = "rgba(255,110,20,0.9)";
    ctx.shadowBlur = pass === 0 ? dh * 0.6 : dh * 0.15;
    ctx.globalAlpha = pass === 0 ? 0.5 : 0.95;
    let cx = x;
    for (const ch of text) {
      if (ch === " ") {
        cx += gapSpace;
      } else if (ch === "'") {
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.moveTo(cx + dw * 0.25, y);
        ctx.lineTo(cx + dw * 0.15, y + dh * 0.22);
        ctx.stroke();
        cx += dw * 0.4;
      } else {
        drawDigit(ctx, ch, cx, y, dw, dh, t);
        cx += dw + gapDigit;
      }
    }
  }
  ctx.restore();
}
