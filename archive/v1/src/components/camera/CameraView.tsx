"use client";

import type { RefObject } from "react";
import { cropRect, type Framing } from "@/lib/imaging/process";
import styles from "./CameraView.module.css";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  size: { w: number; h: number } | null;
  framing: Framing;
  /** 점선 얼굴 가이드 */
  guide?: boolean;
  /** 찍힌 컷 정지 화면 */
  still?: string | null;
}

/**
 * 3:4 정면 유리창. processCut()과 같은 cropRect로 비디오를 배치해 "보이는 대로 찍히게" 한다.
 * 미리보기만 거울 모드, 흑백 필터는 CSS로(실제 처리는 canvas).
 */
export default function CameraView({ videoRef, size, framing, guide = true, still }: Props) {
  let videoStyle: React.CSSProperties = { inset: 0, width: "100%", height: "100%", objectFit: "cover" };
  if (size) {
    const r = cropRect(size.w, size.h, framing);
    videoStyle = {
      width: `${(size.w / r.w) * 100}%`,
      height: `${(size.h / r.h) * 100}%`,
      left: `${(-r.x / r.w) * 100}%`,
      top: `${(-r.y / r.h) * 100}%`,
    };
  }
  return (
    <div className={styles.window}>
      <video ref={videoRef} className={styles.video} style={videoStyle} playsInline muted autoPlay />
      {still && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={still} alt="방금 찍은 컷" className={styles.still} />
      )}
      {guide && !still && (
        <svg className={styles.guide} viewBox="0 0 300 400" aria-hidden>
          <ellipse cx="150" cy="165" rx="72" ry="92" />
          <path d="M 40 400 Q 46 285 150 272 Q 254 285 260 400" />
        </svg>
      )}
    </div>
  );
}
