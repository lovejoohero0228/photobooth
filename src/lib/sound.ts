// 효과음 — 오디오 파일 없이 WebAudio로 합성 (동전, 셔터, 배출구 드르륵, 카운트다운 띵)

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem("pb.muted", v ? "1" : "0");
  } catch {}
}
export function isMuted() {
  try {
    muted = localStorage.getItem("pb.muted") === "1";
  } catch {}
  return muted;
}

/** iOS는 사용자 제스처 안에서 한 번 깨워야 소리가 난다 */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume();
}

function ac(): AudioContext | null {
  if (muted || !ctx) return null;
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.2) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime + start);
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination);
  o.start(a.currentTime + start);
  o.stop(a.currentTime + start + dur + 0.02);
}

function noise(start: number, dur: number, gain = 0.3, filterFreq = 3000) {
  const a = ac();
  if (!a) return;
  const len = Math.ceil(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = filterFreq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

/** 동전이 투입구로 떨어지며 내는 금속음 */
export function playCoin(short = false) {
  tone(2637, 0, 0.25, "triangle", 0.12);
  tone(3520, 0.02, 0.2, "sine", 0.06);
  if (short) return;
  for (let i = 0; i < 4; i++) {
    tone(1800 - i * 220, 0.28 + i * 0.07, 0.08, "triangle", 0.06 - i * 0.01);
    noise(0.28 + i * 0.07, 0.04, 0.12, 4000);
  }
}

export function playBeep(final = false) {
  tone(final ? 1320 : 880, 0, 0.18, "sine", 0.14);
}

export function playShutter() {
  noise(0, 0.05, 0.5, 2500);
  noise(0.07, 0.06, 0.35, 1800);
  tone(140, 0, 0.08, "square", 0.05);
}

/** 배출구에서 사진이 드르륵 */
export function playDispense(duration = 1.4) {
  const n = Math.floor(duration / 0.045);
  for (let i = 0; i < n; i++) noise(i * 0.045, 0.02, 0.18, 900 + (i % 3) * 200);
  tone(90, 0, duration, "sawtooth", 0.025);
}

/** 커튼 천이 쓸리는 소리 */
export function playCurtain() {
  noise(0, 0.4, 0.22, 650);
  noise(0.12, 0.3, 0.14, 1100);
}

/** 기계식 버튼 딸깍 */
export function playClick() {
  noise(0, 0.018, 0.3, 2600);
  tone(190, 0, 0.05, "square", 0.05);
}

/** 인화 대기 중 기계 웅웅 */
export function playHum(duration = 2) {
  tone(58, 0, duration, "sawtooth", 0.03);
  tone(116, 0, duration, "sine", 0.02);
}

/** 사진을 꺼낼 때 종이 스치는 소리 */
export function playPaper() {
  noise(0, 0.16, 0.2, 3800);
}
