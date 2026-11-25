// 단체컷 PNG 합성 — GroupPhoto(SVG)를 그대로 직렬화해 canvas에 그린다. 화면과 저장본이 같은 렌더러를 쓴다.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import GroupPhoto, { type GroupPhotoProps } from "@/components/GroupPhoto";

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith("data:")) return url;
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** 결과 긴 변 최대 px. 칸 너비 기준 2배를 넘지 않는다 (용량 관리) */
export async function composeGroupPhoto(props: GroupPhotoProps, maxEdge = 2400): Promise<Blob> {
  // SVG를 이미지로 로드하면 외부 리소스를 못 읽으므로 컷 이미지를 data URL로 바꿔 넣는다
  const cuts = await Promise.all(
    props.cuts.map(async (c) => ({ ...c, imageUrl: await toDataUrl(c.imageUrl), thumbUrl: "" })),
  );
  const markup = renderToStaticMarkup(
    createElement(GroupPhoto, { ...props, cuts, thumbs: false, forExport: true, idOverride: "exp", highlightSlot: null }),
  );
  const svgW = Number(/width="([\d.]+)"/.exec(markup)?.[1] ?? 1000);
  const svgH = Number(/height="([\d.]+)"/.exec(markup)?.[1] ?? 1000);
  // SVG-as-image에선 웹폰트·CSS 변수가 없으니 시스템 폰트로 대체
  const fixed = markup.replace(/var\(--font-[a-z]+\),\s*/g, "");
  const svgUrl = URL.createObjectURL(new Blob([fixed], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = svgUrl;
    await img.decode();
    const scale = Math.min(2, maxEdge / Math.max(svgW, svgH));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(svgW * scale);
    canvas.height = Math.round(svgH * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG 생성 실패"))), "image/png"));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
