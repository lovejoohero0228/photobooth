"use client";

// 개발용: 모든 레이아웃 × 인원 × 상태를 한눈에 확인
import { useEffect, useState } from "react";
import GroupPhoto from "@/components/GroupPhoto";
import { LAYOUTS, TIERS, layoutsForTier, resolveLayoutKey, type Tier } from "@/lib/layouts";
import { sampleCutBlobs } from "@/lib/imaging/sample";
import { composeGroupPhoto, downloadBlob } from "@/lib/imaging/compose";
import type { CutView, PhotoStatus } from "@/lib/types";

const printedAt = "2026-12-24T12:00:00+09:00";
const NAMES = ["주희", "민수", "서연", "지호", "하늘", "도윤", "예린", "태오", "수아", "건우", "나연", "시우", "유나", "현우", "다인", "준서", "채원", "윤호", "소율", "재민"];

export default function LayoutLab() {
  const [pool, setPool] = useState<CutView[]>([]);
  const [count, setCount] = useState(4);
  const [status, setStatus] = useState<PhotoStatus>("developing");
  const [family, setFamily] = useState("strip-v");

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: CutView[] = [];
      for (let i = 0; i < 20; i++) {
        const { full, thumb } = await sampleCutBlobs(i + 1);
        out.push({ id: `c${i}`, name: NAMES[i], imageUrl: URL.createObjectURL(full), thumbUrl: URL.createObjectURL(thumb), slotIndex: i });
        if (!alive) return;
        if (i % 5 === 4) setPool([...out]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const cuts = pool.slice(0, count);
  const auto = resolveLayoutKey(family, Math.max(1, count));

  return (
    <main style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>레이아웃 실험실</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <label>
          인원 {count}명{" "}
          <input type="range" min={1} max={20} value={count} onChange={(e) => setCount(+e.target.value)} />
        </label>
        <select className="field" style={{ width: "auto", minHeight: 40 }} value={status} onChange={(e) => setStatus(e.target.value as PhotoStatus)}>
          <option value="developing">현상 중</option>
          <option value="printed">인화 완료</option>
        </select>
        <label>
          자동 전환 시작 레이아웃{" "}
          <select className="field" style={{ width: "auto", minHeight: 40 }} value={family} onChange={(e) => setFamily(e.target.value)}>
            {layoutsForTier(1).map((l) => (
              <option key={l.key} value={l.key}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <span style={{ opacity: 0.7 }}>
          → {count}명이면 <b>{LAYOUTS.find((l) => l.key === auto)?.name}</b>
        </span>
        <span style={{ opacity: 0.5 }}>샘플 컷 {pool.length}/20 생성됨</span>
      </div>

      {([1, 2, 3, 4] as Tier[]).map((t) => (
        <section key={t} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 15, opacity: 0.8, marginBottom: 8 }}>
            {TIERS[t].label} {t === (count <= 2 ? 1 : count <= 4 ? 2 : count <= 9 ? 3 : 4) ? "← 현재 구간" : ""}
          </h2>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {layoutsForTier(t).map((l) => (
              <figure key={l.key} style={{ width: 340 }}>
                <GroupPhoto
                  layoutKey={l.key}
                  status={status}
                  cuts={cuts}
                  title="2026 동기 송년회"
                  printedAt={printedAt}
                  thumbs
                  style={{ width: "100%", height: "auto", maxHeight: 520, display: "block", filter: "drop-shadow(0 6px 12px rgba(0,0,0,.4))" }}
                  onEmptySlot={(i) => console.log("empty slot", i)}
                />
                <figcaption style={{ fontSize: 13, marginTop: 6, display: "flex", justifyContent: "space-between" }}>
                  {l.name} <code style={{ opacity: 0.5 }}>{l.key}</code>
                  <button
                    style={{ textDecoration: "underline" }}
                    onClick={async () => downloadBlob(await composeGroupPhoto({ layoutKey: l.key, status, cuts, title: "2026 동기 송년회", printedAt }), `${l.key}.png`)}
                  >
                    PNG
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
