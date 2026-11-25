// 개발용 가짜 컷 — 카메라 없이 레이아웃·처리 파이프라인을 확인하기 위한 얼굴 일러스트
import { processCut, encodeCut } from "./process";

export function drawSampleFace(seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 480;
  const ctx = c.getContext("2d")!;
  const rnd = (i: number) => ((Math.sin(seed * 97.13 + i * 13.7) + 1) / 2);
  // 커튼 배경
  ctx.fillStyle = `hsl(${rnd(1) * 360} 25% ${35 + rnd(2) * 20}%)`;
  ctx.fillRect(0, 0, 640, 480);
  for (let x = 0; x < 640; x += 26) {
    ctx.fillStyle = `rgba(0,0,0,${0.08 + rnd(x) * 0.08})`;
    ctx.fillRect(x, 0, 12, 480);
  }
  const cx = 320 + (rnd(3) - 0.5) * 60;
  const cy = 210 + (rnd(4) - 0.5) * 30;
  // 어깨
  ctx.fillStyle = `hsl(${rnd(5) * 360} 40% ${20 + rnd(6) * 30}%)`;
  ctx.beginPath();
  ctx.ellipse(cx, 480, 170, 140, 0, Math.PI, 0);
  ctx.fill();
  // 얼굴
  ctx.fillStyle = `hsl(28 45% ${62 + rnd(7) * 18}%)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 72, 90, 0, 0, Math.PI * 2);
  ctx.fill();
  // 머리
  ctx.fillStyle = `hsl(25 30% ${8 + rnd(8) * 25}%)`;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 50, 80, 55 + rnd(9) * 20, 0, Math.PI, 0);
  ctx.fill();
  // 눈·입
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.arc(cx - 26, cy - 5, 7, 0, Math.PI * 2);
  ctx.arc(cx + 26, cy - 5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#5a2a2a";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy + 30, 22 + rnd(10) * 8, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  return c;
}

export async function sampleCutBlobs(seed: number) {
  const processed = processCut(drawSampleFace(seed), { framing: { zoom: 1.1, offsetY: 0 }, seed: seed + 1 });
  return encodeCut(processed);
}
