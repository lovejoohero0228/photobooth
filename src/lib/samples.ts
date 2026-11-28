// 샘플 사진: 카메라 없이 촬영 뒤 단계(레이아웃 고르기 → 인화 → 배경 선택)로 바로 가 보기 위한 그림.
// 얼굴 모양의 간단한 캐릭터를 canvas에 그려서, 실제 촬영 컷과 같은 크기의 컷 6장을 만든다.
import { CELL_PX, CUT_ASPECT, SHOTS } from "./config";

type Face = "smile" | "open" | "wink" | "flat" | "kiss" | "grin";

const BGS: [string, string][] = [
  ["#8d7b69", "#4e4237"],
  ["#6e7f8a", "#34424b"],
  ["#9a7d7a", "#52393a"],
  ["#7e8a72", "#3c4535"],
  ["#8a7fa0", "#3f3a52"],
  ["#a09074", "#52472f"],
];
const FACES: Face[] = ["smile", "open", "wink", "grin", "kiss", "flat"];
const SKIN = ["#e9c9a8", "#d9ab86", "#f1d6bb", "#c99872", "#e4bf9c", "#d6a883"];
const HAIR = ["#2a1d17", "#14110f", "#5a3a22", "#1f1a22", "#3b2a1c", "#0f0f12"];

function draw(i: number): HTMLCanvasElement {
  const w = CELL_PX;
  const h = Math.round(CELL_PX / CUT_ASPECT);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;

  // 배경
  const [a, b] = BGS[i % BGS.length];
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // 사람마다 조금씩 다른 위치·크기
  const cx = w * (0.5 + (((i * 37) % 7) - 3) * 0.018);
  const cy = h * (0.46 + (((i * 53) % 5) - 2) * 0.012);
  const hr = w * (0.2 + (i % 3) * 0.012);
  const tilt = ((((i * 29) % 9) - 4) * Math.PI) / 180;

  // 어깨
  ctx.fillStyle = ["#2e3a4e", "#4a2e2e", "#2f4a3b", "#4d4a2e", "#3d2e4a", "#2e2e2e"][i % 6];
  ctx.beginPath();
  ctx.ellipse(cx, h * 1.02, w * 0.46, h * 0.3, 0, Math.PI, 0);
  ctx.fill();
  // 목
  ctx.fillStyle = SKIN[i % SKIN.length];
  ctx.fillRect(cx - hr * 0.28, cy + hr * 0.7, hr * 0.56, hr * 0.8);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  // 머리카락(뒤)
  ctx.fillStyle = HAIR[i % HAIR.length];
  ctx.beginPath();
  ctx.ellipse(0, -hr * 0.05, hr * 1.1, hr * 1.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // 얼굴
  ctx.fillStyle = SKIN[i % SKIN.length];
  ctx.beginPath();
  ctx.ellipse(0, hr * 0.08, hr * 0.92, hr * 1.05, 0, 0, Math.PI * 2);
  ctx.fill();
  // 앞머리
  ctx.fillStyle = HAIR[i % HAIR.length];
  ctx.beginPath();
  ctx.ellipse(0, -hr * 0.78, hr * 0.98, hr * 0.42, 0, Math.PI, 0);
  ctx.fill();
  // 볼
  ctx.fillStyle = "rgba(220,110,100,0.32)";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * hr * 0.55, hr * 0.38, hr * 0.17, hr * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 눈 · 입
  const face = FACES[i % FACES.length];
  ctx.strokeStyle = "#1a1210";
  ctx.fillStyle = "#1a1210";
  ctx.lineWidth = hr * 0.07;
  ctx.lineCap = "round";
  const ey = -hr * 0.02;
  for (const s of [-1, 1]) {
    if (face === "wink" && s === 1) {
      ctx.beginPath();
      ctx.arc(s * hr * 0.36, ey, hr * 0.12, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(s * hr * 0.36, ey, hr * 0.08, hr * 0.11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const my = hr * 0.52;
  ctx.beginPath();
  if (face === "smile") ctx.arc(0, my - hr * 0.18, hr * 0.34, Math.PI * 0.15, Math.PI * 0.85);
  else if (face === "grin") {
    ctx.fillStyle = "#fff";
    ctx.arc(0, my - hr * 0.12, hr * 0.38, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, my - hr * 0.12, hr * 0.38, 0, Math.PI);
  } else if (face === "open") {
    ctx.fillStyle = "#4a1410";
    ctx.ellipse(0, my + hr * 0.02, hr * 0.2, hr * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (face === "kiss") ctx.ellipse(0, my + hr * 0.02, hr * 0.1, hr * 0.12, 0, 0, Math.PI * 2);
  else {
    ctx.moveTo(-hr * 0.22, my + hr * 0.02);
    ctx.lineTo(hr * 0.22, my + hr * 0.02);
  }
  ctx.stroke();
  ctx.restore();

  // 소품: 파티 모자
  if (i % 3 === 1) {
    ctx.save();
    ctx.translate(cx + hr * 0.2, cy - hr * 1.05);
    ctx.rotate(tilt + 0.2);
    ctx.fillStyle = "#d9442e";
    ctx.beginPath();
    ctx.moveTo(-hr * 0.4, 0);
    ctx.lineTo(0, -hr * 1.0);
    ctx.lineTo(hr * 0.4, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f2d36b";
    ctx.beginPath();
    ctx.arc(0, -hr * 1.02, hr * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  return c;
}

/** 촬영 장수만큼의 샘플 컷(색 그대로). developRaw로 흑백 현상을 거치면 실제 컷과 같아진다 */
export function makeSamplePhotos(): HTMLCanvasElement[] {
  return Array.from({ length: SHOTS }, (_, i) => draw(i));
}
