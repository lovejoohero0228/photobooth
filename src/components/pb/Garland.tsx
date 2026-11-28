// 지붕 위에 둘러 놓은 크리스마스 가랜드: 어둡고 차분한 전나무 가지 + 반짝이는 작은 트리 전구.
// 360×74 좌표계의 SVG. 난수는 시드 고정이라 서버·클라이언트 렌더가 같다.
import css from "./Exterior.module.css";

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 360;
/** 가랜드가 늘어지는 중심선 (살짝 물결) */
const lineY = (x: number) => 30 + 3.2 * Math.sin((x / W) * Math.PI * 6) + 1.4 * Math.sin((x / W) * Math.PI * 17);

interface Sprig {
  /** 가지와 솔잎 전체 */
  d: string;
  /** 솔잎 끝 부분만 (조금 밝게 덧그려 질감을 만든다) */
  tips: string;
  color: string;
  tipColor: string;
  w: number;
}

const GREENS_BACK = ["#0a120c", "#0d1810", "#101d13"];
const GREENS_MID = ["#14231a", "#18291d", "#1c3022"];
const GREENS_FRONT = ["#233a2a", "#2a4631", "#31503a", "#27402d", "#3a5a41"];
/** 솔잎 끝의 밝은 색 (각 층 색보다 한 단계 밝고 살짝 노란 기)  */
const TIP: Record<string, string> = {};
function tipOf(hex: string): string {
  if (TIP[hex]) return TIP[hex];
  const n = parseInt(hex.slice(1), 16);
  const lift = (v: number, k: number) => Math.min(255, Math.round(v + k));
  const r = lift((n >> 16) & 255, 26);
  const g = lift((n >> 8) & 255, 34);
  const b = lift(n & 255, 12);
  return (TIP[hex] = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`);
}

const f = (n: number) => n.toFixed(1);

/** 가지 하나: 굵은 줄기 + 줄기에서 갈라지는 잔가지 + 촘촘한 솔잎. 솔잎은 가늘고 길이·각도가 제각각 */
function sprig(r: () => number, x: number, y: number, len: number, deg: number, color: string, w: number): Sprig {
  const bend = (r() - 0.5) * 0.5;
  const pts: [number, number][] = [];
  const seg = 5;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const a = (deg * Math.PI) / 180 + bend * t;
    // 줄기가 살짝 휜다
    const px = i === 0 ? x : pts[i - 1][0] + Math.cos(a) * (len / seg);
    const py = i === 0 ? y : pts[i - 1][1] + Math.sin(a) * (len / seg);
    pts.push([px, py]);
  }
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}` + pts.slice(1).map(([px, py]) => `L${f(px)} ${f(py)}`).join("");
  let tips = "";
  const needle = (px: number, py: number, ang: number, nl: number) => {
    const ex = px + Math.cos(ang) * nl;
    const ey = py + Math.sin(ang) * nl;
    d += `M${f(px)} ${f(py)}L${f(ex)} ${f(ey)}`;
    // 끝 40%만 밝게
    tips += `M${f(px + (ex - px) * 0.58)} ${f(py + (ey - py) * 0.58)}L${f(ex)} ${f(ey)}`;
  };
  const n = 12 + Math.floor(r() * 5);
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const k = Math.min(seg - 1, Math.floor(t * seg));
    const [ax, ay] = pts[k];
    const [bx, by] = pts[k + 1];
    const u = t * seg - k;
    const px = ax + (bx - ax) * u;
    const py = ay + (by - ay) * u;
    const base = Math.atan2(by - ay, bx - ax);
    const nl = (1 - t * 0.5) * (5 + r() * 4.2);
    for (const side of [-1, 1]) {
      // 솔잎: 양쪽으로, 앞쪽으로 기울고, 길이·각도가 조금씩 다르다
      needle(px, py, base + side * ((32 + r() * 34) * Math.PI) / 180, nl * (0.8 + r() * 0.4));
      if (r() < 0.35) needle(px, py, base + side * ((14 + r() * 18) * Math.PI) / 180, nl * 0.7);
    }
  }
  // 줄기 끝의 솔잎 다발
  for (let j = -2; j <= 2; j++) needle(pts[seg][0], pts[seg][1], Math.atan2(pts[seg][1] - pts[seg - 1][1], pts[seg][0] - pts[seg - 1][0]) + j * 0.3, 3.4 + r() * 1.8);
  // 잔가지 하나
  if (r() < 0.6) {
    const t = 0.35 + r() * 0.3;
    const k = Math.floor(t * seg);
    const bx = pts[k][0];
    const by = pts[k][1];
    const side = r() < 0.5 ? -1 : 1;
    const ang = Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]) + side * (0.7 + r() * 0.4);
    const bl = len * (0.35 + r() * 0.2);
    d += `M${f(bx)} ${f(by)}L${f(bx + Math.cos(ang) * bl)} ${f(by + Math.sin(ang) * bl)}`;
    for (let i = 1; i <= 5; i++) {
      const tt = i / 6;
      const px = bx + Math.cos(ang) * bl * tt;
      const py = by + Math.sin(ang) * bl * tt;
      for (const s2 of [-1, 1]) needle(px, py, ang + s2 * ((34 + r() * 28) * Math.PI) / 180, 3.6 + r() * 2.6);
    }
  }
  return { d, tips, color, tipColor: tipOf(color), w };
}

