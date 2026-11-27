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
      camera or saving may be blocked inside {IN_APP_LABEL[kind]}.{" "}
      {ext ? (
        <a href={ext} style={{ fontWeight: 700, textDecoration: "underline" }}>
          open in {isIOS() ? "safari" : "chrome"}
        </a>
      ) : (
        <b>tap ⋯ at the top right → &lsquo;open in browser&rsquo;</b>
      )}
      <button aria-label="dismiss" onClick={() => setClosed(true)} style={{ position: "absolute", right: 6, top: 4, width: 36, height: 36, fontSize: 18 }}>
        ×
      </button>
    </div>
  );
}
