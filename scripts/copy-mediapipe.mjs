// 얼굴 인식(MediaPipe)용 wasm 실행 파일을 public/mediapipe/wasm 으로 복사한다.
// npm install 뒤에 자동으로 실행되고(postinstall), 복사본은 git에 올리지 않는다. (모델 파일 face_landmarker.task 는 레포에 포함)
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const to = join(root, "public", "mediapipe", "wasm");

if (!existsSync(from)) {
  console.warn("[copy-mediapipe] @mediapipe/tasks-vision 이 없어 건너뜁니다");
} else {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log("[copy-mediapipe] wasm copied to public/mediapipe/wasm");
}