function build() {
  const r = rng(1224);
  const pick = (a: string[]) => a[Math.floor(r() * a.length)];
  const back: Sprig[] = [];
  const mid: Sprig[] = [];
  const front: Sprig[] = [];
  for (let x = 2; x <= W - 2; x += 3.4) {
    const y = lineY(x) - 3 + (r() - 0.5) * 7;
    back.push(sprig(r, x, y, 20 + r() * 11, 15 + r() * 150, pick(GREENS_BACK), 0.95));
  }
  for (let x = 1; x <= W - 1; x += 3.6) {
    const y = lineY(x) - 3 + (r() - 0.5) * 8;
    mid.push(sprig(r, x, y, 18 + r() * 11, 10 + r() * 170, pick(GREENS_MID), 0.9));
  }
  for (let x = 3; x <= W - 3; x += 3.8) {
    const y = lineY(x) - 3 + (r() - 0.5) * 9;
    front.push(sprig(r, x, y, 16 + r() * 12, -15 + r() * 210, pick(GREENS_FRONT), 0.85));
  }

  // 작은 전구: 크기는 모두 같게, 많이 · 고르게. 가지 영역 전체에 흩어 놓고 밝기만 조금씩 다르게
  const N_LIGHT = 92;
  const lights = Array.from({ length: N_LIGHT }, (_, i) => {
    const x = 4 + (i * (W - 8)) / (N_LIGHT - 1) + (r() - 0.5) * 4;
    const wave = Math.sin(i * 2.399) * 9; // 황금각 간격으로 위아래에 고르게 퍼진다
    return {
      x,
      y: lineY(x) + 5 + wave + (r() - 0.5) * 4,
      peak: 0.55 + r() * 0.45,
      dur: 1.4 + r() * 1.6,
      delay: -r() * 3.5,
      color: pick(["#fffaf0", "#fff3d2", "#ffe3a8", "#ffd27a"]),
    };
  });
  return { back, mid, front, lights };
}

const G = build();

/** 전구의 크기 — 고정 */
const LIGHT_CORE = 1.1;
const LIGHT_GLOW = 4.2;

function Layer({ list }: { list: Sprig[] }) {
  return (
    <g fill="none" strokeLinecap="round">
      {list.map((s, i) => (
        <g key={i}>
          <path d={s.d} stroke={s.color} strokeWidth={s.w} />
          <path d={s.tips} stroke={s.tipColor} strokeWidth={s.w * 0.9} opacity={0.75} />
        </g>
      ))}
    </g>
  );
}

export default function Garland() {
  return (
    <svg className={css.garland} viewBox={`0 0 ${W} 74`} width={W} height={74} aria-hidden="true">
      <defs>
        <radialGradient id="g-glow">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#ffb85a" stopOpacity="0.3" />
          <stop offset="1" stopColor="#ffb85a" stopOpacity="0" />
        </radialGradient>
      </defs>

      <Layer list={G.back} />

      {/* 전구 줄 */}
      <path d={`M0 ${lineY(0) + 3}${Array.from({ length: 73 }, (_, i) => `L${(i + 1) * 5} ${(lineY((i + 1) * 5) + 3).toFixed(1)}`).join("")}`} fill="none" stroke="#050806" strokeWidth="0.9" opacity="0.85" />

      <Layer list={G.mid} />
      <Layer list={G.front} />

      {/* 작은 트리 전구: 크기는 모두 같고, 밝기와 주기만 조금씩 다르다 */}
      {G.lights.map((l, i) => (
        <g key={i} style={{ ["--peak" as string]: l.peak, animationDuration: `${l.dur.toFixed(2)}s`, animationDelay: `${l.delay.toFixed(2)}s` }} className={css.light}>
          <circle cx={l.x} cy={l.y} r={LIGHT_GLOW} fill="url(#g-glow)" />
          <circle cx={l.x} cy={l.y} r={LIGHT_CORE} fill={l.color} />
        </g>
      ))}
    </svg>
  );
}
