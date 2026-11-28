"use client";

// 톤 · 색감 · 뷰티 실험 페이지 (/tone). 사진 한 장을 찍거나 불러와서 슬라이더로 값을 만져 보고,
// 마음에 드는 값을 이 기기에 저장해 앱에서 바로 써 보거나 DEFAULT_TONE에 옮겨 적는다.
import { useEffect, useMemo, useRef, useState } from "react";
import { useCamera } from "@/components/camera/useCamera";
import { developRaw, loadImage, paperGrain, rawCut } from "@/lib/develop";
import { makeSamplePhotos } from "@/lib/samples";
import { detectFaces, faceFx, warmFaceModel, type Face } from "@/lib/face";
import { addPreset, clearTone, DEFAULT_TONE, getTone, hasSavedTone, loadPresets, removePreset, saveTone, TONE_CONTROLS, TONE_PRESETS, type SavedPreset, type Tone } from "@/lib/tone";

const PREVIEW_W = 360;

/** 처리 속도를 위해 줄인 복사본 (뷰티 반지름이 폭에 비례해서 저장본과 같은 모양이 된다) */
function shrink(raw: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = PREVIEW_W;
  c.height = Math.round((raw.height * PREVIEW_W) / raw.width);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(raw, 0, 0, c.width, c.height);
  return c;
}

function Canvas({ src, tone, faces, caption, printed }: { src: HTMLCanvasElement; tone?: Tone; faces?: Face[] | null; caption: string; printed?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    // 얼굴 보정(모양 · 피부 · 눈) → 톤 · 뷰티
    // 슬라이더를 빠르게 움직일 때는 잠깐 기다렸다가 한 번만 그린다 (원본 해상도는 무겁다)
    const id = setTimeout(() => {
      const base = tone && faces?.length ? faceFx(src, faces, tone) : src;
      const out = tone ? developRaw(base, tone) : src;
      c.width = out.width;
      c.height = out.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(out, 0, 0);
      // 인화한 사진처럼: 인화지 결까지 얹는다
      if (tone && printed) paperGrain(ctx, c.width, c.height);
    }, printed ? 120 : 0);
    return () => clearTimeout(id);
  }, [src, tone, faces, printed]);
  return (
    <figure style={{ margin: 0 }}>
      <canvas ref={ref} style={{ width: "100%", display: "block", background: "#000" }} />
      <figcaption style={{ marginTop: 6, fontSize: 12, letterSpacing: "0.08em", textAlign: "center", opacity: 0.7 }}>{caption}</figcaption>
    </figure>
  );
}

const btn: React.CSSProperties = { fontSize: 15, letterSpacing: "0.08em", padding: "10px 6px", minHeight: 44 };

