// 프레임(인화지 모양) 정의 — 세로 스트립 2·3·4컷, 모두 검정 프레임.
// 화면 미리보기와 저장용 canvas가 같은 좌표를 쓴다. 단위: 칸 너비 = 1

import { CUT_ASPECT } from "./config";

export interface Frame {
  key: string;
  name: string;
  count: number;
}

export const FRAMES: Frame[] = [
  { key: "two", name: "두 컷", count: 2 },
  { key: "three", name: "세 컷", count: 3 },
  { key: "four", name: "네 컷", count: 4 },
];

export const getFrame = (key: string) => FRAMES.find((f) => f.key === key) ?? FRAMES[2];

const PAD = 0.065;
const GAP = 0.045;
const FOOT = 0.15;

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
