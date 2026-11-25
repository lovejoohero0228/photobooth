"use client";

// 개발용: 샘플 단체컷 생성 (게시판 성능 확인: 100장)
import { useState } from "react";
import Link from "next/link";
import { getStore } from "@/lib/store";
import { sampleCutBlobs } from "@/lib/imaging/sample";
import { LAYOUTS } from "@/lib/layouts";

const NAMES = ["주희", "민수", "서연", "지호", "하늘", "도윤", "예린", "태오", "수아", "건우", "나연", "시우"];
const NOTES = ["올해도 고마웠어!", "내년엔 더 자주 보자", null, "볼하트 실패함", null, "메리 크리스마스 🎄"];

export default function Seed() {
  const [log, setLog] = useState("");

  async function seed(n: number) {
    // 샘플 컷은 24장만 만들어 돌려 쓴다
    setLog("샘플 컷 만드는 중…");
    const pool: { full: Blob; thumb: Blob }[] = [];
    for (let i = 0; i < 24; i++) pool.push(await sampleCutBlobs(i + 1));
    for (let p = 0; p < n; p++) {
      const people = 1 + ((p * 7) % 12);
      const cuts = Array.from({ length: people }, (_, i) => ({ ...pool[(p + i) % pool.length], name: NAMES[(p + i) % NAMES.length], backComment: NOTES[(p + i) % NOTES.length] }));
      await getStore().createPhoto({ title: `샘플 단체컷 ${p + 1}`, layoutKey: LAYOUTS[p % LAYOUTS.length].key, print: p % 3 === 0 }, cuts);
      setLog(`${p + 1}/${n}장 만듦`);
    }
    setLog(`완료: ${n}장`);
  }

  return (
    <main style={{ padding: 24, display: "grid", gap: 12, maxWidth: 360 }}>
      <h1 style={{ fontSize: 18 }}>샘플 데이터</h1>
      <button className="btn" onClick={() => seed(6)}>샘플 6장 추가</button>
      <button className="btn" onClick={() => seed(100)}>샘플 100장 추가</button>
      <button className="btn btn-ghost" onClick={async () => { await getStore().deleteAll(); setLog("모두 지움"); }}>이 기기의 사진 모두 지우기</button>
      <p>{log}</p>
      <Link href="/" style={{ textDecoration: "underline" }}>스페이스로</Link>
    </main>
  );
}
