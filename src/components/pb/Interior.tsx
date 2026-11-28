"use client";

// 부스 안 — 원목 벽에 렌즈(LOOK · HERE)와 화면. 버튼 하나로 연속 촬영하고, 프레임과 넣을 사진을 고른다.
import { useEffect, useRef, useState } from "react";
import css from "./Interior.module.css";
import { FRAMES, frameGeometry, getFrame, type Frame } from "@/lib/frames";
import { composeStrip, developRaw, loadImage, rawCut, type Developed } from "@/lib/develop";
import { prepareRaw, warmFaceModel } from "@/lib/face";
import { getTone, hasFaceFx } from "@/lib/tone";
import { makeSamplePhotos } from "@/lib/samples";
import { useCamera } from "@/components/camera/useCamera";
import { COUNT_FROM, COUNT_MS, SHOTS, STILL_MS, ZOOM_LEVELS } from "@/lib/config";

type Phase = "camera" | "shooting" | "pick" | "develop";

export interface Shot {
  canvas: HTMLCanvasElement;
  url: string;
}

export interface ShootResult extends Developed {
  frame: string;
  /** 찍은 컷 전부와 고른 순서 — 배출구에서 레이아웃 화면으로 돌아올 때 그대로 되살린다 */
  shots: Shot[];
  picked: number[];
  date: Date;
}

