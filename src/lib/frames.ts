// 프레임(인화지 모양) 정의 — 세로 스트립 2·3·4컷, 모두 검정 프레임.
// 화면 미리보기와 저장용 canvas가 같은 좌표를 쓴다. 단위: 칸 너비 = 1

import { CUT_ASPECT } from "./config";

export interface Frame {
  key: string;
  name: string;
  count: number;
  /** 저장 이미지(3:4 배경) 안에서 사진이 차지할 수 있는 최대 크기(px, 1080×1440 기준).
   *  컷이 적을수록 작게 가운데에 놓여 배경 여백이 넓어진다 */
  story: { w: number; h: number };
}

export const FRAMES: Frame[] = [
  // 1컷: 3×3으로 나눈 격자의 가운데 칸만큼
  { key: "one", name: "one", count: 1, story: { w: 360, h: 480 } },
  { key: "two", name: "two", count: 2, story: { w: 640, h: 800 } },
  { key: "three", name: "three", count: 3, story: { w: 640, h: 1100 } },
  { key: "four", name: "four", count: 4, story: { w: 640, h: 1240 } },
];

export const getFrame = (key: string) => FRAMES.find((f) => f.key === key) ?? FRAMES[FRAMES.length - 1];

const PAD = 0.02;
const GAP = 0.014;
const FOOT = 0.055;

export interface FrameGeometry {
  w: number;
  h: number;
  cells: { x: number; y: number; w: number; h: number }[];
  /** 아래 여백(날짜 들어가는 곳)의 시작 y와 높이 */
  footY: number;
  footH: number;
}

export function frameGeometry(f: Frame): FrameGeometry {
  const ch = 1 / CUT_ASPECT;
  const gridH = f.count * ch + (f.count - 1) * GAP;
  return {
    w: PAD * 2 + 1,
    h: PAD + gridH + FOOT,
    cells: Array.from({ length: f.count }, (_, i) => ({ x: PAD, y: PAD + i * (ch + GAP), w: 1, h: ch })),
    footY: PAD + gridH,
    footH: FOOT,
  };
}
