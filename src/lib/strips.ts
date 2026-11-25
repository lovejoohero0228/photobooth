// 기기 안 보관함 — 완성된 스트립 이미지를 IndexedDB에 둔다. 사진은 기기 밖으로 나가지 않는다.
import { get, set, del } from "idb-keyval";

export interface StripMeta {
  id: string;
  createdAt: number;
  frame: string;
  w: number;
  h: number;
}

const META = "pb.strips.v2";
const MAX_KEEP = 200;

export async function listStrips(): Promise<StripMeta[]> {
  try {
    return ((await get(META)) as StripMeta[] | undefined) ?? [];
  } catch {
    return [];
  }
}

/** 저장 실패(사생활 보호 모드 등)는 촬영 흐름을 막지 않는다 */
export async function saveStrip(meta: StripMeta, full: Blob, thumb: Blob): Promise<boolean> {
  try {
    await set(`strip:${meta.id}`, full);
    await set(`thumb:${meta.id}`, thumb);
    const all = [meta, ...(await listStrips())];
    for (const old of all.slice(MAX_KEEP)) await removeBlobs(old.id);
    await set(META, all.slice(0, MAX_KEEP));
    return true;
  } catch {
    return false;
  }
}

export async function stripBlob(id: string, kind: "strip" | "thumb" = "strip"): Promise<Blob | null> {
  try {
    return ((await get(`${kind}:${id}`)) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

async function removeBlobs(id: string) {
  await del(`strip:${id}`);
  await del(`thumb:${id}`);
}

export async function deleteStrip(id: string): Promise<void> {
  try {
    await set(META, (await listStrips()).filter((s) => s.id !== id));
    await removeBlobs(id);
  } catch {}
}