export default function TonePage() {
  const { videoRef, state, error, zoom, start, stop } = useCamera();
  const [raw, setRaw] = useState<HTMLCanvasElement | null>(null);
  const [tone, setTone] = useState<Tone>(DEFAULT_TONE);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<SavedPreset[]>([]);
  /** 사진에서 찾은 얼굴들. null이면 아직 / 실패 */
  const [faces, setFaces] = useState<Face[] | null>(null);
  const [faceState, setFaceState] = useState<"idle" | "finding" | "found" | "none" | "failed">("idle");
  /** 앱에서 실제로 인화될 때와 똑같이: 원본 해상도 + 인화지 결 */
  const [exact, setExact] = useState(true);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setTone(getTone());
      setSaved(hasSavedTone());
      setMine(loadPresets());
      warmFaceModel();
      void start();
    });
    return stop;
  }, [start, stop]);

  const small = useMemo(() => (raw ? shrink(raw) : null), [raw]);

  // 사진이 바뀔 때마다 얼굴을 한 번만 찾아 둔다 (슬라이더를 움직일 때는 다시 찾지 않는다)
  useEffect(() => {
    if (!small) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      setFaces(null);
      setFaceState("finding");
    });
    void detectFaces(small).then((f) => {
      if (!alive) return;
      if (f === null) setFaceState("failed");
      else {
        setFaces(f);
        setFaceState(f.length ? "found" : "none");
      }
    });
    return () => {
      alive = false;
    };
  }, [small]);
  const set = (key: keyof Tone, v: number) => setTone((t) => ({ ...t, [key]: v }));
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1800);
  };
  const json = JSON.stringify(tone, null, 2);

  return (
    <main style={{ minHeight: "100dvh", padding: "16px 14px 60px", background: "#0b0a09", color: "#ede4d0", maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 4 }}>tone lab</h1>
      <p style={{ fontSize: 13, opacity: 0.65, marginBottom: 14, lineHeight: 1.5 }}>
        take or load a photo, then adjust tone, color and beauty. changes show instantly. &lsquo;use on this device&rsquo; makes the booth use these values.
      </p>

      {/* 사진 고르기 */}
      <div style={{ position: "relative", width: "min(100%, 260px)", aspectRatio: "4 / 5", margin: "0 auto", background: "#000", overflow: "hidden" }}>
        <video ref={videoRef} playsInline muted autoPlay style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${-zoom}, ${zoom})` }} />
        {state !== "ready" && <p style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 13, padding: 16, textAlign: "center" }}>{error ?? "starting camera…"}</p>}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 22, margin: "8px 0 18px" }}>
        <button disabled={state !== "ready"} onClick={() => videoRef.current && setRaw(rawCut(videoRef.current, zoom))} style={{ ...btn, color: "#d9bf72", opacity: state === "ready" ? 1 : 0.4 }}>
          capture
        </button>
        <button onClick={() => file.current?.click()} style={btn}>
          upload
        </button>
        <button onClick={() => setRaw(makeSamplePhotos()[1])} style={btn}>
          sample
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

      {/* 전 · 후 */}
      {small ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, position: "sticky", top: 0, zIndex: 2, padding: "8px 0", background: "linear-gradient(#0b0a09 85%, transparent)" }}>
          <Canvas src={exact && raw ? raw : small} caption="original" />
          <Canvas src={exact && raw ? raw : small} tone={tone} faces={faces} caption={exact ? "result (as printed)" : "result (fast)"} printed={exact} />
        </div>
      ) : (
        <p style={{ textAlign: "center", fontSize: 13, opacity: 0.5, padding: "30px 0" }}>capture, upload or pick a sample to start</p>
      )}
      {small && (
        <button onClick={() => setExact((v) => !v)} style={{ display: "block", margin: "2px auto 0", fontSize: 12.5, letterSpacing: "0.06em", minHeight: 36, color: exact ? "#d9bf72" : undefined, opacity: exact ? 1 : 0.7 }}>
          {exact ? "exact preview: full resolution + paper grain (on)" : "exact preview (off) — fast but differs from the booth"}
        </button>
      )}
      {small && (
        <p style={{ fontSize: 12, opacity: 0.6, minHeight: 18, textAlign: "center" }}>
          {faceState === "finding" && "finding faces…"}
          {faceState === "found" && `${faces?.length} face${faces?.length === 1 ? "" : "s"} found — face effects are active`}
          {faceState === "none" && "no face found — face effects have no effect on this photo"}
          {faceState === "failed" && "could not load the face model"}
        </p>
      )}

      {/* 내가 저장한 프리셋 */}
      <h2 style={{ fontSize: 12, letterSpacing: "0.14em", opacity: 0.55, margin: "18px 0 6px" }}>my presets</h2>
      {mine.length === 0 && <p style={{ fontSize: 12.5, opacity: 0.5, lineHeight: 1.5 }}>nothing saved yet. set the sliders you like, then press &lsquo;save as preset&rsquo; — it is added as preset 1, 2, 3…</p>}
      <div style={{ display: "grid", gap: 2 }}>
        {mine.map((p) => {
          const on = JSON.stringify(p.tone) === JSON.stringify(tone);
          const t = p.tone;
          const beauty = TONE_CONTROLS.filter((g) => g.group !== "tone" && g.group !== "color")
            .flatMap((g) => g.items)
            .filter((it) => t[it.key] !== 0)
            .map((it) => `${it.label.split(" (")[0]} ${t[it.key]}`)
            .join(" · ");
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "1fr 40px", alignItems: "center" }}>
              <button onClick={() => setTone(p.tone)} style={{ textAlign: "left", padding: "7px 0", minHeight: 44 }}>
                <span style={{ fontSize: 14, letterSpacing: "0.06em", color: on ? "#d9bf72" : undefined }}>{p.name}</span>
                <span style={{ display: "block", fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                  exp {t.gain} · contrast {t.contrast} · bright {t.offset}
                  {t.saturation ? ` · sat ${t.saturation}` : " · b&w"}
                  {beauty ? ` · ${beauty}` : ""}
                </span>
              </button>
              <button aria-label={`delete ${p.name}`} onClick={() => setMine(removePreset(p.id))} style={{ opacity: 0.5, fontSize: 16, minHeight: 44 }}>
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* 기본 프리셋 */}
      <h2 style={{ fontSize: 12, letterSpacing: "0.14em", opacity: 0.55, margin: "18px 0 8px" }}>presets</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
        {TONE_PRESETS.map((p) => (
          <button key={p.key} onClick={() => setTone(p.tone)} style={{ fontSize: 13.5, letterSpacing: "0.06em", minHeight: 38, color: JSON.stringify(p.tone) === JSON.stringify(tone) ? "#d9bf72" : undefined, opacity: JSON.stringify(p.tone) === JSON.stringify(tone) ? 1 : 0.7 }}>
            {p.name}
          </button>
        ))}
      </div>

      {/* 슬라이더 */}
      {TONE_CONTROLS.map((g) => (
        <section key={g.group}>
          <h2 style={{ fontSize: 12, letterSpacing: "0.14em", opacity: 0.55, margin: "20px 0 4px" }}>{g.group}</h2>
          {g.items.map((it) => {
            const v = tone[it.key];
            return (
              <label key={it.key} style={{ display: "grid", gridTemplateColumns: "118px 1fr 48px", alignItems: "center", gap: 10, minHeight: 40, fontSize: 13 }}>
                <span style={{ opacity: 0.8 }}>{it.label}</span>
                <input type="range" min={it.min} max={it.max} step={it.step} value={v} onChange={(e) => set(it.key, Number(e.target.value))} style={{ width: "100%", accentColor: "#d9bf72" }} />
                <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>{Number.isInteger(it.step) ? v : v.toFixed(2)}</span>
              </label>
            );
          })}
        </section>
      ))}

      {/* 저장 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 20px", marginTop: 22 }}>
        <button
          style={{ ...btn, color: "#d9bf72", fontWeight: 700 }}
          onClick={() => {
            saveTone(tone);
            setSaved(true);
            flash("saved — the booth now uses these values on this device");
          }}
        >
          use on this device
        </button>
        <button
          style={btn}
          onClick={() => {
            const next = addPreset(tone);
            setMine(next);
            flash(`saved as ${next[next.length - 1].name}`);
          }}
        >
          save as preset
        </button>
        <button
          style={btn}
          onClick={() => {
            clearTone();
            setSaved(false);
            setTone(DEFAULT_TONE);
            flash("back to the default values");
          }}
        >
          reset
        </button>
        <button
          style={btn}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(json);
              flash("values copied");
            } catch {
              flash("copy failed — select the text below");
            }
          }}
        >
          copy values
        </button>
      </div>
      <p style={{ fontSize: 12, opacity: 0.6, marginTop: 4, minHeight: 18 }}>{msg ?? (saved ? "this device is using saved custom values" : "this device is using the default values")}</p>

      <pre style={{ marginTop: 10, padding: 12, fontSize: 12, lineHeight: 1.5, background: "rgba(255,255,255,0.05)", overflowX: "auto", userSelect: "text", WebkitUserSelect: "text" }}>{json}</pre>
      <p style={{ fontSize: 12, opacity: 0.55, lineHeight: 1.6 }}>
        to make these the permanent defaults for everyone, paste the values into <code>DEFAULT_TONE</code> in <code>src/lib/tone.ts</code>.
      </p>
    </main>
  );
}
