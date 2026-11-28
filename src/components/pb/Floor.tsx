// 부스 안 바닥: 단순한 체커보드. 3D 변환 없이 원근을 직접 계산한 사각형으로 그린다(모바일에서 3D 변환 바닥이 깜빡이다 사라졌다).
// 130×52 좌표계. 소실점은 바닥 위쪽 가운데.
const W = 130;
const H = 52;
const VX = W / 2;
const YH = -34; // 지평선(소실점)의 y
const K = H - YH; // 가장 가까운 줄(y=H)이 z=1이 되도록
const CELL = 30; // 가장 가까운 줄에서의 타일 폭
const ROWS = 6;
const Z_FAR = K / (0 - YH); // y=0에 닿는 깊이

const zAt = (k: number) => 1 + (k * (Z_FAR - 1)) / ROWS;
const yAt = (z: number) => YH + K / z;
const xAt = (i: number, z: number) => VX + ((i + 0.5) * CELL) / z;

function cells() {
  const out: { d: string; dark: boolean }[] = [];
  for (let k = 0; k < ROWS; k++) {
    // k=0이 가장 먼 줄(위), 아래로 갈수록 가까워진다
    const zFar = zAt(ROWS - k);
    const zNear = zAt(ROWS - k - 1);
    const yFar = yAt(zFar);
    const yNear = yAt(zNear);
    for (let i = -8; i < 8; i++) {
      const d = `M${xAt(i, zFar).toFixed(2)} ${yFar.toFixed(2)}L${xAt(i + 1, zFar).toFixed(2)} ${yFar.toFixed(2)}L${xAt(i + 1, zNear).toFixed(2)} ${yNear.toFixed(2)}L${xAt(i, zNear).toFixed(2)} ${yNear.toFixed(2)}Z`;
      out.push({ d, dark: (i + k) % 2 === 0 });
    }
  }
  return out;
}

const CELLS = cells();

export default function Floor() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} aria-hidden="true">
      <defs>
        <linearGradient id="floor-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.62" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="#1c1a17" />
      {CELLS.map((c, i) => (
        <path key={i} d={c.d} fill={c.dark ? "#1b1916" : "#e7dfcd"} />
      ))}
      {/* 멀리 갈수록 어두워진다 */}
      <rect width={W} height={H} fill="url(#floor-fade)" />
    </svg>
  );
}
