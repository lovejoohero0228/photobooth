"use client";

import { useSyncExternalStore, useState } from "react";
import { detectInApp, externalOpenUrl, IN_APP_LABEL, isIOS, type InAppKind } from "@/lib/env";

const noop = () => () => {};

export function useInApp(): InAppKind {
  return useSyncExternalStore(noop, () => detectInApp(), () => null);
}

/** 앱 내 브라우저일 때 상단 안내 띠 */
export default function InAppNotice() {
  const kind = useInApp();
  const [closed, setClosed] = useState(false);
  if (!kind || closed) return null;
  const ext = externalOpenUrl(kind);
  return (
    <div
      role="note"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        padding: "10px 44px 10px 14px",
        background: "var(--paper)",
        color: "var(--ink)",
        fontSize: 13.5,
        lineHeight: 1.5,
        boxShadow: "0 2px 10px rgba(0,0,0,.3)",
      }}
    >
      {IN_APP_LABEL[kind]} 안에서는 카메라나 저장이 막힐 수 있어요.{" "}
      {ext ? (
        <a href={ext} style={{ fontWeight: 700, textDecoration: "underline" }}>
          {isIOS() ? "Safari" : "Chrome"}로 열기
        </a>
      ) : (
        <b>오른쪽 위 ⋯ 메뉴 → &lsquo;외부 브라우저로 열기&rsquo;</b>
      )}
      <button aria-label="안내 닫기" onClick={() => setClosed(true)} style={{ position: "absolute", right: 6, top: 4, width: 36, height: 36, fontSize: 18 }}>
        ×
      </button>
    </div>
  );
}
