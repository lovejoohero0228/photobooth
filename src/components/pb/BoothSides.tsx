// 부스 옆면: 위에서 봤을 때 모서리가 둥근 사각형이라, 정면에서는 양옆으로 갈수록 판자가 가늘어지고
// 그만큼 판자 수가 늘어나며 어두워진다. (판자 하나의 호 길이는 같고, 화면에 보이는 폭만 cos으로 줄어든다)
import css from "./Exterior.module.css";

/** 옆면이 차지하는 가로 폭(px)이자 곡면의 반지름. 오른쪽은 문과 세로 간판 때문에 보이는 폭이 좁다 */
const LEFT_W = 84;
const RIGHT_W = 54;
const PLANK = 12.13;
const COLORS = ["#7e532f", "#724926", "#845934", "#764c28", "#7d512d"];
const H = 458;
/** 크롬 밑판이 시작되는 높이 (Exterior.module.css의 .kick top) */
const KICK_TOP = 388;

interface Plank {
  x0: number;
  x1: number;
  fill: string;
  /** 어둡게 덮을 정도 (0~1) */
  dark: number;
}

/** 빛은 정면에서 약간 왼쪽 위로 온다 (라디안) */
const LIGHT = 0.26;

/** 안쪽(곡면이 시작되는 곳)에서 바깥 끝까지의 판자들. x는 안쪽 기준 0 → SIDE_W.
 *  side: 왼쪽 옆면은 법선이 왼쪽으로 기울어 빛 쪽을 향하고, 오른쪽 옆면은 빛을 등진다 */
function planks(SIDE_W: number, offset: number, side: "l" | "r"): Plank[] {
  const out: Plank[] = [];
  const dTheta = PLANK / SIDE_W;
  for (let k = 0; k * dTheta < Math.PI / 2; k++) {
    const t0 = k * dTheta;
    const t1 = Math.min(Math.PI / 2, (k + 1) * dTheta);
    const mid = (t0 + t1) / 2;
    // 램버트: 면의 법선과 빛 방향이 이루는 각의 코사인. 약한 주변광을 더하고 감마로 대비를 세게 준다
    const ang = side === "l" ? mid - LIGHT : mid + LIGHT;
    const lit = Math.max(0, Math.cos(ang));
    const brightness = 0.09 + 0.91 * Math.pow(lit, 1.5);
    // 맨 바깥쪽은 주변이 가려져 한 번 더 어두워진다
    const edge = Math.pow(mid / (Math.PI / 2), 6);
    out.push({
      x0: SIDE_W * Math.sin(t0),
      x1: SIDE_W * Math.sin(t1),
      fill: COLORS[(k + offset) % COLORS.length],
      dark: Math.min(0.96, 1 - brightness + edge * 0.28),
    });
  }
  return out;
}

/** 같은 램버트 계산을 판자 단위가 아니라 연속으로 계산한 어둡기 (0~1). x는 안쪽에서 바깥으로 0 → SIDE_W */
function darkAt(SIDE_W: number, x: number, side: "l" | "r"): number {
  const theta = Math.asin(Math.min(1, Math.max(0, x / SIDE_W)));
  const ang = side === "l" ? theta - LIGHT : theta + LIGHT;
  const lit = Math.max(0, Math.cos(ang));
  const brightness = 0.09 + 0.91 * Math.pow(lit, 1.5);
  const edge = Math.pow(theta / (Math.PI / 2), 6);
  return Math.min(0.96, 1 - brightness + edge * 0.28);
}

