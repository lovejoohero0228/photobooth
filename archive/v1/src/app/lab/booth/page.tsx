"use client";

import { useState } from "react";
import BoothMachine, { type BoothState } from "@/components/booth/BoothMachine";

const STATES: BoothState[] = ["idle", "coin", "open", "flash", "dispensing"];

export default function BoothLab() {
  const [state, setState] = useState<BoothState>("idle");
  const [decor, setDecor] = useState(true);
  return (
    <main style={{ padding: 16, display: "grid", gap: 12, justifyItems: "center" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {STATES.map((s) => (
          <button key={s} className={`btn ${s === state ? "btn-primary" : "btn-ghost"}`} onClick={() => setState(s)}>
            {s}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => setDecor(!decor)}>
          장식 {decor ? "on" : "off"}
        </button>
      </div>
      <div style={{ width: "min(420px, 100%)" }}>
        <BoothMachine state={state} decor={decor} />
      </div>
    </main>
  );
}
