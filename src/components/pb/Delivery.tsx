"use client";

// 배출구 — 2초 뒤 사진이 T자 손잡이 뒤로 드르륵 내려와 놓이고, 곧 그 사진이 그대로 커진다.
// 커진 뒤에는 사진 크기는 그대로 두고 뒤 배경만 바꿔 가며 저장·공유한다.
import { useCallback, useEffect, useRef, useState } from "react";
import css from "./Delivery.module.css";
import { BACKDROPS, composeBackdrop, composeFlat, composeStory, RATIOS, saveImage, shareBlob, storyPhotoFrac, stripFilename, type Backdrop, type Ratio } from "@/lib/develop";
import { detectInApp } from "@/lib/env";
import { frameGeometry, getFrame } from "@/lib/frames";
import { PRINT_SECS } from "@/lib/config";

type Phase = "wait" | "drop" | "rest" | "held";

interface Props {
  url: string;
  blob: Blob;
  /** 고른 컷들(프레임 없이 다시 합칠 때 쓴다) */
  cuts: HTMLCanvasElement[];
  frame: string;
  w: number;
  h: number;
  leaving: boolean;
  onAgain: () => void;
  /** 프레임·사진 고르는 화면으로 돌아가기 */
  onLayout: () => void;
}

/** 가장 긴 레이아웃(4컷)의 세로/가로 — 배출구 크기는 이걸로 고정하고, 사진만 바뀐다 */
const r4 = (() => {
  const g = frameGeometry(getFrame("four"));
  return g.h / g.w;
})();

const DROP_MS = 1100;
const REST_MS = 350;
/** 틀 위로 떠오르는 시간, 똑 떨어지는 시간 */
const LIFT_MS = 380;
const PLOP_MS = 220;

type Land = "lift" | "drop" | "set";

