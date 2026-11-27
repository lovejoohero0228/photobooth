"use client";

// 배출구 — 2초 뒤 사진이 T자 손잡이 뒤로 드르륵 내려와 놓이고, 곧 그 사진이 그대로 커진다.
// 커진 뒤에는 사진 크기는 그대로 두고 뒤 배경만 바꿔 가며 저장·공유한다.
import { useCallback, useEffect, useRef, useState } from "react";
import css from "./Delivery.module.css";
import { BACKDROPS, composeBackdrop, composeStory, saveImage, shareBlob, stripFilename, type Backdrop } from "@/lib/develop";
import { detectInApp } from "@/lib/env";
import { PRINT_SECS } from "@/lib/config";

type Phase = "wait" | "drop" | "rest" | "held";

interface Props {
  url: string;
  blob: Blob;
  w: number;
  h: number;
  leaving: boolean;
  onAgain: () => void;
}

const DROP_MS = 2000;
const REST_MS = 1500;

export default function Delivery({ url, blob, w, h, leaving, onAgain }: Props) {
  const [phase, setPhase] = useState<Phase>("wait");
  const [held, setHeld] = useState<string | undefined>();
  const [hint, setHint] = useState<string | null>(null);
  const [backdrop, setBackdrop] = useState<Backdrop | null>(null);
  /** 화면에 깔린 배경 이미지 */
  const [scene, setScene] = useState<{ key: Backdrop; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const strip = useRef<HTMLImageElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** 저장 이미지(1080 폭)에서 사진이 차지하는 폭의 비율 */
  const stripFrac = Math.min((1500 * w) / h, 800) / 1080;
  const scenes = useRef(new Map<Backdrop, string>());
  const stories = useRef(new Map<Backdrop, Blob>());

  /** 배출구에 놓인 사진을 그 자리에서 화면 가운데로 키운다 */
  const pick = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const box = stage.current;
    if (!box) return;
    const r = el.getBoundingClientRect();
    const sr = box.getBoundingClientRect();
    // 저장되는 9:16 이미지(composeStory)와 같은 자리 · 같은 비율로 놓는다
    const s = (sr.width * stripFrac) / r.width;
    const dx = sr.left + sr.width / 2 - (r.left + r.width / 2);
    const dy = sr.top + sr.height / 2 - (r.top + r.height / 2);
    setHeld(`translate(${dx}px, ${dy}px) scale(${s}) rotate(-2deg)`);
    setPhase("held");
  }, [stripFrac]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const t0 = PRINT_SECS * 1000 + 200;
    at(t0, () => {
      setPhase("drop");
    });
    at(t0 + DROP_MS, () => setPhase("rest"));
    at(t0 + DROP_MS + REST_MS, pick);
    const made = scenes.current;
    return () => {
      timers.forEach(clearTimeout);
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [pick]);

  /** 사진은 그대로, 뒤 배경만 바꾼다 */
  async function choose(key: Backdrop | null) {
    setHint(null);
    setBackdrop(key);
    if (!key) return;
    let u = scenes.current.get(key);
    if (!u) {
      try {
        u = URL.createObjectURL(await composeBackdrop(key));
        scenes.current.set(key, u);
      } catch {
        setBackdrop(null);
        return;
      }
    }
    setScene({ key, url: u });
  }

  /** 저장·공유할 이미지: 배경을 골랐으면 9:16으로 합친 것 */
  async function output(): Promise<{ blob: Blob; name: string }> {
    if (!backdrop) return { blob, name: stripFilename() };
    let b = stories.current.get(backdrop);
    if (!b) {
      b = await composeStory(blob, backdrop);
      stories.current.set(backdrop, b);
    }
    return { blob: b, name: stripFilename(new Date(), backdrop) };
  }

  async function run(kind: "save" | "share") {
    setBusy(true);
    try {
      const o = await output();
      if (kind === "save") {
        const r = await saveImage(o.blob, o.name, detectInApp() !== null);
        setHint(r === "longpress" ? "이 앱 안에서는 저장이 막혀 있어요. 사진을 길게 눌러 저장하세요" : null);
      } else {
        const ok = await shareBlob(o.blob, o.name);
        setHint(ok ? null : "이 브라우저에선 공유가 안 돼요. 저장한 뒤 올려 주세요");
      }
    } catch {
      setHint("이미지를 만들지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={css.root} data-phase={phase} data-leaving={leaving}>
      <div className={css.wood} />
      {/* 저장되는 9:16 화면을 그대로 보여 주는 고정 틀 */}
      <div ref={stage} className={css.stage} aria-hidden="true">
        {scene && <div key={scene.key} className={css.scene} data-on={backdrop === scene.key} style={{ backgroundImage: `url(${scene.url})` }} />}
      </div>

      <div className={css.col}>
        <div className={css.plates}>
          <div className={`${css.plate} f-plate`}>
            <i />
            <i />
            <i />
            <i />
            Photos
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
              src={url}
              alt="방금 찍은 사진"
              draggable={false}
              onClick={phase === "rest" ? pick : undefined}
              style={{
                aspectRatio: `${w} / ${h}`,
                height: `min(48dvh, calc(min(46vw, 190px) * ${h / w}))`,
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
          <div className={css.swatches} role="radiogroup" aria-label="배경">
            <button role="radio" aria-checked={backdrop === null} data-on={backdrop === null} onClick={() => void choose(null)}>
              <i data-kind="plain" />
              Plain
            </button>
            {BACKDROPS.map((b) => (
              <button key={b.key} role="radio" aria-checked={backdrop === b.key} data-on={backdrop === b.key} onClick={() => void choose(b.key)}>
                <i data-kind="photo" style={{ backgroundImage: `url(${b.src})` }} />
                {b.name}
              </button>
            ))}
          </div>
          <div className={css.pair}>
            <button className={css.act} data-main="true" disabled={busy} onClick={() => void run("save")}>
              save
            </button>
            <button className={css.act} disabled={busy} onClick={() => void run("share")}>
              share
            </button>
          </div>
          <button className={css.again} onClick={onAgain}>
            한 번 더 찍기 →
          </button>
        </div>
      )}
    </div>
  );
}
