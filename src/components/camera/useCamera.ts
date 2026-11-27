"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MOBILE_CAMERA_ZOOM } from "@/lib/config";

export type CameraState = "idle" | "starting" | "ready" | "denied" | "unsupported" | "error";

/** 전면 카메라 스트림. iOS Safari 대응: video에 playsInline + muted 필수, HTTPS 필수 */
export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  /** 화면·촬영 모두에 걸어야 하는 디지털 확대 배율 (1이면 없음) */
  const [zoom, setZoom] = useState(1);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError(window.isSecureContext ? "this browser does not support the camera" : "the camera only works over https");
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
      // 휴대폰 전면 카메라는 광각이라 일반 배율로 맞춘다. 기기가 광학/하드웨어 줌을 주면 그걸 쓰고, 아니면 디지털로 확대한다
      let dz = 1;
      if (window.matchMedia?.("(pointer: coarse)").matches) {
        dz = MOBILE_CAMERA_ZOOM;
        try {
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: { min: number; max: number } }) | undefined;
          if (caps?.zoom) {
            const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, caps.zoom.min * MOBILE_CAMERA_ZOOM));
            await track.applyConstraints({ advanced: [{ zoom: target } as MediaTrackConstraintSet] });
            dz = 1;
          }
        } catch {
          // 하드웨어 줌이 안 되면 디지털 확대로 대신한다
        }
      }
      setZoom(dz);
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
        setError("camera permission is needed. please allow it in your browser settings");
      } else {
        setState("error");
        setError("could not start the camera");
      }
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { videoRef, state, error, size, zoom, start, stop };
}
