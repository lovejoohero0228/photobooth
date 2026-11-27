"use client";

// 부스 안 — 원목 벽에 렌즈(LOOK · HERE)와 화면. 버튼 하나로 연속 촬영하고, 프레임과 넣을 사진을 고른다.
import { useEffect, useRef, useState } from "react";
import css from "./Interior.module.css";
import { FRAMES, frameGeometry, type Frame } from "@/lib/frames";
import { composeStrip, developCut, loadImage, type Developed } from "@/lib/develop";
import { useCamera } from "@/components/camera/useCamera";
import { COUNT_FROM, COUNT_MS, SHOTS, STILL_MS } from "@/lib/config";
import { playClick, playShutter } from "@/lib/sound";

type Phase = "camera" | "shooting" | "pick" | "develop";

interface Shot {
  canvas: HTMLCanvasElement;
  url: string;
}

export interface ShootResult extends Developed {
  frame: string;
}

interface Props {
  leaving: boolean;
  onExit: () => void;
  onDone: (r: ShootResult) => void;
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

export default function Interior({ leaving, onExit, onDone }: Props) {
  const { videoRef, state: camState, error: camError, start: startCam, stop: stopCam } = useCamera();
  const [phase, setPhase] = useState<Phase>("camera");
  const [shots, setShots] = useState<Shot[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [still, setStill] = useState<string | null>(null);
  const [flash, setFlash] = useState(0);
  const [frameKey, setFrameKey] = useState("four");
  const [picked, setPicked] = useState<number[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const frame = FRAMES.find((f) => f.key === frameKey) ?? FRAMES[2];
  const run = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  // 들어오자마자 카메라를 켠다
  useEffect(() => {
    void Promise.resolve().then(startCam);
    return () => {
      run.current++;
    };
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

  /** 연속 촬영. 한 장마다 3부터 1까지 센다 */
  async function shoot() {
    const v = videoRef.current;
    if (!v || camState !== "ready") return;
    playClick();
    const id = ++run.current;
    setPhase("shooting");
    const taken: Shot[] = [];
    for (let i = 0; i < SHOTS; i++) {
      for (let n = COUNT_FROM; n >= 1; n--) {
        setCount(n);
        await sleep(TICK);
        if (run.current !== id) return;
      }
      setCount(null);
      playShutter();
      setFlash((f) => f + 1);
      const canvas = developCut(v);
      const shot = { canvas, url: canvas.toDataURL("image/jpeg", 0.72) };
      taken.push(shot);
      setShots([...taken]);
      setStill(shot.url);
      await sleep(STILL_MS);
      if (run.current !== id) return;
      setStill(null);
    }
    stopCam();
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
        const canvas = developCut(await loadImage(file));
        if (run.current !== id) return;
        taken.push({ canvas, url: canvas.toDataURL("image/jpeg", 0.72) });
      }
      setShots(taken);
      setPicked([]);
      setPhase("pick");
    } catch {
      if (run.current === id) setNote("사진을 열 수 없어요. 다른 사진으로 해 보세요");
    }
  }

  function toggle(i: number) {
    playClick();
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < frame.count ? [...p, i] : p));
  }

  function chooseFrame(f: Frame) {
    playClick();
    setFrameKey(f.key);
    setPicked((p) => p.slice(0, f.count));
  }

  async function finish() {
    if (Math.min(frame.count, shots.length) !== picked.length) return;
    playClick();
    const id = ++run.current;
    setPhase("develop");
    try {
      const out = await composeStrip(
        picked.map((i) => shots[i].canvas),
        frame,
        new Date(),
      );
      if (run.current !== id) return;
      onDone({ ...out, frame: frame.key });
    } catch {
      if (run.current !== id) return;
      setNote("인화에 실패했어요. 다시 해 주세요");
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
          <span>LOOK</span>
          <div className={css.lens}>
            <i />
          </div>
          <span>HERE</span>
        </div>

        <div className={css.stage}>
          <div className={css.bezel}>
            <div className={css.glass}>
              <video ref={videoRef} className={css.video} playsInline muted autoPlay data-on={camReady && !still} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {still && <img className={css.still} src={still} alt="" />}
              {camState === "starting" && <p className={css.msg}>카메라 켜는 중…</p>}
              {camBroken && (
                <div className={css.broken}>
                  <p>{camError}</p>
                  <button onClick={() => void startCam()}>다시 시도</button>
                  <button onClick={() => fileRef.current?.click()}>사진 불러오기</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={css.dots} aria-label={`${SHOTS}장 중 ${shots.length}장 찍음`}>
          {Array.from({ length: SHOTS }, (_, i) => (
            <i key={i} data-on={i < shots.length} />
          ))}
        </div>

        {/* 버튼을 누르면 그 자리에서 카운트다운 */}
        <div className={css.action}>
          {phase === "shooting" ? (
            <span className={css.count} aria-live="assertive">
              {count !== null && <b key={`${shots.length}-${count}`}>{count}</b>}
            </span>
          ) : (
            <button className={css.start} disabled={!camReady} onClick={() => void shoot()}>
              <i />
              촬영 시작하기
            </button>
          )}
        </div>
      </div>

      {picking && (
        <div className={css.pick}>
          <div className={css.seg} role="tablist" aria-label="프레임">
            {FRAMES.map((f) => (
              <button key={f.key} role="tab" aria-selected={f.key === frame.key} data-on={f.key === frame.key} onClick={() => chooseFrame(f)}>
                {f.count} cuts
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
                <button key={i} className={css.thumb} data-on={at >= 0} data-dim={at < 0 && need === 0} onClick={() => toggle(i)} aria-label={`${i + 1}번 사진${at >= 0 ? `, ${at + 1}번째 칸에 넣음` : ""}`}>
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
      {flash > 0 && <div key={flash} className={css.flash} />}
    </div>
  );
}
