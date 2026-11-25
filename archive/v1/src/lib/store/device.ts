// 기기 안 저장소 — IndexedDB(idb-keyval). 메타데이터는 한 덩어리, 이미지는 키별 Blob.
// 탭 간 변경은 BroadcastChannel로 알린다.

import { get, set, del } from "idb-keyval";
import { MAX_PARTICIPANTS } from "../config";
import { DEFAULT_LAYOUT_KEY, computeGeometry, resolveLayoutKey, slotCountFor } from "../layouts";
import type { Cut, CutView, Photo, PhotoWithCuts, PinType } from "../types";

interface Meta {
  photos: Photo[];
  cuts: Cut[];
}

export interface NewCut {
  full: Blob;
  thumb: Blob;
  name: string;
  backComment: string | null;
}

const META_KEY = "pb.meta.v1";
export const BOARD_WORLD_K = 0.55;
const PIN_TYPES: PinType[] = ["pushpin", "tape", "clip", "magnet"];
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export class StoreError extends Error {}

class DeviceStore {
  private chan = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("pb-device") : null;
  private listeners = new Set<() => void>();
  private urls = new Map<string, string>();
  private lock: Promise<unknown> = Promise.resolve();

  constructor() {
    this.chan?.addEventListener("message", () => this.notify());
  }

  private async load(): Promise<Meta> {
    return (await get<Meta>(META_KEY)) ?? { photos: [], cuts: [] };
  }

