"use client";

// 스페이스 — 짙은 초록 벽 앞의 포토부스와 코르크 게시판.
// 게시판 탭: 한 번의 확대로 테두리가 화면 밖으로 사라지며 무한 캔버스로 전환.
// 부스 탭: 동전 → 커튼 걷힘 → 부스 안으로.
// ?out=사진ID: 부스에서 나온 직후 — 배출구에서 단체컷이 드르륵 나오고, 꺼내면 게시판에 붙는다.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BoothMachine, { BOOTH_VIEWBOX, DISPENSER_SLOT, type BoothState } from "@/components/booth/BoothMachine";
import CorkBoardSilhouette from "@/components/board/CorkBoardSilhouette";
import BoardCanvas from "@/components/board/BoardCanvas";
import PhotoDetail from "@/components/photo/PhotoDetail";
import GroupPhoto from "@/components/GroupPhoto";
import InAppNotice from "@/components/InAppNotice";
import { getStore, useStoreQuery } from "@/lib/store";
import { isDecemberDecorOn } from "@/lib/config";
import { isMuted, playCoin, playDispense, setMuted, unlockAudio } from "@/lib/sound";
import styles from "./SpaceScene.module.css";

type Mode = "far" | "toBoard" | "board" | "toFar" | "toBooth" | "dispenser" | "taking";

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms: number) => new Promise((r) => setTimeout(r, reduceMotion() ? Math.min(ms, 60) : ms));