export default function Delivery({ url, blob, cuts, frame, w, h, leaving, onAgain, onLayout }: Props) {
  const [phase, setPhase] = useState<Phase>("wait");
  const [held, setHeld] = useState<string | undefined>();
  /** 꺼낸 사진이 틀 위로 떴다가 똑 떨어지는 단계 */
  const [land, setLand] = useState<Land>("lift");
  const [hint, setHint] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<Backdrop | null>(null);
  /** 화면에 깔린 배경 이미지 */
  const [scene, setScene] = useState<{ key: Backdrop; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** 검정 프레임(여백·날짜) 유무, 기울이기 유무 */
  const [framed, setFramed] = useState(false);
  const [tilt, setTilt] = useState(true);
  /** 저장 이미지 비율: 인스타 피드 3:4 / 스토리 9:16 */
  const [ratio, setRatio] = useState<Ratio>("3:4");
  const [flat, setFlat] = useState<{ blob: Blob; url: string; w: number; h: number } | null>(null);
  const rot = backdrop && tilt ? -2 : 0;
  const optsRef = useRef({ rot: 0 });
  const ratioRef = useRef<Ratio>("3:4");
  const cutsRef = useRef(cuts);
  const cur = !framed && flat ? flat : { url, blob, w, h };
  const strip = useRef<HTMLImageElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const scenes = useRef(new Map<string, string>());
  const stories = useRef(new Map<string, Blob>());

  /** 사진을 저장되는 3:4 틀 안 제자리(같은 크기 · 같은 기울기)로 보낸다 */
  const place = useCallback((lift = false) => {
    const el = strip.current;
    const box = stage.current;
    if (!el || !box || !el.naturalWidth) return;
    // 현재 변형을 잠시 풀고 원래 자리를 잰 뒤 되돌린다
    const prev = el.style.transform;
    el.style.transition = "none";
    el.style.transform = "none";
    const r = el.getBoundingClientRect();
    el.style.transform = prev;
    void el.offsetWidth;
    el.style.transition = "";
    const sr = box.getBoundingClientRect();
    // 저장 이미지(composeStory)에서 사진이 차지하는 폭의 비율
    const s = (sr.width * storyPhotoFrac(el.naturalWidth, el.naturalHeight, frame, ratioRef.current)) / r.width;
    // 그림자는 저장 이미지와 같은 비율로 (확대 배율을 거슬러 px 단위를 맞춘다)
    const up = lift ? 1.09 : 1;
    // 떠 있을 때는 그림자가 더 크고 흐리다
    el.style.setProperty("--k", String((sr.width / 1080 / s) * (lift ? 2.2 : 1)));
    const dx = sr.left + sr.width / 2 - (r.left + r.width / 2);
    const dy = sr.top + sr.height / 2 - (r.top + r.height / 2) - (lift ? sr.height * 0.05 : 0);
    setHeld(`translate(${dx}px, ${dy}px) scale(${s * up}) rotate(${optsRef.current.rot - (lift ? 1.5 : 0)}deg)`);
  }, [frame]);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  /** 사진을 꺼내 틀 위로 띄운 뒤 똑 떨어뜨린다 */
  const picked = useRef(false);
  const pick = useCallback(() => {
    if (picked.current) return;
    picked.current = true;
    place(true);
    setLand("lift");
    setPhase("held");
    timers.current.push(
      setTimeout(() => {
        place();
        setLand("drop");
      }, LIFT_MS),
      setTimeout(() => setLand("set"), LIFT_MS + PLOP_MS),
    );
  }, [place]);

  // 자리를 잡은 뒤 옵션(프레임·기울이기)을 바꿀 때
  useEffect(() => {
    optsRef.current = { rot };
    ratioRef.current = ratio;
    if (phase === "held" && land === "set") place();
  }, [rot, framed, ratio, phase, land, place]);

  // 프레임을 뺀 버전을 미리 만들어 둔다
  useEffect(() => {
    let alive = true;
    let u: string | undefined;
    void composeFlat(cutsRef.current, frame).then((f) => {
      if (!alive) return;
      u = URL.createObjectURL(f.blob);
      setFlat({ ...f, url: u });
    });
    return () => {
      alive = false;
      if (u) URL.revokeObjectURL(u);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mine: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => mine.push(setTimeout(fn, ms));
    const t0 = PRINT_SECS * 1000 + 100;
    const later = timers.current;
    at(t0, () => {
      setPhase("drop");
    });
    at(t0 + DROP_MS, () => setPhase("rest"));
    at(t0 + DROP_MS + REST_MS, pick);
    const made = scenes.current;
    return () => {
      mine.forEach(clearTimeout);
      later.forEach(clearTimeout);
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pick]);

  /** 사진은 그대로, 뒤 배경만 바꾼다 */
  async function choose(key: Backdrop | null, r: Ratio = ratio) {
    setHint(null);
    setBackdrop(key);
    if (!key) return;
    const sceneKey = `${key}|${r}`;
    let u = scenes.current.get(sceneKey);
    if (!u) {
      try {
        u = URL.createObjectURL(await composeBackdrop(key, r));
        scenes.current.set(sceneKey, u);
      } catch {
        setBackdrop(null);
        return;
      }
    }
    setScene({ key, url: u });
  }

  /** 저장·공유할 이미지: 배경을 골랐으면 3:4으로 합친 것 */
  async function output(): Promise<{ blob: Blob; name: string }> {
    if (!backdrop) return { blob: cur.blob, name: stripFilename(new Date(), "", framed ? "jpg" : "png") };
    const cacheKey = `${backdrop}|${framed}|${tilt}|${ratio}`;
    let b = stories.current.get(cacheKey);
    if (!b) {
      b = await composeStory(cur.blob, backdrop, frame, ratio, tilt);
      stories.current.set(cacheKey, b);
    }
    return { blob: b, name: stripFilename(new Date(), `${backdrop}-${ratio === "9:16" ? "story" : "feed"}`) };
  }

  /** save: 공유 시트가 되면 그걸로 보내고(저장 포함), 안 되면 파일로 내려받는다 */
  async function run() {
    setBusy(true);
    try {
      const o = await output();
      if (await shareBlob(o.blob, o.name)) {
        setHint(null);
      } else {
        const r = await saveImage(o.blob, o.name, detectInApp() !== null);
        setHint(r === "longpress" ? "saving is blocked in this app. press and hold the photo to save" : null);
      }
    } catch {
      setHint("could not create the image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={css.root} data-phase={phase} data-land={land} data-leaving={leaving}>
      <div className={css.wood} />
      {/* 저장되는 3:4 화면을 그대로 보여 주는 고정 틀 */}
      <div ref={stage} className={css.stage} data-ratio={ratio} aria-hidden="true">
        {scene && <div key={scene.key} className={css.scene} data-on={backdrop === scene.key} style={{ backgroundImage: `url(${scene.url})` }} />}
      </div>

      <div className={css.col} style={{ ["--r4" as string]: r4 }}>
        <div className={css.plates}>
          <div className={`${css.plate} f-plate`}>
            <i />
            <i />
            <i />
            <i />
            photos
            <br />
            delivered
            <br />
            here
          </div>
        </div>

        <div className={css.slot}>
          <div className={css.recess}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={strip}
              className={css.strip}
              data-flat={!framed}
              src={cur.url}
              onLoad={() => {
                if (phase === "held" && land === "set") place();
              }}
              alt="your photo"
              draggable={false}
              onClick={phase === "rest" ? pick : undefined}
              style={{
                aspectRatio: `${cur.w} / ${cur.h}`,
                transform: phase === "held" ? held : undefined,
              }}
            />
            <div className={css.handle} />
          </div>
        </div>
      </div>

      {phase === "held" && (
        <div className={css.actions}>
          {hint && (
            <p className={css.hint} role="status">
              {hint}
            </p>
          )}
          <div className={css.swatches} role="radiogroup" aria-label="background">
            <button role="radio" aria-checked={backdrop === null} data-on={backdrop === null} onClick={() => void choose(null)}>
              <i data-kind="plain" />
              plain
            </button>
            {BACKDROPS.map((b) => (
              <button key={b.key} role="radio" aria-checked={backdrop === b.key} data-on={backdrop === b.key} onClick={() => void choose(b.key)}>
                <i data-kind="photo" style={{ backgroundImage: `url(${b.src})` }} />
                {b.name}
              </button>
            ))}
          </div>
          <div className={css.opts}>
            {/* 꾸미기: frame · tilt */}
            <div className={css.grp} role="group" aria-label="style">
              <button data-on={framed} disabled={!flat} aria-pressed={framed} onClick={() => setFramed((v) => !v)}>
                frame
              </button>
              {backdrop && (
                <button data-on={tilt} aria-pressed={tilt} onClick={() => setTilt((v) => !v)}>
                  tilt
                </button>
              )}
            </div>
            {/* 저장 비율: 3:4 · 9:16 */}
            {backdrop && (
              <div className={css.grp} data-seg="true" role="radiogroup" aria-label="size">
                {RATIOS.map((r) => (
                  <button
                    key={r}
                    role="radio"
                    aria-checked={ratio === r}
                    data-on={ratio === r}
                    onClick={() => {
                      setRatio(r);
                      void choose(backdrop, r);
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className={css.act} data-main="true" disabled={busy} onClick={() => void run()}>
            save
          </button>
          <div className={css.more}>
            <button className={css.again} onClick={onLayout}>
              ← layout
            </button>
            <button className={css.again} onClick={onAgain}>
              shoot again →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