  private tx<T>(fn: (m: Meta) => T | Promise<T>): Promise<T> {
    const run = this.lock.then(async () => {
      const m = await this.load();
      const out = await fn(m);
      await set(META_KEY, m);
      return out;
    });
    this.lock = run.catch(() => undefined);
    return run.then((v) => {
      this.chan?.postMessage("changed");
      this.notify();
      return v;
    });
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe(cb: () => void) {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }

  private async url(key: string): Promise<string> {
    const hit = this.urls.get(key);
    if (hit) return hit;
    const blob = await get<Blob>(key);
    if (!blob) return "";
    const u = URL.createObjectURL(blob);
    this.urls.set(key, u);
    return u;
  }

  private async views(m: Meta, photoId: string): Promise<CutView[]> {
    const cuts = m.cuts.filter((c) => c.photoId === photoId).sort((a, b) => a.slotIndex - b.slotIndex);
    return Promise.all(
      cuts.map(async (c) => ({
        id: c.id,
        name: c.name,
        imageUrl: await this.url(c.imageKey),
        thumbUrl: await this.url(c.thumbKey),
        slotIndex: c.slotIndex,
        backComment: c.backComment,
      })),
    );
  }

  private reflow(m: Meta, photoId: string) {
    const cuts = m.cuts.filter((c) => c.photoId === photoId).sort((a, b) => a.slotIndex - b.slotIndex);
    cuts.forEach((c, i) => (c.slotIndex = i));
    const p = m.photos.find((x) => x.id === photoId);
    if (p) p.layoutKey = resolveLayoutKey(p.layoutKey, Math.max(1, cuts.length));
  }

  /** 게시판 위 크기(월드 좌표). BoardCanvas의 WORLD_K와 같게 */
  private sizeOf(layoutKey: string, cuts: number, status: Photo["status"]) {
    const g = computeGeometry(layoutKey, slotCountFor(cuts, status));
    return { w: g.width * BOARD_WORLD_K, h: g.height * BOARD_WORLD_K };
  }

  /**
   * 새 사진은 기존 사진들이 모인 곳 근처에 자동 배치.
   * 무게중심에서 황금각 나선으로 바깥쪽을 훑으며, 기존 사진과 크게 겹치지 않는 첫 자리를 고른다(일부 겹침 허용).
   */
  private placePin(m: Meta, size: { w: number; h: number }) {
    const rects = m.photos.map((p) => {
      const n = m.cuts.filter((c) => c.photoId === p.id).length;
      const sz = this.sizeOf(p.layoutKey, n, p.status);
      return { x: p.pin.x - sz.w / 2, y: p.pin.y - sz.h / 2, w: sz.w, h: sz.h };
    });
    const n = rects.length;
    const cx = n ? m.photos.reduce((s, p) => s + p.pin.x, 0) / n : 0;
    const cy = n ? m.photos.reduce((s, p) => s + p.pin.y, 0) / n : 0;
    let best = { x: cx, y: cy };
    for (let i = 0; i < 600 && n; i++) {
      const ang = i * 2.39996;
      const r = 30 * Math.sqrt(i) * 2.2;
      const x = cx + Math.cos(ang) * r;
      const y = cy + Math.sin(ang) * r;
      const me = { x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h };
      const ok = rects.every((o) => {
        const ix = Math.max(0, Math.min(me.x + me.w, o.x + o.w) - Math.max(me.x, o.x));
        const iy = Math.max(0, Math.min(me.y + me.h, o.y + o.h) - Math.max(me.y, o.y));
        return ix * iy < 0.12 * Math.min(me.w * me.h, o.w * o.h);
      });
      if (ok) {
        best = { x, y };
        break;
      }
    }
    return {
      ...best,
      rotation: Math.random() * 10 - 5,
      pinType: PIN_TYPES[Math.floor(Math.random() * PIN_TYPES.length)],
    };
  }

  private async putBlobs(c: NewCut) {
    const id = uuid();
    const imageKey = `img:${id}`;
    const thumbKey = `thumb:${id}`;
    await set(imageKey, c.full);
    await set(thumbKey, c.thumb);
    return { imageKey, thumbKey };
  }

  private async dropBlobs(keys: string[]) {
    for (const k of keys) {
      await del(k);
      const u = this.urls.get(k);
      if (u) URL.revokeObjectURL(u);
      this.urls.delete(k);
    }
  }

  // ── 조회
  async listPhotos(): Promise<PhotoWithCuts[]> {
    const m = await this.load();
    return Promise.all(m.photos.map(async (photo) => ({ photo, cuts: await this.views(m, photo.id) })));
  }

  async getPhoto(id: string): Promise<PhotoWithCuts | null> {
    const m = await this.load();
    const photo = m.photos.find((p) => p.id === id);
    return photo ? { photo, cuts: await this.views(m, id) } : null;
  }

  // ── 쓰기
  /** 부스에서 나올 때: 새 단체컷과 컷들을 한 번에 저장 */
  async createPhoto(input: { title: string; layoutKey: string; print: boolean }, cuts: NewCut[]): Promise<Photo> {
    if (!cuts.length) throw new StoreError("컷이 없어요");
    const stored = await Promise.all(cuts.map((c) => this.putBlobs(c)));
    return this.tx((m) => {
      const t = now();
      const status = input.print ? "printed" : "developing";
      const layoutKey = resolveLayoutKey(input.layoutKey || DEFAULT_LAYOUT_KEY, cuts.length);
      const photo: Photo = {
        id: uuid(),
        title: input.title.trim().slice(0, 40) || "이름 없는 단체컷",
        status,
        layoutKey,
        createdAt: t,
        printedAt: input.print ? t : null,
        pin: this.placePin(m, this.sizeOf(layoutKey, cuts.length, status)),
      };
      m.photos.push(photo);
      cuts.slice(0, MAX_PARTICIPANTS).forEach((c, i) =>
        m.cuts.push({ id: uuid(), photoId: photo.id, name: c.name.trim().slice(0, 12), backComment: c.backComment, slotIndex: i, createdAt: t, ...stored[i] }),
      );
      return photo;
    });
  }

  /** 현상 중인 단체컷에 사람 더 넣기 */
  async addCuts(photoId: string, cuts: NewCut[], print: boolean) {
    const stored = await Promise.all(cuts.map((c) => this.putBlobs(c)));
    await this.tx((m) => {
      const p = m.photos.find((x) => x.id === photoId);
      if (!p) throw new StoreError("사진을 찾을 수 없어요");
      if (p.status === "printed") throw new StoreError("이미 인화가 끝난 사진이에요");
      const existing = m.cuts.filter((c) => c.photoId === photoId).length;
      if (existing + cuts.length > MAX_PARTICIPANTS) throw new StoreError(`최대 ${MAX_PARTICIPANTS}명까지예요`);
      const t = now();
      cuts.forEach((c, i) =>
        m.cuts.push({ id: uuid(), photoId, name: c.name.trim().slice(0, 12), backComment: c.backComment, slotIndex: existing + i, createdAt: t, ...stored[i] }),
      );
      this.reflow(m, photoId);
      if (print) {
        p.status = "printed";
        p.printedAt = t;
      }
    });
  }

  async updatePhoto(id: string, patch: { title?: string; layoutKey?: string }) {
    await this.tx((m) => {
      const p = m.photos.find((x) => x.id === id);
      if (!p) return;
      if (patch.title !== undefined) p.title = patch.title.trim().slice(0, 40) || p.title;
      if (patch.layoutKey) {
        const n = m.cuts.filter((c) => c.photoId === id).length;
        if (resolveLayoutKey(patch.layoutKey, Math.max(1, n)) !== patch.layoutKey) throw new StoreError("지금 인원에 맞지 않는 레이아웃이에요");
        p.layoutKey = patch.layoutKey;
      }
    });
  }

  async updateCut(cutId: string, patch: { name?: string; backComment?: string | null }) {
    await this.tx((m) => {
      const c = m.cuts.find((x) => x.id === cutId);
      if (!c) return;
      if (patch.name !== undefined) c.name = patch.name.trim().slice(0, 12);
      if (patch.backComment !== undefined) c.backComment = patch.backComment?.trim().slice(0, 140) || null;
    });
  }

  async printPhoto(id: string) {
    await this.tx((m) => {
      const p = m.photos.find((x) => x.id === id);
      if (p && p.status === "developing") {
        p.status = "printed";
        p.printedAt = now();
      }
    });
  }

  /** 컷 빼기. 마지막 컷이면 사진도 삭제 */
  async removeCut(cutId: string) {
    const keys = await this.tx((m) => {
      const c = m.cuts.find((x) => x.id === cutId);
      if (!c) return [];
      m.cuts = m.cuts.filter((x) => x.id !== cutId);
      if (!m.cuts.some((x) => x.photoId === c.photoId)) m.photos = m.photos.filter((p) => p.id !== c.photoId);
      else this.reflow(m, c.photoId);
      return [c.imageKey, c.thumbKey];
    });
    await this.dropBlobs(keys);
  }

  async deletePhoto(id: string) {
    const keys = await this.tx((m) => {
      const gone = m.cuts.filter((c) => c.photoId === id);
      m.cuts = m.cuts.filter((c) => c.photoId !== id);
      m.photos = m.photos.filter((p) => p.id !== id);
      return gone.flatMap((c) => [c.imageKey, c.thumbKey]);
    });
    await this.dropBlobs(keys);
  }

  /** 개발용: 이 기기의 모든 사진 삭제 */
  async deleteAll() {
    const keys = await this.tx((m) => {
      const k = m.cuts.flatMap((c) => [c.imageKey, c.thumbKey]);
      m.photos = [];
      m.cuts = [];
      return k;
    });
    await this.dropBlobs(keys);
  }

  async movePin(id: string, x: number, y: number) {
    await this.tx((m) => {
      const p = m.photos.find((q) => q.id === id);
      if (p) p.pin = { ...p.pin, x, y };
    });
  }
}

let instance: DeviceStore | null = null;
export function getStore(): DeviceStore {
  if (!instance) instance = new DeviceStore();
  return instance;
}
export type { DeviceStore };
