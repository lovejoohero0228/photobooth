"use client";

// 보관함 — 이 기기에서 찍은 사진들. 포스터를 누르면 열린다.
import { useEffect, useState } from "react";
import css from "./Album.module.css";
import { deleteStrip, listStrips, stripBlob, type StripMeta } from "@/lib/strips";
import { saveImage, shareBlob, stripFilename } from "@/lib/develop";
import { detectInApp } from "@/lib/env";

interface Item extends StripMeta {
  thumb: string;
}

interface Open {
  item: Item;
  blob: Blob;
  url: string;
}

export default function Album({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<Open | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    (async () => {
      const metas = await listStrips();
      const out: Item[] = [];
      for (const m of metas) {
        const b = await stripBlob(m.id, "thumb");
        if (!b) continue;
        const url = URL.createObjectURL(b);
        urls.push(url);
        out.push({ ...m, thumb: url });
      }
      if (alive) setItems(out);
    })();
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  async function view(item: Item) {
    const blob = await stripBlob(item.id);
    if (!blob) return;
    setConfirm(false);
    setHint(null);
    setOpen({ item, blob, url: URL.createObjectURL(blob) });
  }
  function closeView() {
    if (open) URL.revokeObjectURL(open.url);
    setOpen(null);
  }
  async function remove() {
    if (!open) return;
    if (!confirm) return setConfirm(true);
    await deleteStrip(open.item.id);
    setItems((list) => list?.filter((i) => i.id !== open.item.id) ?? null);
    closeView();
    onChanged();
  }
  async function save() {
    if (!open) return;
    const r = await saveImage(open.blob, stripFilename(new Date(open.item.createdAt)), detectInApp() !== null);
    setHint(r === "longpress" ? "사진을 길게 눌러 ‘이미지 저장’을 고르세요" : null);
  }
  async function share() {
    if (!open) return;
    const ok = await shareBlob(open.blob, stripFilename(new Date(open.item.createdAt)));
    setHint(ok ? null : "이 브라우저에선 공유가 안 돼요. 길게 눌러 저장한 뒤 올려 주세요");
  }

  return (
    <div className={css.root} role="dialog" aria-label="내 사진">
      <header className={css.head}>
        <h2 className="f-title">내 사진{items?.length ? ` ${items.length}장` : ""}</h2>
        <button onClick={onClose} aria-label="닫기">
          닫기 ✕
        </button>
      </header>

      <div className={css.grid}>
        {items?.map((it, i) => (
          <button key={it.id} className={css.cell} style={{ rotate: `${((i * 37) % 7) - 3}deg`, animationDelay: `${Math.min(i, 12) * 35}ms` }} onClick={() => view(it)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.thumb} alt={`${new Date(it.createdAt).toLocaleDateString("ko-KR")}에 찍은 사진`} style={{ aspectRatio: `${it.w} / ${it.h}` }} />
          </button>
        ))}
        {items?.length === 0 && <p className={css.empty}>아직 찍은 사진이 없어요</p>}
      </div>
      <p className={css.foot}>이 기기 안에만 있어요. 브라우저 데이터를 지우면 함께 사라져요.</p>

      {open && (
        <div className={css.view}>
          <button className={css.viewClose} onClick={closeView}>
            ← 목록
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.url} alt="" style={{ aspectRatio: `${open.item.w} / ${open.item.h}` }} />
          <div className={css.bar}>
            {hint && <p className={css.hint}>{hint}</p>}
            <div className={css.btns}>
              <button className="f-title" data-main="true" onClick={save}>
                Save
              </button>
              <button className="f-title" onClick={share}>
                Share
              </button>
              <button className="f-title" data-warn={confirm} onClick={remove}>
                {confirm ? "정말 지워요" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
