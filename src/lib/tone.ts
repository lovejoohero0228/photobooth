// 사진 톤 · 색감 · 뷰티 설정. 현상 단계(develop.ts)에서 쓴다.
// /tone 페이지에서 값을 만져 보고, 이 기기에서만 적용하거나 DEFAULT_TONE에 옮겨 쓸 수 있다.

export interface Tone {
  /** 노출: 밝기에 곱한다 (1 = 그대로) */
  gain: number;
  /** 감마: 1보다 크면 중간 톤이 밝아진다 */
  gamma: number;
  /** 대비: 128을 기준으로 벌린다 */
  contrast: number;
  /** 밝기 더하기(0~255 단위) */
  offset: number;
  /** 가장자리 어둡게 (0~1) */
  vignette: number;
  /** 필름 입자 세기 */
  grain: number;
  /** 채도: 0이면 흑백, 1이면 원래 색 */
  saturation: number;
  /** 따뜻한 색조: 0이면 중성, 1이면 기본 은염 톤(약간 따뜻), 클수록 노랗다 */
  warmth: number;
  /** 뷰티 · 피부 매끈하게 (0~1): 결은 살리고 잡티 같은 잔 대비만 줄인다 */
  smooth: number;
  /** 뷰티 · 부드러운 빛번짐 (0~1) */
  glow: number;
  /** 뷰티 · 그늘진 곳 밝히기 (0~1) */
  lift: number;
  /** 얼굴 · 갸름하게 (0~1). 얼굴을 찾아 턱선을 안쪽으로 당긴다 */
  slim: number;
  /** 얼굴 · 눈 크게 (0~1) */
  eyes: number;
  // ── 얼굴 모양 (랜드마크로 비튼다)
  /** 코 폭 줄이기 (0~1) */
  nose: number;
  /** 턱: 양수는 짧게, 음수는 길게 (-1~1) */
  chin: number;
  /** 얼굴 세로 길이 줄이기 (0~1) */
  faceLen: number;
  /** 이마 줄이기 (0~1) */
  forehead: number;
  /** 입꼬리 올리기 (0~1) */
  smile: number;
  /** 입술 도톰하게 (0~1) */
  lips: number;
  /** 눈 사이: 양수는 가깝게, 음수는 멀게 (-1~1) */
  eyeDist: number;
  /** 눈썹 올리기 (0~1) */
  brows: number;
  // ── 피부 · 눈 (부분 보정)
  /** 다크서클 완화 (0~1) */
  underEye: number;
  /** 눈 밝히기 (0~1) */
  eyeBright: number;
  /** 치아 하얗게 (0~1) */
  teeth: number;
  /** 번들거림 줄이기: 이마·코 (0~1) */
  shine: number;
  /** 윤곽 입체감: 광대·콧날 음영 (0~1) */
  contour: number;
  /** 잡티 지우기 (0~1) */
  blemish: number;
}

/** 이전 톤 (비교용으로 남겨 둔다) */
const PREVIOUS_TONE: Tone = { gain: 1, gamma: 1, contrast: 1.38, offset: 8, vignette: 0.5, grain: 24, saturation: 0, warmth: 1, smooth: 0, glow: 0, lift: 0, slim: 0, eyes: 0, nose: 0, chin: 0, faceLen: 0, forehead: 0, smile: 0, lips: 0, eyeDist: 0, brows: 0, underEye: 0, eyeBright: 0, teeth: 0, shine: 0, contour: 0, blemish: 0 };

/** 지금 쓰는 톤: 직접 찾은 최적값 (밝고 부드러운 흑백에 약한 얼굴 보정) */
export const DEFAULT_TONE: Tone = {
  gain: 1.25,
  gamma: 1.16,
  contrast: 1.55,
  offset: 1,
  vignette: 0.6,
  grain: 15,
  saturation: 0,
  warmth: 0,
  smooth: 0.06,
  glow: 0.04,
  lift: 0,
  slim: 0.02,
  eyes: 0.02,
  nose: 0.09,
  chin: 0,
  faceLen: 0.06,
  forehead: 0,
  smile: 0.01,
  lips: 0.02,
  eyeDist: 0,
  brows: 0,
  underEye: 0.05,
  eyeBright: 0.01,
  teeth: 0.01,
  shine: 0,
  contour: 0,
  blemish: 0,
};

/** 얼굴을 찾아서 처리해야 하는 값들 */
export const FACE_KEYS: (keyof Tone)[] = ["slim", "eyes", "nose", "chin", "faceLen", "forehead", "smile", "lips", "eyeDist", "brows", "underEye", "eyeBright", "teeth", "shine", "contour", "blemish"];

/** 얼굴 인식이 필요한 효과가 하나라도 켜져 있는가 */
export function hasFaceFx(t: Tone): boolean {
  return FACE_KEYS.some((k) => t[k] !== 0);
}

