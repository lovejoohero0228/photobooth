// 서비스 전역 상수 — 정책이 바뀌면 여기만 수정

export const MAX_PARTICIPANTS = 20;
/** 부스 입장 시 자리 예약 시간 */
export const SLOT_HOLD_MS = 5 * 60 * 1000;
/** 사진 보관 기간(일). null = 무기한. 정책 미정 */
export const PHOTO_RETENTION_DAYS: number | null = null;

/** 컷 원본 긴 변(px) */
export const CUT_LONG_EDGE = 1200;
/** 컷 비율 (가로:세로 = 3:4) */
export const CUT_ASPECT = 3 / 4;
export const THUMB_LONG_EDGE = 320;

/** 12월 장식(꼬마전구, 리스) 플래그. ?deco=on|off 로 강제 가능 */
export function isDecemberDecorOn(now = new Date(), override?: string | null): boolean {
  if (override === "on") return true;
  if (override === "off") return false;
  return now.getMonth() === 11;
}

export const POSES = [
  "볼하트",
  "놀란 척",
  "산타처럼 호호호",
  "옆에 누가 있는 척",
  "윙크 한 번",
  "턱 괴고 진지하게",
  "브이 두 개",
  "눈 감고 소원 빌기",
  "입김 부는 척",
  "카메라를 째려보기",
  "올해 제일 웃겼던 순간",
  "선물 받은 표정",
];

export function randomPose(prev?: string): string {
  const pool = POSES.filter((p) => p !== prev);
  return pool[Math.floor(Math.random() * pool.length)];
}
