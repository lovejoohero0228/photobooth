"use client";

// 부스 내부 촬영 화면 — 한 폰으로 돌아가며 한 컷씩.
// 빨간 버튼 → 안내판에 랜덤 포즈 → 전구 3·2·1 → 플래시+셔터 → 단체컷 속 내 자리로 미리보기
// → "이 컷으로 끼기"/"다시 찍기"(무제한) → 이름·뒷면 한마디(선택) → 다음 사람 / 다 찍었어요
// → (새 단체컷이면) 이름·레이아웃·인화 여부 → 커튼 밖으로 → 배출구

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CameraView from "@/components/camera/CameraView";
import { useCamera } from "@/components/camera/useCamera";
import GroupPhoto from "@/components/GroupPhoto";
import ChairDial from "./ChairDial";
import InAppNotice from "@/components/InAppNotice";
import { encodeCut, processCut, type Framing } from "@/lib/imaging/process";
import { DEFAULT_LAYOUT_KEY, getLayout, layoutsForTier, resolveLayoutKey, tierOf } from "@/lib/layouts";
import { MAX_PARTICIPANTS, randomPose } from "@/lib/config";
import { getStore, useStoreQuery, type NewCut } from "@/lib/store";
import { playBeep, playCoin, playShutter, unlockAudio } from "@/lib/sound";
import type { CutView } from "@/lib/types";
import styles from "./BoothInterior.module.css";

type Phase = "ready" | "countdown" | "review" | "note" | "next" | "finish" | "leaving";

interface SessionCut extends NewCut {
  url: string;
}

/** 다이얼 값(0~1) → 프레이밍. 의자를 올릴수록 얼굴이 크게, 위쪽으로 */
function framingFor(t: number): Framing {
  return { zoom: 1.05 + t * 0.4, offsetY: 0.7 - t * 1.4 };
}