interface Props {
  leaving: boolean;
  onExit: () => void;
  onDone: (r: ShootResult) => void;
  /** 배출구에서 돌아온 경우: 카메라 없이 고르기 화면부터 */
  initial?: Pick<ShootResult, "frame" | "shots" | "picked">;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const TICK = COUNT_MS / COUNT_FROM;

/** 고른 사진이 들어간 검정 프레임 미리보기 */
function StripPreview({ frame, shots, picked }: { frame: Frame; shots: Shot[]; picked: number[] }) {
  const g = frameGeometry(frame);
  return (
    <div className={css.strip} style={{ aspectRatio: `${g.w} / ${g.h}`, ["--ar" as string]: g.w / g.h }}>
      {g.cells.map((c, i) => (
        <span
          key={i}
          style={{
            left: `${(c.x / g.w) * 100}%`,
            top: `${(c.y / g.h) * 100}%`,
            width: `${(c.w / g.w) * 100}%`,
            height: `${(c.h / g.h) * 100}%`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {picked[i] !== undefined ? <img src={shots[picked[i]].url} alt="" /> : i + 1}
        </span>
      ))}
    </div>
  );
}

export default function Interior({ leaving, onExit, onDone, initial }: Props) {
  const { videoRef, state: camState, error: camError, zoom, level, setLevel, hasTorch, torch, start: startCam, stop: stopCam } = useCamera();
  const [phase, setPhase] = useState<Phase>(initial ? "pick" : "camera");
  const [shots, setShots] = useState<Shot[]>(initial?.shots ?? []);
  const [count, setCount] = useState<number | null>(null);
  const [still, setStill] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [frameKey, setFrameKey] = useState(initial?.frame ?? "four");
  const [picked, setPicked] = useState<number[]>(initial?.picked ?? []);
  const [note, setNote] = useState<string | null>(null);
  /** 촬영 플래시 켜기(기억해 둔다) / 지금 화면이 환하게 켜져 있는가 */
  const [flashOn, setFlashOn] = useState(false);
  const [lit, setLit] = useState(false);

  const frame = getFrame(frameKey);
  const run = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  /** 카운트다운을 건너뛰고 지금 찍기 */
  const skipRef = useRef<(() => void) | null>(null);

  // 들어오자마자 카메라를 켠다
  useEffect(() => {
    if (!initial) void Promise.resolve().then(startCam);
    void Promise.resolve().then(() => {
      try {
        if (localStorage.getItem("pb.flash") === "1") setFlashOn(true);
      } catch {}
    });
    // 얼굴 보정이 켜져 있으면 모델을 미리 읽어 둔다
    const t = getTone();
    if (hasFaceFx(t)) warmFaceModel();
    return () => {
      run.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startCam]);

  function retake() {
    run.current++;
    setShots([]);
    setPicked([]);
    setCount(null);
    setStill(null);
    setNote(null);
    setPhase("camera");
    void startCam();
  }

  /** 연속 촬영. 한 장마다 5부터 1까지 세고, shoot now를 누르면 기다리지 않고 바로 찍는다 */
  async function shoot() {
    const v = videoRef.current;
    if (!v || camState !== "ready") return;
    const id = ++run.current;
    setPhase("shooting");
    const taken: Shot[] = [];
    for (let i = 0; i < SHOTS; i++) {
      let preflashed = false;
      /** 플래시: 내장 플래시(토치)가 있으면 그걸 켜고, 없으면(전면 카메라 대부분) 화면을 환하게 켠다 */
      const preflash = async () => {
        if (!flashOn || preflashed) return;
        preflashed = true;
        if (!(await torch(true))) setLit(true);
      };
      for (let n = COUNT_FROM; n >= 1; n--) {
        setCount(n);
        if (n === 1) void preflash();
        // 기다리는 동안 shoot now가 눌리면 곧바로 깨어난다
        const skipped = await new Promise<boolean>((res) => {
          const t = setTimeout(() => res(false), TICK);
          skipRef.current = () => {
            clearTimeout(t);
            res(true);
          };
        });
        skipRef.current = null;
        if (run.current !== id) return;
        if (skipped) break;
      }
      // shoot now로 건너뛰었어도 플래시가 켜진 뒤 잠깐(0.35초) 기다렸다가 찍는다
      if (flashOn && !preflashed) {
        await preflash();
        await sleep(350);
        if (run.current !== id) return;
      }
      setCount(null);
      setFlash((f) => f + 1);
      const tone = getTone();
      const canvas = developRaw(await prepareRaw(rawCut(v, zoom), tone), tone);
      const shot = { canvas, url: canvas.toDataURL("image/jpeg", 0.72) };
      taken.push(shot);
      setShots([...taken]);
      setStill(shot.url);
      if (flashOn) {
        setLit(false);
        void torch(false);
      }
      await sleep(STILL_MS);
      if (run.current !== id) return;
      setStill(null);
    }
    stopCam();
    setLit(false);
    setPhase("pick");
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const id = ++run.current;
    stopCam();
    setNote(null);
    try {
      const taken: Shot[] = [];
      for (const file of Array.from(files).slice(0, SHOTS)) {
        const tone = getTone();
        const canvas = developRaw(await prepareRaw(rawCut(await loadImage(file)), tone), tone);
        if (run.current !== id) return;
        taken.push({ canvas, url: canvas.toDataURL("image/jpeg", 0.72) });
      }
      setShots(taken);
      setPicked([]);
      setPhase("pick");
    } catch {
      if (run.current === id) setNote("could not open that photo. try another one");
    }
  }

  /** 카메라 없이 샘플 컷 6장으로 바로 고르기 단계로 간다 (뒷 단계 확인용) */
  function loadSamples() {
    ++run.current;
    stopCam();
    setNote(null);
    const taken: Shot[] = makeSamplePhotos().map((raw) => {
      const canvas = developRaw(raw);
      return { canvas, url: canvas.toDataURL("image/jpeg", 0.72) };
    });
    setShots(taken);
    setPicked([]);
    setPhase("pick");
  }

  function toggle(i: number) {
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < frame.count ? [...p, i] : p));
  }

  function chooseFrame(f: Frame) {
    setFrameKey(f.key);
    setPicked((p) => p.slice(0, f.count));
  }

  async function finish() {
    if (Math.min(frame.count, shots.length) !== picked.length) return;
    const id = ++run.current;
    setPhase("develop");
    try {
      const date = new Date();
      const out = await composeStrip(
        picked.map((i) => shots[i].canvas),
        frame,
        date,
      );
      if (run.current !== id) return;
      onDone({ ...out, frame: frame.key, shots, picked, date });
    } catch {
      if (run.current !== id) return;
      setNote("printing failed. please try again");
      setPhase("pick");
    }
  }

  const camReady = camState === "ready";
  const camBroken = camState === "denied" || camState === "unsupported" || camState === "error";
  const picking = phase === "pick" || phase === "develop";
  const need = Math.min(frame.count, shots.length) - picked.length;

  return (
    <div className={css.wall} data-leaving={leaving}>
      <header className={css.top}>
        <button className={css.back} onClick={picking ? retake : onExit} disabled={phase === "shooting" || phase === "develop"}>
          {picking ? "← retake" : "← exit"}
        </button>
      </header>

      <div className={css.cam} data-hidden={picking}>
        {/* 벽에 뚫린 구멍 속 카메라 렌즈 */}
        <div className={css.lensRow} aria-hidden="true">
          <span>look</span>
          <div className={css.lens}>
            <i />
          </div>
          <span>here</span>
        </div>

        <div className={css.stage}>
          <div className={css.bezel}>
            <div className={css.glass}>
              <video ref={videoRef} className={css.video} playsInline muted autoPlay data-on={camReady && !still} style={{ transform: `scale(${-zoom}, ${zoom})` }} />
              {camReady && phase === "camera" && (
                <div className={css.zoom} role="radiogroup" aria-label="zoom">
                  {ZOOM_LEVELS.map((z) => (
                    <button key={z} role="radio" aria-checked={level === z} data-on={level === z} onClick={() => setLevel(z)}>
                      {z}x
                    </button>
                  ))}
                  <span aria-hidden="true" className={css.zoomSep} />
                  <button
                    role="switch"
                    aria-label={hasTorch ? "flash (camera flash)" : "flash (screen flash)"}
                    aria-checked={flashOn}
                    data-on={flashOn}
                    onClick={() => {
                      const next = !flashOn;
                      setFlashOn(next);
                      try {
                        localStorage.setItem("pb.flash", next ? "1" : "0");
                      } catch {}
                    }}
                  >
                    flash {flashOn ? "on" : "off"}
                  </button>
                </div>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {still && <img className={css.still} src={still} alt="" />}
              {camState === "starting" && <p className={css.msg}>starting camera…</p>}
              {camBroken && (
                <div className={css.broken}>
                  <p>{camError}</p>
                  <button onClick={() => void startCam()}>try again</button>
                  <button onClick={() => fileRef.current?.click()}>upload photos</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={css.dots} aria-label={`${shots.length} of ${SHOTS} shots taken`}>
          {Array.from({ length: SHOTS }, (_, i) => (
            <i key={i} data-on={i < shots.length} />
          ))}
        </div>

        {/* 버튼을 누르면 그 자리에서 카운트다운 */}
        <div className={css.action}>
          {phase === "shooting" ? (
            <>
              <span className={css.count} aria-live="assertive">
                {count !== null && <b key={`${shots.length}-${count}`}>{count}</b>}
              </span>
              <button className={css.now} disabled={count === null} onClick={() => skipRef.current?.()}>
                shoot now
              </button>
            </>
          ) : (
            <>
              <button className={css.start} disabled={!camReady} onClick={() => void shoot()}>
                <i />
                start shooting
              </button>
              <button className={css.sample} onClick={loadSamples}>
                or try with sample photos
              </button>
            </>
          )}
        </div>
      </div>

      {picking && (
        <div className={css.pick}>
          <div className={css.seg} role="tablist" aria-label="layout">
            {FRAMES.map((f) => (
              <button key={f.key} role="tab" aria-selected={f.key === frame.key} data-on={f.key === frame.key} onClick={() => chooseFrame(f)}>
                {f.count} {f.count === 1 ? "cut" : "cuts"}
              </button>
            ))}
          </div>

          <div className={css.preview}>
            <StripPreview frame={frame} shots={shots} picked={picked} />
          </div>

          <div className={css.grid}>
            {shots.map((s, i) => {
              const at = picked.indexOf(i);
              return (
                <button key={i} className={css.thumb} data-on={at >= 0} data-dim={at < 0 && need === 0} onClick={() => toggle(i)} aria-label={`photo ${i + 1}${at >= 0 ? `, placed in slot ${at + 1}` : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.url} alt="" />
                  {at >= 0 && <b>{at + 1}</b>}
                </button>
              );
            })}
          </div>

          <button className={css.done} disabled={need > 0 || phase === "develop"} onClick={() => void finish()}>
            {phase === "develop" ? "printing…" : need > 0 ? `pick ${need} more` : "print →"}
          </button>
        </div>
      )}

      {note && (
        <p className={css.note} role="alert">
          {note}
        </p>
      )}
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (void upload(e.target.files), (e.target.value = ""))} />
      {/* 화면 플래시: 촬영 직전에 화면 전체를 환하게 켠다 */}
      <div className={css.lit} data-on={lit} aria-hidden="true" />
      {flash > 0 && <div key={flash} className={css.flash} />}
    </div>
  );
}
