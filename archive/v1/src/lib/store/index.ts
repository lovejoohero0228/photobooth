"use client";

import { useCallback, useEffect, useState } from "react";
import { getStore, type DeviceStore } from "./device";

export { getStore, StoreError, type NewCut } from "./device";

/** 저장소를 읽고, 변경 알림이 오면 다시 읽는 훅 */
export function useStoreQuery<T>(fn: (s: DeviceStore) => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => getStore().subscribe(reload), [reload]);

  useEffect(() => {
    let alive = true;
    fn(getStore())
      .then((d) => {
        if (alive) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => alive && setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, loading: data === undefined && !error, reload };
}
