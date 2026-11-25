// 원거리 뷰의 코르크 게시판 — 실제 사진 수·내용과 무관하게 항상 같은 고정 디자인.
// 크림색 빈 종이 실루엣 약 10장(세로 스트립·정사각 격자·넓은 콘택트 시트) + 압정/테이프.

import type { PinType } from "@/lib/types";
import PinDecor from "./PinDecor";
import styles from "./CorkBoardSilhouette.module.css";

/** % 좌표 (코르크 안쪽 기준) */
const PAPERS: { x: number; y: number; w: number; h: number; r: number; pin: PinType }[] = [
  { x: 6, y: 7, w: 13, h: 44, r: -4, pin: "pushpin" }, // 세로 스트립
  { x: 24, y: 9, w: 26, h: 22, r: 3, pin: "tape" }, // 정사각 격자
  { x: 56, y: 5, w: 36, h: 18, r: -2, pin: "pushpin" }, // 넓은 콘택트 시트
  { x: 58, y: 30, w: 15, h: 19, r: 5, pin: "magnet" },
  { x: 78, y: 28, w: 12, h: 38, r: 2, pin: "clip" },
  { x: 25, y: 38, w: 28, h: 15, r: -3, pin: "tape" },
  { x: 8, y: 60, w: 24, h: 24, r: 4, pin: "pushpin" },
  { x: 37, y: 60, w: 14, h: 32, r: -6, pin: "clip" },
  { x: 56, y: 56, w: 20, h: 20, r: -2, pin: "magnet" },
  { x: 60, y: 80, w: 32, h: 13, r: 3, pin: "tape" },
];

export default function CorkBoardSilhouette({ decor }: { decor?: boolean }) {
  return (
    <div className={styles.frame}>
      <div className={`${styles.cork} cork`}>
        {PAPERS.map((p, i) => (
          <div
            key={i}
            className={styles.paper}
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, transform: `rotate(${p.r}deg)` }}
          >
            <PinDecor type={p.pin} size={18} />
          </div>
        ))}
      </div>
      {decor && (
        <div className={styles.lights} aria-hidden>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} style={{ left: `${3 + i * 7}%`, animationDelay: `${(i % 4) * 0.4}s`, background: ["#F2C46B", "#e86a5a", "#9fd39a", "#F2C46B"][i % 4] }} />
          ))}
        </div>
      )}
    </div>
  );
}
