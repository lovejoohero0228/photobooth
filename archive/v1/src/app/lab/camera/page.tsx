"use client";

// 개발용: 카메라 촬영 + 흑백·입자·날짜 각인 단독 검증 (iOS Safari 실기기 확인용)
import { useState } from "react";
import CameraView from "@/components/camera/CameraView";
import { useCamera } from "@/components/camera/useCamera";
import { DEFAULT_FRAMING, encodeCut, processCut, type Framing } from "@/lib/imaging/process";
import { drawSampleFace } from "@/lib/imaging/sample";
import { downloadBlob } from "@/lib/imaging/compose";

export default function CameraLab() {
  const cam = useCamera();
  const [framing, setFraming] = useState<Framing>(DEFAULT_FRAMING);
  const [still, setStill] = useState<string | null>(null);
  const [info, setInfo] = useState("");

  async function shoot(fromSample = false) {
    const t0 = performance.now();
    const src = fromSample ? drawSampleFace(Date.now() % 1000) : cam.videoRef.current!;
    const canvas = processCut(src, { framing });
    const t1 = performance.now();
    const { full, thumb } = await encodeCut(canvas);
    setInfo(`처리 ${Math.round(t1 - t0)}ms · ${canvas.width}×${canvas.height} · ${full.type} ${(full.size / 1024).toFixed(0)}KB · 썸네일 ${(thumb.size / 1024).toFixed(0)}KB`);
    setStill(URL.createObjectURL(full));
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: 16, display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 18 }}>카메라 실험실</h1>
      <CameraView videoRef={cam.videoRef} size={cam.size} framing={framing} still={still} />
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        상태: {cam.state} {cam.size && `(${cam.size.w}×${cam.size.h})`} {cam.error}
      </p>
      <label style={{ fontSize: 14 }}>
        확대 {framing.zoom.toFixed(2)}
        <input type="range" min={1} max={2} step={0.01} value={framing.zoom} onChange={(e) => setFraming({ ...framing, zoom: +e.target.value })} style={{ width: "100%" }} />
      </label>
      <label style={{ fontSize: 14 }}>
        세로 위치 {framing.offsetY.toFixed(2)}
        <input type="range" min={-1} max={1} step={0.01} value={framing.offsetY} onChange={(e) => setFraming({ ...framing, offsetY: +e.target.value })} style={{ width: "100%" }} />
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {cam.state !== "ready" ? (
          <button className="btn" onClick={cam.start}>
            카메라 켜기
          </button>
        ) : still ? (
          <button className="btn" onClick={() => setStill(null)}>
            다시 찍기
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => shoot()}>
            ● 찍기
          </button>
        )}
        <button className="btn btn-ghost" onClick={() => shoot(true)}>
          샘플로 처리
        </button>
        {still && (
          <button className="btn btn-ghost" onClick={async () => downloadBlob(await (await fetch(still)).blob(), "cut.jpg")}>
            저장
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, opacity: 0.6 }}>{info}</p>
    </main>
  );
}
