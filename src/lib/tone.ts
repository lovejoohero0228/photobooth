// 사진 톤(노출 · 대비) 설정. 흑백 현상 단계에서 쓴다.

export interface Tone {
  /** 노출: 밝기에 곱한다 (1 = 그대로) */
  gain: number;
  /** 감마: 1보다 크면 중간 톤이 밝아진다 */
  gamma: number;
  /** 대비: 128을 기준으로 벌린다 */
  contrast: number;
  /** 밝기 더하기(0~255 단위) */
  offset: number;
  /** 가장자리 어둡게 */
  vignette: number;
}

/** 이전 톤 (비교용으로 남겨 둔다) */
const PREVIOUS_TONE: Tone = { gain: 1, gamma: 1, contrast: 1.38, offset: 8, vignette: 0.5 };

/** 지금 쓰는 톤: 검정을 진하게, 대비를 세게 (b · punchy) */
export const DEFAULT_TONE: Tone = { gain: 1.05, gamma: 1, contrast: 1.75, offset: 6, vignette: 0.5 };

/** 비교용 후보 (/tone 페이지) */
export const TONE_CANDIDATES: { key: string; name: string; tone: Tone }[] = [
  { key: "previous", name: "previous", tone: PREVIOUS_TONE },
  { key: "bright", name: "a · brighter", tone: { gain: 1.12, gamma: 1.12, contrast: 1.45, offset: 10, vignette: 0.5 } },
  { key: "punchy", name: "b · punchy (deep blacks) — current", tone: DEFAULT_TONE },
  { key: "flash", name: "c · flash", tone: { gain: 1.3, gamma: 1.25, contrast: 1.5, offset: 6, vignette: 0.62 } },
  { key: "highkey", name: "d · high-key", tone: { gain: 1.25, gamma: 1.4, contrast: 1.35, offset: 14, vignette: 0.4 } },
  { key: "bold", name: "e · bright + punchy", tone: { gain: 1.18, gamma: 1.15, contrast: 1.7, offset: 4, vignette: 0.55 } },
];