export default function SpaceScene() {
  const router = useRouter();
  const params = useSearchParams();
  const outId = params.get("out");
  const decor = isDecemberDecorOn(new Date(), params.get("deco"));

  const { data: photos } = useStoreQuery((s) => s.listPhotos(), []);
  const [mode, setMode] = useState<Mode>("far");
  const [stageT, setStageT] = useState<string>("none");
  const [booth, setBooth] = useState<BoothState>("idle");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [dispensed, setDispensed] = useState(false);
  const [muted, setMutedState] = useState(false);

  const boardRef = useRef<HTMLButtonElement>(null);
  const boothRef = useRef<HTMLButtonElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage는 클라이언트에서만 읽을 수 있음
  useEffect(() => setMutedState(isMuted()), []);

  /** 무대 안의 요소(사각형 비율 영역)를 화면에 꽉 차게 확대하는 transform */
  const zoomTransform = useCallback((el: HTMLElement, area: { x: number; y: number; w: number; h: number }, fill: number, mode: "cover" | "contain" = "cover") => {
    const r = el.getBoundingClientRect();
    const rx = r.left + area.x * r.width;
    const ry = r.top + area.y * r.height;
    const rw = area.w * r.width;
    const rh = area.h * r.height;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = (mode === "cover" ? Math.max(vw / rw, vh / rh) : Math.min(vw / rw, vh / rh)) * fill;
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    return `translate(${vw / 2 - cx * s}px, ${vh / 2 - cy * s}px) scale(${s})`;
  }, []);

  const corkArea = { x: 0.055, y: 0.055, w: 0.89, h: 0.89 };

  async function openBoard(focus: string | null = null) {
    if (!boardRef.current || mode === "toBoard" || mode === "board") return;
    setFocusId(focus);
    setStageT(zoomTransform(boardRef.current, corkArea, 1.18));
    setMode("toBoard");
    await wait(620);
    setMode("board");
  }

  async function closeBoard() {
    setMode("toFar");
    setHighlightId(null);
    await wait(80);
    setStageT("none");
    await wait(800);
    setMode("far");
  }

  async function enterBooth() {
    if (mode !== "far" || !boothRef.current) return;
    unlockAudio();
    setMode("toBooth");
    setBooth("coin");
    playCoin();
    await wait(750);
    setBooth("open");
    await wait(850);
    const doorway = { x: 170 / BOOTH_VIEWBOX.w, y: 170 / BOOTH_VIEWBOX.h, w: 168 / BOOTH_VIEWBOX.w, h: 520 / BOOTH_VIEWBOX.h };
    setStageT(zoomTransform(boothRef.current, doorway, 1.1));
    await wait(650);
    router.push("/booth");
  }

  // ── 부스에서 나온 직후: 배출구 연출
  const outPhoto = photos?.find((p) => p.photo.id === outId) ?? null;
  const started = useRef(false);
  useEffect(() => {
    if (!outId || !outPhoto || started.current || !boothRef.current) return;
    started.current = true;
    (async () => {
      await wait(350);
      const area = { x: 36 / BOOTH_VIEWBOX.w, y: 440 / BOOTH_VIEWBOX.h, w: 136 / BOOTH_VIEWBOX.w, h: 180 / BOOTH_VIEWBOX.h };
      setStageT(zoomTransform(boothRef.current!, area, 0.9, "contain"));
      setMode("dispenser");
      await wait(800);
      setBooth("dispensing");
      playDispense(1.5);
      await wait(1600);
      setDispensed(true);
    })();
  }, [outId, outPhoto, zoomTransform]);

  async function takePhoto() {
    if (!outPhoto) return;
    setMode("taking");
    await wait(1100);
    setBooth("idle");
    setDispensed(false);
    setHighlightId(outPhoto.photo.id);
    // 주소에서 out 제거 (새로고침 시 다시 연출되지 않게)
    router.replace("/");
    setFocusId(outPhoto.photo.id);
    if (boardRef.current) setStageT(zoomTransform(boardRef.current, corkArea, 1.18));
    setMode("toBoard");
    await wait(620);
    setMode("board");
  }

  const count = photos?.length ?? 0;
  const inFar = mode === "far";

  return (
    <main className={`${styles.scene} grain`}>
      <InAppNotice />
      <div className={styles.stage} style={{ transform: stageT }} data-mode={mode}>
        <div className={styles.wall} />
        <div className={styles.set}>
          <div className={styles.floor} />
          <button ref={boothRef} className={styles.booth} onClick={enterBooth} aria-label="포토부스에 들어가 새 단체컷 찍기" disabled={!inFar}>
            <BoothMachine state={booth} decor={decor} />
            {outPhoto && (
              <span
                className={styles.slot}
                style={{
                  left: `${(DISPENSER_SLOT.x / BOOTH_VIEWBOX.w) * 100}%`,
                  top: `${(DISPENSER_SLOT.y / BOOTH_VIEWBOX.h) * 100}%`,
                  width: `${(DISPENSER_SLOT.w / BOOTH_VIEWBOX.w) * 100}%`,
                  height: `${(DISPENSER_SLOT.h / BOOTH_VIEWBOX.h) * 100}%`,
                }}
              >
                <span className={styles.strip} data-out={booth === "dispensing" || mode === "taking"}>
                  <GroupPhoto layoutKey={outPhoto.photo.layoutKey} status={outPhoto.photo.status} cuts={outPhoto.cuts} thumbs noGrain hideEmptyLabel style={{ width: "100%", height: "auto", display: "block" }} />
                </span>
                {/* T자 손잡이가 사진 앞에 오도록 다시 그림 */}
                <span className={styles.handle} />
              </span>
            )}
          </button>
          <button ref={boardRef} className={styles.board} onClick={() => openBoard()} aria-label={`코르크 게시판 열기, 사진 ${count}장`} disabled={!inFar}>
            <CorkBoardSilhouette decor={decor} />
          </button>
        </div>
      </div>

      {inFar && (
        <>
          <header className={styles.header}>
            <p className={styles.hint}>
              부스를 누르면 찍고,
              <br />
              게시판을 누르면 구경해요
            </p>
            <button
              className={styles.mute}
              onClick={() => {
                setMuted(!muted);
                setMutedState(!muted);
              }}
              aria-label={muted ? "소리 켜기" : "소리 끄기"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </header>
          <p className={styles.privacy}>사진은 이 기기 안에만 저장돼요</p>
        </>
      )}

      {dispensed && mode === "dispenser" && (
        <button className={`btn btn-primary ${styles.take}`} onClick={takePhoto}>
          사진 꺼내기
        </button>
      )}

      {mode === "taking" && outPhoto && (
        <div className={styles.taken}>
          <GroupPhoto layoutKey={outPhoto.photo.layoutKey} status={outPhoto.photo.status} cuts={outPhoto.cuts} title={outPhoto.photo.title} printedAt={outPhoto.photo.printedAt} />
          <p>게시판에 붙일게요</p>
        </div>
      )}

      {photos && (mode === "board" || mode === "toFar") && (
        <BoardCanvas
          photos={photos}
          visible={mode === "board"}
          focusId={focusId}
          highlightId={highlightId}
          onOpen={setDetailId}
          onMove={(id, x, y) => getStore().movePin(id, x, y)}
          onExit={closeBoard}
        />
      )}

      {detailId && <PhotoDetail id={detailId} onClose={() => setDetailId(null)} />}
    </main>
  );
}