/** 슬라이더 정의 (/tone 페이지) */
export const TONE_CONTROLS: { group: string; items: { key: keyof Tone; label: string; min: number; max: number; step: number }[] }[] = [
  {
    group: "tone",
    items: [
      { key: "gain", label: "exposure", min: 0.6, max: 1.8, step: 0.01 },
      { key: "gamma", label: "midtones", min: 0.6, max: 1.8, step: 0.01 },
      { key: "contrast", label: "contrast", min: 0.8, max: 2.4, step: 0.01 },
      { key: "offset", label: "brightness", min: -40, max: 60, step: 1 },
      { key: "vignette", label: "vignette", min: 0, max: 1, step: 0.01 },
      { key: "grain", label: "grain", min: 0, max: 70, step: 1 },
    ],
  },
  {
    group: "color",
    items: [
      { key: "saturation", label: "saturation (0 = b&w)", min: 0, max: 1.2, step: 0.01 },
      { key: "warmth", label: "warmth", min: -2, max: 4, step: 0.05 },
    ],
  },
  {
    group: "beauty",
    items: [
      { key: "smooth", label: "skin smoothing", min: 0, max: 1, step: 0.01 },
      { key: "glow", label: "soft glow", min: 0, max: 1, step: 0.01 },
      { key: "lift", label: "shadow lift", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    group: "face shape",
    items: [
      { key: "slim", label: "slim face", min: 0, max: 1, step: 0.01 },
      { key: "eyes", label: "bigger eyes", min: 0, max: 1, step: 0.01 },
      { key: "nose", label: "narrower nose", min: 0, max: 1, step: 0.01 },
      { key: "chin", label: "chin (− longer / + shorter)", min: -1, max: 1, step: 0.01 },
      { key: "faceLen", label: "shorter face", min: 0, max: 1, step: 0.01 },
      { key: "forehead", label: "smaller forehead", min: 0, max: 1, step: 0.01 },
      { key: "smile", label: "smile", min: 0, max: 1, step: 0.01 },
      { key: "lips", label: "fuller lips", min: 0, max: 1, step: 0.01 },
      { key: "eyeDist", label: "eye gap (− wider / + closer)", min: -1, max: 1, step: 0.01 },
      { key: "brows", label: "lift brows", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    group: "skin & eyes",
    items: [
      { key: "underEye", label: "under-eye brighten", min: 0, max: 1, step: 0.01 },
      { key: "eyeBright", label: "eye brighten", min: 0, max: 1, step: 0.01 },
      { key: "teeth", label: "teeth whiten", min: 0, max: 1, step: 0.01 },
      { key: "shine", label: "reduce shine", min: 0, max: 1, step: 0.01 },
      { key: "contour", label: "contour", min: 0, max: 1, step: 0.01 },
      { key: "blemish", label: "blemish remove", min: 0, max: 1, step: 0.01 },
    ],
  },
];

/** 비교용 후보 (/tone 페이지) */
export const TONE_PRESETS: { key: string; name: string; tone: Tone }[] = [
  { key: "default", name: "current", tone: DEFAULT_TONE },
  { key: "punchy", name: "punchy (old default)", tone: { ...PREVIOUS_TONE, gain: 1.05, gamma: 1, contrast: 1.75, offset: 6, vignette: 0.5, warmth: 1 } },
  { key: "previous", name: "previous", tone: PREVIOUS_TONE },
  { key: "bright", name: "brighter", tone: { ...DEFAULT_TONE, gain: 1.12, gamma: 1.12, contrast: 1.45, offset: 10 } },
  { key: "flash", name: "flash", tone: { ...DEFAULT_TONE, gain: 1.3, gamma: 1.25, contrast: 1.5, offset: 6, vignette: 0.62 } },
  { key: "highkey", name: "high-key", tone: { ...DEFAULT_TONE, gain: 1.25, gamma: 1.4, contrast: 1.35, offset: 14, vignette: 0.4 } },
  { key: "bold", name: "bright + punchy", tone: { ...DEFAULT_TONE, gain: 1.18, gamma: 1.15, contrast: 1.7, offset: 4, vignette: 0.55 } },
  { key: "soft", name: "soft beauty", tone: { ...DEFAULT_TONE, gain: 1.12, gamma: 1.2, contrast: 1.4, offset: 10, smooth: 0.6, glow: 0.35, lift: 0.3 } },
  { key: "colorsoft", name: "soft color", tone: { ...DEFAULT_TONE, gain: 1.08, gamma: 1.15, contrast: 1.25, offset: 8, saturation: 0.7, warmth: 0.6, smooth: 0.5, glow: 0.3, lift: 0.25, grain: 14 } },
];

const KEY = "pb.tone";
const PRESET_KEY = "pb.tone.presets";

/** 내가 저장한 프리셋 (이 기기) */
export interface SavedPreset {
  id: number;
  name: string;
  tone: Tone;
}

export function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (raw) {
      const list = JSON.parse(raw) as SavedPreset[];
      return list.map((p) => ({ ...p, tone: { ...DEFAULT_TONE, ...p.tone } }));
    }
  } catch {}
  return [];
}

function writePresets(list: SavedPreset[]) {
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(list));
  } catch {}
}

/** 현재 값을 "preset N"으로 저장한다. N은 지금까지 만든 가장 큰 번호 + 1 */
export function addPreset(tone: Tone): SavedPreset[] {
  const list = loadPresets();
  const max = list.reduce((m, p) => Math.max(m, Number(/^preset (\d+)$/.exec(p.name)?.[1] ?? 0)), 0);
  const next = [...list, { id: Date.now(), name: `preset ${max + 1}`, tone }];
  writePresets(next);
  return next;
}

export function removePreset(id: number): SavedPreset[] {
  const next = loadPresets().filter((p) => p.id !== id);
  writePresets(next);
  return next;
}

/** 이 기기에 저장해 둔 톤(있으면)을 기본 톤 위에 얹은 값. 저장해 둔 게 없으면 DEFAULT_TONE */
export function getTone(): Tone {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) return { ...DEFAULT_TONE, ...(JSON.parse(raw) as Partial<Tone>) };
  } catch {
    // 저장값이 깨졌으면 기본 톤을 쓴다
  }
  return DEFAULT_TONE;
}

export function saveTone(t: Tone) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t));
  } catch {}
}

export function clearTone() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export function hasSavedTone() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
