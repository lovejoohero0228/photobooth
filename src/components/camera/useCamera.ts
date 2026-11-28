"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_ZOOM, ZOOM_LEVELS } from "@/lib/config";

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
  /** 사용자가 고른 배율 */
  const [level, setLevelState] = useState(1);
  const levelRef = useRef(1);
  /** 기기가 하드웨어 줌을 주면 그걸 쓴다 */
  const hwRef = useRef<{ track: MediaStreamTrack; min: number; max: number } | null>(null);
  /** 카메라 내장 플래시(토치)를 켤 수 있는 트랙 */
  const torchRef = useRef<MediaStreamTrack | null>(null);
  const [hasTorch, setHasTorch] = useState(false);

  const apply = useCallback(async (l: number) => {
    const hw = hwRef.current;
    if (hw) {
      try {
        await hw.track.applyConstraints({ advanced: [{ zoom: Math.min(hw.max, Math.max(hw.min, hw.min * l)) } as MediaTrackConstraintSet] });
        setZoom(1);
        return;
      } catch {
        hwRef.current = null;
      }
    }
    setZoom(l);
  }, []);

  const setLevel = useCallback(
    (l: number) => {
      levelRef.current = l;
      setLevelState(l);
      try {
        localStorage.setItem("pb.zoom", String(l));
      } catch {}
      void apply(l);
    },
    [apply],
  );

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
      let stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      // 전면 카메라가 여러 개(예: 광각 + 일반)로 보이는 기기라면 광각이 아닌 쪽을 고른다
      if (window.matchMedia?.("(pointer: coarse)").matches) {
        try {
          const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && /front|user|전면/i.test(d.label));
          const normal = cams.find((d) => !/ultra|wide|광각/i.test(d.label));
          const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
          if (cams.length > 1 && normal && normal.deviceId !== current) {
            const next = await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: normal.deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } },
              audio: false,
            });
            stream.getTracks().forEach((t) => t.stop());
            stream = next;
          }
        } catch {
          // 고를 수 없으면 기본 전면 카메라를 그대로 쓴다
        }
      }
      streamRef.current = stream;
      // 배율: 기억해 둔 값 → 없으면 기기별 기본값. 하드웨어 줌이 되면 그걸, 아니면 디지털로 확대한다
      const coarse = !!window.matchMedia?.("(pointer: coarse)").matches;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      let saved: number | null = null;
      try {
        const n = Number(localStorage.getItem("pb.zoom"));
        if (ZOOM_LEVELS.includes(n)) saved = n;
      } catch {}
      const l = saved ?? (ios ? DEFAULT_ZOOM.ios : coarse ? DEFAULT_ZOOM.touch : DEFAULT_ZOOM.desktop);
      levelRef.current = l;
      setLevelState(l);
      hwRef.current = null;
      torchRef.current = null;
      setHasTorch(false);
      try {
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { zoom?: { min: number; max: number } }) | undefined;
        if (caps?.zoom) hwRef.current = { track, min: caps.zoom.min, max: caps.zoom.max };
        if ((caps as { torch?: boolean } | undefined)?.torch) {
          torchRef.current = track;
          setHasTorch(true);
        }
      } catch {}
      await apply(l);
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
  }, [stop, apply]);

  /** 내장 플래시(토치)를 켜고 끈다. 이 카메라가 지원하지 않으면 false */
  const torch = useCallback(async (on: boolean): Promise<boolean> => {
    const track = torchRef.current;
    if (!track) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { videoRef, state, error, size, zoom, level, setLevel, hasTorch, torch, start, stop };
}