/** 크롬처럼 매끈한 면용: 판자 경계 없이 이어지는 곡면 그라데이션 */
function smoothGradient(SIDE_W: number, side: "l" | "r"): string {
  const N = 48;
  const stops: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; // CSS 그라데이션의 진행 방향(왼쪽 → 오른쪽) 위치
    // 곡면이 시작되는 안쪽 경계에서 떨어진 거리: 왼쪽 옆면은 안쪽이 오른쪽, 오른쪽 옆면은 안쪽이 왼쪽
    const fromInner = (side === "l" ? 1 - t : t) * SIDE_W;
    stops.push(`rgba(8,3,0,${darkAt(SIDE_W, fromInner, side).toFixed(3)}) ${(t * 100).toFixed(1)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

const LEFT = planks(LEFT_W, 0, "l");
const RIGHT = planks(RIGHT_W, 2, "r");

function geometry(side: "l" | "r", list: Plank[], SIDE_W: number) {
  // 왼쪽 옆면은 안쪽이 오른쪽, 오른쪽 옆면은 안쪽이 왼쪽
  const X = (x: number) => (side === "l" ? SIDE_W - x : x);
  return list.map((p) => {
    const a = X(p.x0);
    const b = X(p.x1);
    const x = Math.min(a, b);
    const w = Math.abs(b - a);
    return { p, x, w };
  });
}

/** 아래층: 판자 색과 홈 */
function SideBase({ side, list, SIDE_W }: { side: "l" | "r"; list: Plank[]; SIDE_W: number }) {
  return (
    <svg className={side === "l" ? css.sideL : css.sideR} viewBox={`0 0 ${SIDE_W} ${H}`} style={{ width: SIDE_W }} height={H} preserveAspectRatio="none" aria-hidden="true">
      {geometry(side, list, SIDE_W).map(({ p, x, w }, i) => (
        <g key={i}>
          <rect x={x - 0.2} y={0} width={w + 0.4} height={H} fill={p.fill} />
          {/* 판자 사이 홈: 안쪽 경계마다 어두운 선 + 옆의 밝은 선 */}
          <rect x={side === "l" ? x + w - 0.5 : x - 0.1} y={0} width={0.7} height={H} fill="#1c0b02" opacity={0.75} />
          <rect x={side === "l" ? x + w - 1.2 : x + 0.6} y={0} width={0.6} height={H} fill="#f8c89d" opacity={0.16 * (1 - p.dark)} />
        </g>
      ))}
    </svg>
  );
}

/** 맨 위층: 곡면의 명암. 나뭇결 질감 위에 얹어야 질감에 씻기지 않는다 */
function SideShade({ side, list, SIDE_W }: { side: "l" | "r"; list: Plank[]; SIDE_W: number }) {
  return (
    <svg className={side === "l" ? css.sideL : css.sideR} viewBox={`0 0 ${SIDE_W} ${KICK_TOP}`} style={{ width: SIDE_W, height: KICK_TOP, pointerEvents: "none" }} height={KICK_TOP} preserveAspectRatio="none" aria-hidden="true">
      {geometry(side, list, SIDE_W).map(({ p, x, w }, i) => (
        <rect key={i} x={x - 0.2} y={0} width={w + 0.4} height={KICK_TOP} fill="#080300" opacity={p.dark} />
      ))}
    </svg>
  );
}

export default function BoothSides() {
  return (
    <>
      <SideBase side="l" list={LEFT} SIDE_W={LEFT_W} />
      <SideBase side="r" list={RIGHT} SIDE_W={RIGHT_W} />
      <div className={css.sideTexL} style={{ width: LEFT_W }} />
      <div className={css.sideTexR} style={{ width: RIGHT_W }} />
    </>
  );
}

/** 곡면의 명암. 아래 크롬 밑판 위에도 같은 곡률로 얹어서, 위쪽 나무 판넬과 이어져 휘어 보이게 한다 */
export function BoothShade() {
  return (
    <>
      <SideShade side="l" list={LEFT} SIDE_W={LEFT_W} />
      <SideShade side="r" list={RIGHT} SIDE_W={RIGHT_W} />
      {/* 크롬 밑판: 판자 경계 없이 매끈하게 이어지는 같은 곡률의 명암 */}
      <div className={css.kickShade} style={{ left: 0, width: LEFT_W, background: smoothGradient(LEFT_W, "l") }} />
      <div className={css.kickShade} style={{ right: 0, width: RIGHT_W, background: smoothGradient(RIGHT_W, "r") }} />
    </>
  );
}
