"use client";

// 사진 상세 — 크게 보기, 뒤집기(뒷면 한마디), 저장·공유, 사람 더 넣기, 인화(마감), 관리
import { useState } from "react";
import { useRouter } from "next/navigation";
import GroupPhoto from "@/components/GroupPhoto";
import { getStore, useStoreQuery } from "@/lib/store";
import { getLayout, layoutsForTier, tierOf } from "@/lib/layouts";
import { composeGroupPhoto, downloadBlob } from "@/lib/imaging/compose";
import { detectInApp } from "@/lib/env";
import { MAX_PARTICIPANTS } from "@/lib/config";
import styles from "./PhotoDetail.module.css";

function fileName(title: string) {
  return `${title.replace(/[\\/:*?"<>|]/g, "").trim() || "photobooth"}.png`;
}

export default function PhotoDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const router = useRouter();
  const { data, loading } = useStoreQuery((s) => s.getPhoto(id), [id]);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [manage, setManage] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [fallbackImg, setFallbackImg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  if (loading) return <div className={styles.backdrop} />;
  if (!data) {
    return (
      <div className={styles.backdrop} onClick={onClose}>
        <p className={styles.missing}>사진을 찾을 수 없어요</p>
      </div>
    );
  }
  const { photo, cuts } = data;
  const developing = photo.status === "developing";
  const store = getStore();

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function render() {
    return composeGroupPhoto({ layoutKey: photo.layoutKey, status: photo.status, cuts, title: photo.title, printedAt: photo.printedAt });
  }

  async function save() {
    setBusy("save");
    try {
      const blob = await render();
      // 앱 내 브라우저는 다운로드가 막히는 경우가 많아 "길게 눌러 저장"으로
      if (detectInApp()) setFallbackImg(URL.createObjectURL(blob));
      else downloadBlob(blob, fileName(photo.title));
    } catch {
      flash("저장하지 못했어요");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    setBusy("share");
    try {
      const blob = await render();
      const file = new File([blob], fileName(photo.title), { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: photo.title });
      } else {
        setFallbackImg(URL.createObjectURL(blob));
      }
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") flash("공유하지 못했어요");
    } finally {
      setBusy(null);
    }
  }

  const tierOptions = layoutsForTier(tierOf(cuts.length));
  const comments = cuts.filter((c) => c.backComment);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`단체컷 ${photo.title}`}>
        <header className={styles.head}>
          <div>
            <h2 className={styles.title}>{photo.title}</h2>
            <p className={styles.meta}>
              <span className={developing ? styles.badgeDev : styles.badgePrinted}>{developing ? "현상 중" : "인화 완료"}</span>
              {cuts.length}명 · {getLayout(photo.layoutKey).name}
            </p>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </header>

        <div className={styles.flipWrap} onClick={() => setFlipped(!flipped)}>
          <div className={styles.card} data-flipped={flipped}>
            <div className={styles.front}>
              <GroupPhoto
                layoutKey={photo.layoutKey}
                status={photo.status}
                cuts={cuts}
                title={photo.title}
                printedAt={photo.printedAt}
                hideEmptyLabel={!developing}
                style={{ maxWidth: "100%", maxHeight: "100%", display: "block", margin: "auto" }}
              />
            </div>
            <div className={styles.back}>
              <p className={styles.backTitle}>{photo.title}</p>
              <p className={styles.backDate}>{new Date(photo.createdAt).toLocaleDateString("ko-KR")}</p>
              {comments.length ? (
                <ul className={styles.notes}>
                  {comments.map((c) => (
                    <li key={c.id}>
                      <span>{c.backComment}</span>
                      <b>— {c.name || `${c.slotIndex + 1}번`}</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.noNotes}>뒷면이 비어 있어요</p>
              )}
            </div>
          </div>
        </div>
        <p className={styles.hint}>사진을 누르면 뒤집혀요</p>

        <div className={styles.actions}>
          <button className="btn" onClick={save} disabled={!!busy}>
            {busy === "save" ? "인화 중…" : "저장"}
          </button>
          <button className="btn" onClick={share} disabled={!!busy}>
            {busy === "share" ? "준비 중…" : "공유"}
          </button>
          {developing && cuts.length < MAX_PARTICIPANTS && (
            <button className="btn btn-primary" onClick={() => router.push(`/booth?photo=${photo.id}`)}>
              사람 더 넣기
            </button>
          )}
        </div>

        <div className={styles.secondary}>
          {developing &&
            (confirm === "print" ? (
              <span>
                인화하면 더 넣을 수 없어요.{" "}
                <button className={styles.link} onClick={() => store.printPhoto(photo.id).then(() => setConfirm(null))}>
                  인화하기
                </button>{" "}
                <button className={styles.link} onClick={() => setConfirm(null)}>
                  취소
                </button>
              </span>
            ) : (
              <button className={styles.link} onClick={() => setConfirm("print")}>
                다 모였어요 · 인화하기
              </button>
            ))}
          <button className={styles.link} onClick={() => setManage(!manage)}>
            {manage ? "관리 닫기" : "관리"}
          </button>
        </div>

        {manage && (
          <section className={styles.manage}>
            <label className={styles.row}>
              <span>사진 이름</span>
              <input
                className="field"
                defaultValue={photo.title}
                maxLength={40}
                onBlur={(e) => e.target.value !== photo.title && store.updatePhoto(photo.id, { title: e.target.value })}
              />
            </label>
            <div className={styles.row}>
              <span>레이아웃</span>
              <div className={styles.chips}>
                {tierOptions.map((l) => (
                  <button key={l.key} className={styles.chip} data-on={l.key === photo.layoutKey} onClick={() => store.updatePhoto(photo.id, { layoutKey: l.key })}>
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.row}>
              <span>컷 ({cuts.length})</span>
              <ul className={styles.cutList}>
                {cuts.map((c) => (
                  <li key={c.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.thumbUrl} alt="" />
                    <input className="field" defaultValue={c.name} placeholder={`${c.slotIndex + 1}번 이름`} maxLength={12} onBlur={(e) => e.target.value !== c.name && store.updateCut(c.id, { name: e.target.value })} />
                    {confirm === `cut:${c.id}` ? (
                      <button className={styles.danger} onClick={() => store.removeCut(c.id).then(() => (cuts.length === 1 ? onClose() : setConfirm(null)))}>
                        정말 빼기
                      </button>
                    ) : (
                      <button className={styles.link} onClick={() => setConfirm(`cut:${c.id}`)}>
                        빼기
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.row}>
              {confirm === "delete" ? (
                <button className={styles.danger} onClick={() => store.deletePhoto(photo.id).then(onClose)}>
                  이 기기에서 영구 삭제 (되돌릴 수 없어요)
                </button>
              ) : (
                <button className={styles.link} onClick={() => setConfirm("delete")}>
                  사진 삭제
                </button>
              )}
            </div>
          </section>
        )}

        {toast && <div className={styles.toast}>{toast}</div>}
      </div>

      {fallbackImg && (
        <div className={styles.fallback} onClick={(e) => (e.stopPropagation(), setFallbackImg(null))}>
          <p>사진을 길게 눌러 저장하거나 공유하세요</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fallbackImg} alt={photo.title} onClick={(e) => e.stopPropagation()} />
          <button className="btn btn-ghost">닫기</button>
        </div>
      )}
    </div>
  );
}
