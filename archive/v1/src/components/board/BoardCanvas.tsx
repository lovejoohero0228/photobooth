"use client";

// 게시판 내부 — 코르크가 끝없이 이어지는 무한 캔버스.
// 포인터 이벤트 + CSS transform으로 직접 구현: 드래그 이동, 핀치/휠 줌, 사진 드래그로 위치 옮기기.
// 화면에 보이는 사진만 렌더링(가상화), 작게 보일 때는 썸네일(LOD).

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import GroupPhoto from "@/components/GroupPhoto";
import PinDecor from "./PinDecor";
import { computeGeometry, slotCountFor } from "@/lib/layouts";
import type { PhotoWithCuts } from "@/lib/types";
import { BOARD_WORLD_K } from "@/lib/store/device";
import styles from "./BoardCanvas.module.css";

/** 레이아웃 기준 좌표 → 게시판 월드 좌표 배율 */
const WORLD_K = BOARD_WORLD_K;
const MIN_S = 0.12;
const MAX_S = 3;

interface View {
  tx: number;
  ty: number;
  s: number;
}

interface Item {
  data: PhotoWithCuts;
  w: number;
  h: number;
}

interface Props {
  photos: PhotoWithCuts[];
  /** 처음 보여줄 사진 (방금 붙인 사진) */
  focusId?: string | null;
  highlightId?: string | null;
  onOpen: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onExit: () => void;
  visible: boolean;
}

function boundsOf(items: Item[]) {
  if (!items.length) return { x0: -400, y0: -300, x1: 400, y1: 300 };
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const it of items) {
    const { x, y } = it.data.photo.pin;
    x0 = Math.min(x0, x - it.w / 2);
    y0 = Math.min(y0, y - it.h / 2);
    x1 = Math.max(x1, x + it.w / 2);
    y1 = Math.max(y1, y + it.h / 2);
  }
  return { x0, y0, x1, y1 };
}

