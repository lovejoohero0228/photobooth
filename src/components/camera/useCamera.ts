"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CameraState = "idle" | "starting" | "ready" | "denied" | "unsupported" | "error";

/** 전면 카메라 스트림. iOS Safari 대응: video에 playsInline + muted 필수, HTTPS 필수 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError(window.isSecureContext ? "이 브라우저는 카메라를 지원하지 않아요" : "카메라는 HTTPS 주소에서만 쓸 수 있어요");
      return;
    }
    setState("starting");
    try {
      stop();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await new Promise<void>((res) => {
          if (v.readyState >= 1) res();
          else v.onloadedmetadata = () => res();
        });
        await v.play().catch(() => undefined);
        setSize({ w: v.videoWidth, h: v.videoHeight });
      }
      setState("ready");
      setError(null);
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setError("카메라 권한이 필요해요. 브라우저 설정에서 허용해 주세요");
      } else {
        setState("error");
        setError("카메라를 켤 수 없어요");
      }
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, state, error, size, start, stop };
}
