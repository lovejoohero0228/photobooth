"use client";

// 한 화면 안에서 밖 → 부스 안 → 배출구가 이어진다. 페이지 이동이 없어 장면 사이가 끊기지 않는다.
import { useCallback, useEffect, useRef, useState } from "react";
import Exterior from "./Exterior";
import Interior, { type ShootResult } from "./Interior";
import Delivery from "./Delivery";
import Album from "./Album";
import InAppNotice from "@/components/InAppNotice";
import { listStrips, saveStrip, stripBlob } from "@/lib/strips";
import { isMuted, playCurtain, setMuted, unlockAudio } from "@/lib/sound";

type View = "outside" | "inside" | "delivery";

interface Result extends ShootResult {
  url: string;
}

const CURTAIN_MS = 560;
const CROSS_MS = 800;

export default function Booth() {
  const [view, setView] = useState<View>("outside");
  /** 사라지는 중이라 아직 화면에 남아 있는 장면 */
  const [leaving, setLeaving] = useState<View | null>(null);
  const [curtain, setCurtain] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [latest, setLatest] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [album, setAlbum] = useState(false);
  const [muted, setMute] = useState(false);
  const latestUrl = useRef<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    const metas = await listStrips();
    const b = metas[0] ? await stripBlob(metas[0].id, "thumb") : null;
    const old = latestUrl.current;
    latestUrl.current = b ? URL.createObjectURL(b) : undefined;
    setLatest(latestUrl.current);
    setTotal(metas.length);
    if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setMute(isMuted());
      void refresh();
    });
  }, [refresh]);

  function go(next: View) {
    setLeaving(view);
    setView(next);
    setTimeout(() => setLeaving(null), CROSS_MS);
  }

  function enter() {
    unlockAudio();
    playCurtain();
    setCurtain(true);
    setTimeout(() => go("inside"), CURTAIN_MS);
    setTimeout(() => setCurtain(false), CURTAIN_MS + CROSS_MS);
  }

  function done(r: ShootResult) {
    const id = crypto.randomUUID?.() ?? String(Date.now());
    setResult({ ...r, url: URL.createObjectURL(r.full) });
    go("delivery");
    void saveStrip({ id, createdAt: Date.now(), frame: r.frame, w: r.w, h: r.h }, r.full, r.thumb).then(refresh);
  }

  function again() {
    go("outside");
    const old = result?.url;
    setTimeout(() => {
      setResult(null);
      if (old) URL.revokeObjectURL(old);
    }, CROSS_MS);
  }

  const show = (v: View) => view === v || leaving === v;

  return (
    <main>
      {show("outside") && <Exterior open={curtain || leaving === "outside"} out={leaving === "outside"} latest={latest} total={total} onEnter={enter} onAlbum={() => setAlbum(true)} />}
      {show("inside") && <Interior leaving={leaving === "inside"} onExit={() => go("outside")} onDone={done} />}
      {show("delivery") && result && <Delivery url={result.url} blob={result.full} w={result.w} h={result.h} leaving={leaving === "delivery"} onAgain={again} />}

      {view === "outside" && !leaving && (
        <button
          onClick={() => {
            const m = !muted;
            setMuted(m);
            setMute(m);
            if (!m) unlockAudio();
          }}
          aria-label={muted ? "소리 켜기" : "소리 끄기"}
          style={{ position: "fixed", top: "calc(8px + var(--safe-t))", right: 6, width: 44, height: 44, fontSize: 18, opacity: muted ? 0.3 : 0.55, textDecoration: muted ? "line-through" : "none", zIndex: 10 }}
        >
          ♪
        </button>
      )}

      {album && <Album onClose={() => setAlbum(false)} onChanged={refresh} />}
      <InAppNotice />
    </main>
  );
}