export default function BoardCanvas({ photos, focusId, highlightId, onOpen, onMove, onExit, visible }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ tx: 0, ty: 0, s: 0.6 });
  const [interacting, setInteracting] = useState(false);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const viewRef = useRef(view);
  useLayoutEffect(() => {
    viewRef.current = view;
  }, [view]);

  const items: Item[] = useMemo(
    () =>
      photos.map((d) => {
        const g = computeGeometry(d.photo.layoutKey, slotCountFor(d.cuts.length, d.photo.status));
        return { data: d, w: g.width * WORLD_K, h: g.height * WORLD_K };
      }),
    [photos],
  );

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const centerOn = useCallback(
    (x: number, y: number, s: number) => setView({ s, tx: size.w / 2 - x * s, ty: size.h / 2 - y * s }),
    [size],
  );

  const fitAll = useCallback(() => {
    const b = boundsOf(items);
    const pad = 80;
    const s = Math.min(MAX_S, Math.max(MIN_S, Math.min(size.w / (b.x1 - b.x0 + pad * 2), size.h / (b.y1 - b.y0 + pad * 2))));
    centerOn((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.min(s, 1));
  }, [items, size, centerOn]);

  const goLatest = useCallback(() => {
    const latest = [...items].sort((a, b) => b.data.photo.createdAt.localeCompare(a.data.photo.createdAt))[0];
    if (latest) centerOn(latest.data.photo.pin.x, latest.data.photo.pin.y, Math.min(1, (size.h * 0.6) / latest.h));
  }, [items, size, centerOn]);

  // 처음 열릴 때 위치 잡기
  const placedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!size.w || !visible) return;
    const key = `${focusId ?? "all"}`;
    if (placedFor.current === key) return;
    placedFor.current = key;
    const f = focusId && items.find((i) => i.data.photo.id === focusId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 크기 측정 후 초기 위치 계산
    if (f) centerOn(f.data.photo.pin.x, f.data.photo.pin.y, Math.min(1, (size.h * 0.55) / f.h));
    else fitAll();
  }, [size, visible, focusId, items, centerOn, fitAll]);

  // ── 제스처
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    mode: "none" | "pan" | "pinch" | "photo";
    start: View;
    sx: number;
    sy: number;
    dist: number;
    mid: { x: number; y: number };
    photoId?: string;
    photoStart?: { x: number; y: number };
    moved: boolean;
    t: number;
  }>({ mode: "none", start: view, sx: 0, sy: 0, dist: 0, mid: { x: 0, y: 0 }, moved: false, t: 0 });

  const local = (e: { clientX: number; clientY: number }) => {
    const r = rootRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-ui]")) return;
    try {
      rootRef.current!.setPointerCapture(e.pointerId);
    } catch {}
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.mode = "pinch";
      g.start = viewRef.current;
      g.dist = Math.hypot(a.x - b.x, a.y - b.y);
      g.mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      setDragPos(null);
      return;
    }
    const photoEl = (e.target as HTMLElement).closest<HTMLElement>("[data-photo]");
    g.start = viewRef.current;
    g.sx = p.x;
    g.sy = p.y;
    g.moved = false;
    g.t = performance.now();
    if (photoEl) {
      const id = photoEl.dataset.photo!;
      const it = items.find((i) => i.data.photo.id === id)!;
      g.mode = "photo";
      g.photoId = id;
      g.photoStart = { x: it.data.photo.pin.x, y: it.data.photo.pin.y };
    } else {
      g.mode = "pan";
    }
    setInteracting(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    const g = gesture.current;
    if (g.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = clamp(g.start.s * (dist / g.dist), MIN_S, MAX_S);
      // 시작 시점 중점 아래의 월드 좌표를 현재 중점에 고정
      const wx = (g.mid.x - g.start.tx) / g.start.s;
      const wy = (g.mid.y - g.start.ty) / g.start.s;
      setView({ s, tx: mid.x - wx * s, ty: mid.y - wy * s });
      return;
    }
    const dx = p.x - g.sx;
    const dy = p.y - g.sy;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true;
    if (g.mode === "pan") setView({ ...g.start, tx: g.start.tx + dx, ty: g.start.ty + dy });
    if (g.mode === "photo" && g.photoId && g.photoStart) {
      setDragPos({ id: g.photoId, x: g.photoStart.x + dx / g.start.s, y: g.photoStart.y + dy / g.start.s });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g.mode === "pinch") {
      if (pointers.current.size === 1) {
        // 남은 손가락으로 계속 이동
        const [rest] = [...pointers.current.values()];
        g.mode = "pan";
        g.start = viewRef.current;
        g.sx = rest.x;
        g.sy = rest.y;
        g.moved = true;
        return;
      }
    }
    if (pointers.current.size === 0) {
      if (g.mode === "photo" && g.photoId) {
        if (!g.moved && performance.now() - g.t < 500) onOpen(g.photoId);
        else if (dragPos) onMove(dragPos.id, dragPos.x, dragPos.y);
      }
      g.mode = "none";
      setInteracting(false);
      // 드래그 위치는 저장 반영 후 해제
      setTimeout(() => setDragPos(null), 120);
    }
  }

  // 휠 줌 (데스크톱)
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout>;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const v = viewRef.current;
      const s = clamp(v.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), MIN_S, MAX_S);
      const wx = (px - v.tx) / v.s;
      const wy = (py - v.ty) / v.s;
      setView({ s, tx: px - wx * s, ty: py - wy * s });
      setInteracting(true);
      clearTimeout(timer);
      timer = setTimeout(() => setInteracting(false), 180);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ── 가상화: 보이는 영역 + 여유분
  const margin = 300 / view.s;
  const vx0 = -view.tx / view.s - margin;
  const vy0 = -view.ty / view.s - margin;
  const vx1 = (size.w - view.tx) / view.s + margin;
  const vy1 = (size.h - view.ty) / view.s + margin;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  // 칸 하나가 화면에서 300px 미만이면 썸네일
  const useThumbs = 300 * WORLD_K * view.s * dpr < 340;

  const visibleItems = items.filter((it) => {
    const pos = dragPos?.id === it.data.photo.id ? dragPos : it.data.photo.pin;
    const r = Math.max(it.w, it.h) / 2;
    return pos.x + r > vx0 && pos.x - r < vx1 && pos.y + r > vy0 && pos.y - r < vy1;
  });

  const corkSize = 220 * view.s;

  return (
    <div
      ref={rootRef}
      className={`${styles.root} cork`}
      data-visible={visible}
      style={{ ["--cork-size" as string]: `${corkSize}px`, backgroundPosition: `${view.tx}px ${view.ty}px` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={styles.world} style={{ transform: `translate3d(${view.tx}px, ${view.ty}px, 0) scale(${view.s})`, willChange: interacting ? "transform" : "auto" }}>
        {visibleItems.map((it) => {
          const pos = dragPos?.id === it.data.photo.id ? dragPos : it.data.photo.pin;
          return (
            <BoardPhoto
              key={it.data.photo.id}
              item={it}
              x={pos.x}
              y={pos.y}
              thumbs={useThumbs}
              tiny={view.s < 0.35}
              dragging={dragPos?.id === it.data.photo.id}
              highlight={highlightId === it.data.photo.id}
            />
          );
        })}
      </div>

      {!items.length && (
        <div className={styles.empty}>
          아직 붙은 사진이 없어요.
          <br />
          부스에 들어가 첫 컷을 찍어보세요.
        </div>
      )}

      <div className={styles.topbar} data-ui>
        <button className="btn btn-ghost" onClick={onExit} style={{ background: "rgba(26,23,20,.55)" }}>
          ← 게시판 밖으로
        </button>
      </div>
      <div className={styles.tools} data-ui>
        <button className={styles.tool} onClick={fitAll}>
          처음 위치로
        </button>
        <button className={styles.tool} onClick={goLatest} disabled={!items.length}>
          최근 사진으로
        </button>
      </div>
      <Minimap items={items} view={view} size={size} onJump={(x, y) => centerOn(x, y, view.s)} />
    </div>
  );
}

const BoardPhoto = memo(function BoardPhoto({
  item,
  x,
  y,
  thumbs,
  tiny,
  dragging,
  highlight,
}: {
  item: Item;
  x: number;
  y: number;
  thumbs: boolean;
  tiny: boolean;
  dragging: boolean;
  highlight: boolean;
}) {
  const { photo, cuts } = item.data;
  return (
    <div
      data-photo={photo.id}
      className={styles.photo}
      data-dragging={dragging}
      data-highlight={highlight}
      style={{
        width: item.w,
        height: item.h,
        transform: `translate(${x - item.w / 2}px, ${y - item.h / 2}px) rotate(${photo.pin.rotation}deg)`,
      }}
    >
      <GroupPhoto
        layoutKey={photo.layoutKey}
        status={photo.status}
        cuts={cuts}
        title={photo.title}
        printedAt={photo.printedAt}
        thumbs={thumbs}
        noGrain={thumbs}
        hideEmptyLabel={tiny}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <PinDecor type={photo.pin.pinType} size={40} />
    </div>
  );
});

function Minimap({ items, view, size, onJump }: { items: Item[]; view: View; size: { w: number; h: number }; onJump: (x: number, y: number) => void }) {
  const W = 120;
  const H = 90;
  const b = boundsOf(items);
  // 현재 보이는 영역도 지도 범위에 포함
  const vx0 = -view.tx / view.s;
  const vy0 = -view.ty / view.s;
  const vw = size.w / view.s;
  const vh = size.h / view.s;
  const x0 = Math.min(b.x0, vx0) - 100;
  const y0 = Math.min(b.y0, vy0) - 100;
  const x1 = Math.max(b.x1, vx0 + vw) + 100;
  const y1 = Math.max(b.y1, vy0 + vh) + 100;
  const k = Math.min(W / (x1 - x0), H / (y1 - y0));
  const ox = (W - (x1 - x0) * k) / 2;
  const oy = (H - (y1 - y0) * k) / 2;
  const toMap = (x: number, y: number) => ({ x: ox + (x - x0) * k, y: oy + (y - y0) * k });

  function jump(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * W;
    const my = ((e.clientY - r.top) / r.height) * H;
    onJump(x0 + (mx - ox) / k, y0 + (my - oy) / k);
  }

  const vp = toMap(vx0, vy0);
  return (
    <svg className={styles.minimap} viewBox={`0 0 ${W} ${H}`} data-ui onPointerDown={jump} role="img" aria-label="게시판 미니맵. 누르면 그 위치로 이동">
      <rect width={W} height={H} fill="rgba(26,23,20,.6)" rx="6" />
      {items.map((it) => {
        const p = toMap(it.data.photo.pin.x - it.w / 2, it.data.photo.pin.y - it.h / 2);
        return <rect key={it.data.photo.id} x={p.x} y={p.y} width={Math.max(2, it.w * k)} height={Math.max(2, it.h * k)} fill="#EDE4D0" opacity={0.85} />;
      })}
      <rect x={vp.x} y={vp.y} width={vw * k} height={vh * k} fill="none" stroke="#F2C46B" strokeWidth="1.5" />
    </svg>
  );
}

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
