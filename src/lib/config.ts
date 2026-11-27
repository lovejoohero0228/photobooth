// 서비스 전역 상수

/** 컷 한 칸의 저장 너비(px) */
export const CELL_PX = 720;
/** 컷 가로/세로 비율 (4:5, 세로로 긴 portrait). 촬영 기기 방향과 상관없이 고정 */
export const CUT_ASPECT = 0.8;
/** 한 번에 찍는 장수 */
export const SHOTS = 6;
/** 화면에 보이는 카운트다운 시작 숫자 */
export const COUNT_FROM = 3;
/** 그 카운트다운이 걸리는 시간(ms) — 실제 1초에 하나씩 */
export const COUNT_MS = 3000;
/** 찍힌 컷을 화면에 보여주는 시간(ms) */
export const STILL_MS = 700;
/** 인화 대기(초) */
export const PRINT_SECS = 1;
/** 촬영 화면에서 고를 수 있는 카메라 배율. 휴대폰 전면 카메라는 광각이라 확대 옵션을 둔다 */
export const ZOOM_LEVELS = [1.2, 1.5];
/** 처음 켰을 때 배율 (고른 배율은 기기에 기억한다): 아이폰 / 그 밖의 터치 기기 / 데스크톱 */
export const DEFAULT_ZOOM = { ios: 1.5, touch: 1.2, desktop: 1.2 };
