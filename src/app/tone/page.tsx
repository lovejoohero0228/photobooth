"use client";

// 톤 비교용 임시 페이지 (/tone). 사진 한 장을 찍거나 불러와서 후보 톤들을 나란히 비교한다.
import { useEffect, useRef, useState } from "react";
import { useCamera } from "@/components/camera/useCamera";
import { developRaw, loadImage, rawCut } from "@/lib/develop";
import { TONE_CANDIDATES } from "@/lib/tone";

function Candidate({ raw, name, tone }: { raw: HTMLCanvasElement; name: string; tone: (typeof TONE_CANDIDATES)[number]["tone"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const out = developRaw(raw, tone);
    const c = ref.current;
    if (!c) return;
    c.width = out.width;
    c.height = out.height;
    c.getContext("2d")!.drawImage(out, 0, 0);
  }, [raw, tone]);
  return (
    <figure style={{ margin: 0 }}>
      <canvas ref={ref} style={{ width: "100%", display: "block", background: "#000" }} />
      <figcaption style={{ marginTop: 6, fontSize: 13, letterSpacing: "0.06em", textAlign: "center" }}>{name}</figcaption>
    </figure>
  );
}

export default function TonePage() {
  const { videoRef, state, error, zoom, start } = useCamera();
  const [raw, setRaw] = useState<HTMLCanvasElement | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.resolve().then(start);
  }, [start]);

  return (
    <main style={{ minHeight: "100dvh", padding: "16px 14px 40px", background: "#0b0a09", color: "#ede4d0" }}>
      <p style={{ fontSize: 14, opacity: 0.7, marginBottom: 10 }}>tone lab — take a photo (or upload), then compare</p>

      <div style={{ position: "relative", width: "min(100%, 320px)", aspectRatio: "4 / 5", margin: "0 auto", background: "#000", overflow: "hidden" }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${-zoom}, ${zoom})` }} />
        {state !== "ready" && <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 13, padding: 16, textAlign: "center" }}>{error ?? "starting camera…"}</p>}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 24, margin: "14px 0 22px" }}>
        <button
          disabled={state !== "ready"}
          onClick={() => videoRef.current && setRaw(rawCut(videoRef.current, zoom))}
          style={{ color: "#d9bf72", fontSize: 16, letterSpacing: "0.1em", opacity: state === "ready" ? 1 : 0.4 }}
        >
          capture
        </button>
        <button onClick={() => file.current?.click()} style={{ fontSize: 16, letterSpacing: "0.1em" }}>
          upload
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) setRaw(rawCut(await loadImage(f)));
            e.target.value = "";
          }}
        />
      </div>

      {raw && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, maxWidth: 520, margin: "0 auto" }}>
          {TONE_CANDIDATES.map((c) => (
            <Candidate key={c.key} raw={raw} name={c.name} tone={c.tone} />
          ))}
        </div>
      )}
    </main>
  );
}
