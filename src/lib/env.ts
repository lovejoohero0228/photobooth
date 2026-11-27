// 앱 내 브라우저(인스타그램 등) 감지 — 카메라·다운로드가 막히는 경우가 많다

export type InAppKind = "instagram" | "facebook" | "kakaotalk" | "naver" | "line" | "threads" | null;

export function detectInApp(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): InAppKind {
  if (/Instagram/i.test(ua)) return "instagram";
  if (/Barcelona/i.test(ua)) return "threads";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  if (/KAKAOTALK/i.test(ua)) return "kakaotalk";
  if (/NAVER\(inapp/i.test(ua)) return "naver";
  if (/\bLine\//i.test(ua)) return "line";
  return null;
}

export const isIOS = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const isAndroid = () => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** 외부 브라우저로 여는 링크. 안드로이드는 크롬 intent, 카카오톡은 전용 스킴. iOS 인스타는 방법이 없어 안내만 */
export function externalOpenUrl(kind: InAppKind, href = typeof location !== "undefined" ? location.href : ""): string | null {
  if (kind === "kakaotalk") return `kakaotalk://web/openExternal?url=${encodeURIComponent(href)}`;
  if (isAndroid()) {
    const u = new URL(href);
    return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
  }
  return null;
}

export const IN_APP_LABEL: Record<Exclude<InAppKind, null>, string> = {
  instagram: "instagram",
  facebook: "facebook",
  kakaotalk: "kakaotalk",
  naver: "naver",
  line: "line",
  threads: "threads",
};