export default function BoothInterior() {
  const router = useRouter();
  const params = useSearchParams();
  const existingId = params.get("photo");
  const { data: existing, loading } = useStoreQuery((s) => (existingId ? s.getPhoto(existingId) : Promise.resolve(null)), [existingId]);

  const cam = useCamera();
  const [dial, setDial] = useState(0.35);
  const framing = framingFor(dial);
  const [phase, setPhase] = useState<Phase>("ready");
  const [pose, setPose] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [flash, setFlash] = useState(false);
  const [current, setCurrent] = useState<{ full: Blob; thumb: Blob; url: string } | null>(null);
  const [session, setSession] = useState<SessionCut[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [title, setTitle] = useState("");
  const [layoutKey, setLayoutKey] = useState(DEFAULT_LAYOUT_KEY);
  const [printNow, setPrintNow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { start: startCamera, stop: stopCamera } = cam;
  useEffect(() => {
    void startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const baseCuts: CutView[] = useMemo(() => existing?.cuts ?? [], [existing]);
  const isNew = !existingId;
  const total = baseCuts.length + session.length;
  const mySlot = total;
  const full = total >= MAX_PARTICIPANTS;

  // 단체컷 미리보기: 기존 컷 + 이번 세션 컷 + (확인 중이면) 방금 찍은 컷
  const previewCuts: CutView[] = useMemo(() => {
    const list = [
      ...baseCuts,
      ...session.map((c, i) => ({ id: `s${i}`, name: c.name, imageUrl: c.url, thumbUrl: c.url, slotIndex: baseCuts.length + i })),
    ];
    if (current && (phase === "review" || phase === "note")) list.push({ id: "cur", name, imageUrl: current.url, thumbUrl: current.url, slotIndex: list.length });
    return list;
  }, [baseCuts, session, current, phase, name]);

  const previewLayout = resolveLayoutKey(existing?.photo.layoutKey ?? layoutKey, Math.max(1, previewCuts.length));
  const signTitle = existing?.photo.title ?? (title.trim() || "새 단체컷");

  if (existingId && !loading && (!existing || existing.photo.status === "printed")) {
    return (
      <main className={styles.blocked}>
        <p>{existing ? "이미 인화가 끝난 사진이라 더 넣을 수 없어요." : "사진을 찾을 수 없어요."}</p>
        <button className="btn" onClick={() => router.push("/")}>
          스페이스로
        </button>
      </main>
    );
  }

  async function capture(src?: HTMLImageElement) {
    try {
      const video = cam.videoRef.current;
      const source = src ?? video;
      if (!source) return;
      const canvas = processCut(source, { framing: src ? { zoom: 1, offsetY: 0 } : framing });
      const blobs = await encodeCut(canvas);
      setCurrent({ ...blobs, url: URL.createObjectURL(blobs.full) });
      setPhase("review");
    } catch {
      setError("사진을 처리하지 못했어요. 다시 찍어주세요");
      setPhase("ready");
    }
  }

  async function shoot() {
    if (phase !== "ready" || full) return;
    unlockAudio();
    setError(null);
    const p = pose ?? randomPose();
    setPose(p);
    setPhase("countdown");
    for (const n of [3, 2, 1]) {
      setCount(n);
      playBeep(n === 1);
      await new Promise((r) => setTimeout(r, 900));
    }
    setCount(0);
    setFlash(true);
    playShutter();
    await capture();
    setTimeout(() => setFlash(false), 450);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      void capture(img);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  }

  function retake() {
    playCoin(true);
    if (current) URL.revokeObjectURL(current.url);
    setCurrent(null);
    setPose(randomPose(pose ?? undefined));
    setPhase("ready");
  }

  function keepCut() {
    setPhase("note");
  }

  function commitCurrent() {
    if (!current) return;
    setSession((s) => [...s, { full: current.full, thumb: current.thumb, url: current.url, name: name.trim(), backComment: note.trim() || null }]);
    setCurrent(null);
    setName("");
    setNote("");
    setPhase("next");
  }

  function nextPerson() {
    playCoin(true);
    setPose(randomPose(pose ?? undefined));
    setPhase("ready");
  }

  function finish() {
    if (!session.length) return router.push("/");
    // 새 단체컷이면 현재 인원 구간의 레이아웃으로 기본값 맞추기
    setLayoutKey((k) => resolveLayoutKey(k, Math.max(1, total)));
    setPhase("finish");
  }

  async function leave() {
    setPhase("leaving");
    try {
      const store = getStore();
      let id: string;
      if (existingId) {
        await store.addCuts(existingId, session, printNow);
        id = existingId;
      } else {
        const photo = await store.createPhoto({ title: title.trim() || "이름 없는 단체컷", layoutKey, print: printNow }, session);
        id = photo.id;
      }
      stopCamera();
      // 커튼이 닫히는 시간을 기다린 뒤 밖으로
      await new Promise((r) => setTimeout(r, 700));
      router.push(`/?out=${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요");
      setPhase("finish");
    }
  }

  const camBroken = cam.state === "denied" || cam.state === "unsupported" || cam.state === "error";
  const tierOptions = layoutsForTier(tierOf(Math.max(1, total)));

  return (
    <main className={styles.booth}>
      <InAppNotice />
      <header className={styles.top}>
        <button className={styles.exit} onClick={finish} disabled={phase === "countdown" || phase === "leaving"}>
          {session.length ? "다 찍었어요" : "← 나가기"}
        </button>
      </header>

      {/* 상단 안내판: 사진 이름 + 현재 인원 / 포즈 지시 */}
      <div className={styles.sign}>
        {phase === "countdown" || (phase === "ready" && pose) ? (
          <p className={styles.pose}>
            <span>포즈</span> {pose}!
          </p>
        ) : (
          <p className={styles.signTitle}>
            {signTitle} · {total + (phase === "review" || phase === "note" ? 1 : 0)}명
          </p>
        )}
      </div>

      {/* 정면 유리창 */}
      <div className={styles.windowWrap}>
        <div className={styles.bulbs} aria-live="polite">
          {[3, 2, 1].map((n) => (
            <span key={n} className={styles.bulb} data-on={phase === "countdown" && count > 0 && count <= n} aria-label={count === n ? `${n}` : undefined}>
              {n}
            </span>
          ))}
        </div>
        <div className={styles.window}>
          <CameraView videoRef={cam.videoRef} size={cam.size} framing={framing} still={phase === "review" || phase === "note" ? current?.url : null} guide={phase === "ready" || phase === "countdown"} />
          {camBroken && phase === "ready" && (
            <div className={styles.camFallback}>
              <p>{cam.error}</p>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                카메라 앱으로 찍기
              </button>
              <button className={styles.textBtn} onClick={() => cam.start()}>
                다시 시도
              </button>
            </div>
          )}
          {cam.state === "starting" && <div className={styles.camFallback}>카메라 켜는 중…</div>}
          <input ref={fileRef} type="file" accept="image/*" capture="user" hidden onChange={onFile} />
        </div>
      </div>

      {/* 하단: 단체컷 미리보기 + 촬영 버튼 / 다이얼 */}
      <section className={styles.bottom}>
        <div className={styles.preview}>
          <GroupPhoto
            layoutKey={previewLayout}
            status="developing"
            cuts={previewCuts}
            thumbs
            noGrain
            hideEmptyLabel
            highlightSlot={phase === "review" || phase === "note" ? null : mySlot}
            style={{ maxWidth: "100%", maxHeight: "100%", display: "block", margin: "auto" }}
          />
        </div>

        <div className={styles.controls}>
          {phase === "ready" || phase === "countdown" ? (
            <>
              <button
                className={styles.shutter}
                onClick={camBroken ? () => fileRef.current?.click() : shoot}
                disabled={phase !== "ready" || full || (!camBroken && cam.state !== "ready")}
                aria-label="촬영"
              />
              <ChairDial value={dial} onChange={setDial} />
            </>
          ) : phase === "review" ? (
            <div className={styles.choice}>
              <button className="btn btn-primary" onClick={keepCut}>
                이 컷으로 끼기
              </button>
              <button className="btn btn-ghost" onClick={retake}>
                다시 찍기
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {error && <p className={styles.error}>{error}</p>}

      {/* 이름·뒷면 한마디 (선택) */}
      {phase === "note" && (
        <div className={styles.panel}>
          <h2>사진 뒷면에 남길까요?</h2>
          <input className="field" placeholder="이름 (선택)" value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
          <textarea className={`field ${styles.area}`} placeholder="한마디 (선택)" value={note} maxLength={140} rows={2} onChange={(e) => setNote(e.target.value)} />
          <div className={styles.row}>
            <button className="btn btn-ghost" onClick={() => setPhase("review")}>
              ← 뒤로
            </button>
            <button className="btn btn-primary" onClick={commitCurrent}>
              {name || note ? "남기기" : "건너뛰기"}
            </button>
          </div>
        </div>
      )}

      {/* 다음 사람 / 끝내기 */}
      {phase === "next" && (
        <div className={styles.panel}>
          <h2>{total}명째 끼었어요!</h2>
          <p className={styles.sub}>폰을 다음 사람에게 넘겨주세요.</p>
          <div className={styles.row}>
            {!full && (
              <button className="btn btn-primary" onClick={nextPerson}>
                다음 사람 찍기
              </button>
            )}
            <button className="btn" onClick={finish}>
              다 찍었어요
            </button>
          </div>
        </div>
      )}

      {/* 마무리 설정 */}
      {phase === "finish" && (
        <div className={styles.panel}>
          <h2>{isNew ? "단체컷 이름을 붙여주세요" : "거의 다 됐어요"}</h2>
          {isNew && (
            <>
              <input className="field" placeholder="예: 2026 동기 송년회" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} autoFocus />
              <div className={styles.chips}>
                {tierOptions.map((l) => (
                  <button key={l.key} className={styles.chip} data-on={resolveLayoutKey(layoutKey, Math.max(1, total)) === l.key} onClick={() => setLayoutKey(l.key)}>
                    {l.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <div className={styles.chips}>
            <button className={styles.chip} data-on={!printNow} onClick={() => setPrintNow(false)}>
              현상 중으로 두기 · 나중에 더 넣기
            </button>
            <button className={styles.chip} data-on={printNow} onClick={() => setPrintNow(true)}>
              지금 인화하기 · 마감
            </button>
          </div>
          <p className={styles.sub}>
            {total}명 · {getLayout(resolveLayoutKey(existing?.photo.layoutKey ?? layoutKey, Math.max(1, total))).name}
          </p>
          <div className={styles.row}>
            <button className="btn btn-ghost" onClick={() => setPhase(full ? "next" : "ready")}>
              더 찍기
            </button>
            <button className="btn btn-primary" onClick={leave}>
              커튼 밖으로
            </button>
          </div>
        </div>
      )}

      {/* 플래시 */}
      <div className={styles.flash} data-on={flash} aria-hidden />
      {/* 나갈 때 커튼이 닫힘 */}
      <div className={styles.curtain} data-on={phase === "leaving"} aria-hidden />
      {/* 들어올 때 커튼이 걷힘 */}
      <div className={styles.curtainIn} aria-hidden />
    </main>
  );
}
