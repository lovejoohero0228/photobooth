"use client";

// 부스 외관 — 밤에 플래시로 찍은 필름 사진처럼. 간판, 커튼, 의자, 배출구, 세로 간판만 남긴다.
// 360×640 기준 좌표로 짜고 화면에 맞춰 통째로 확대한다.
import { useEffect, useRef, useState } from "react";
import css from "./Exterior.module.css";
import Garland from "./Garland";
import BoothSides, { BoothShade } from "./BoothSides";
import Floor from "./Floor";

interface Props {
  /** 커튼이 걷힌 상태 */
  open: boolean;
  /** 문 안으로 빨려 들어가며 사라지는 중 */
  out: boolean;
  /** 가장 최근 사진(배출구에 꽂혀 보인다) */
  latest?: string;
  total: number;
  onEnter: () => void;
  onAlbum: () => void;
}

const PLEATS = 12;
// 커튼 밑단: 주름마다 살짝 들쭉날쭉
const HEM = `polygon(0 0, 100% 0, ${Array.from({ length: PLEATS * 2 + 1 }, (_, i) => `${100 - (i * 100) / (PLEATS * 2)}% ${i % 2 ? 98.4 + (i % 3) * 0.3 : 100}%`).join(", ")})`;

export default function Exterior({ open, out, latest, total, onEnter, onAlbum }: Props) {
  const fit = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = fit.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 360));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={css.root} data-open={open} data-out={out} data-ready={scale > 0}>
      <div className={css.fit} ref={fit}>
        <div className={css.art} style={{ transform: `scale(${scale || 1})` }}>
          <div className={css.ground} />
          <div className={css.cast} />

          {/* 조명 간판 */}
          <div className={css.sign}>
            <div className={css.signFace}>
              <strong className="f-sign">PHOTOBOOTH</strong>
            </div>
          </div>
          <i className={css.post} style={{ left: 38 }} />
          <i className={css.post} style={{ left: 243 }} />

          {/* 지붕 띠, 그 위에 크리스마스 가랜드 */}
          <div className={css.fascia} />
          <Garland />

          {/* 본체 */}
          <div className={css.body}>
            <div className={css.boards} />
            <BoothSides />
            <div className={css.spill} />

            <div className={`${css.plate} f-plate`} aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <span className={css.txt}>
                <em>PHOTOS</em>
                <em>DELIVERED</em>
                <em>HERE</em>
              </span>
            </div>

            <div className={css.slot}>
              <div className={css.recess}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {latest && <img src={latest} alt="" />}
                <i className={css.handle} />
              </div>
            </div>

            {/* 문 */}
            <div className={css.door}>
              <div className={css.room}>
                <div className={css.wallUp} />
                <div className={css.wainscot} />
                <div className={css.floorBox}>
                  <Floor />
                </div>
                <div className={css.stool}>
                  {/* 바닥에 닿는 그림자: 받침 아래의 짙은 접촉 그림자, 기둥이 바닥에 드리우는 긴 그림자, 광택 바닥에 비친 상 */}
                  <i className={css.castShadow} />
                  <i className={css.contact} />
                  <i className={css.reflect} />
                  <i className={css.foot} />
                  <i className={css.leg} />
                  <i className={css.seat} />
                </div>
                <div className={css.roomShade} />
              </div>
              <div className={css.curtain}>
                <div className={css.cloth} style={{ clipPath: HEM }} />
              </div>
              <div className={css.rail} />
              <div className={css.card}>enter</div>
            </div>

            <div className={css.kick} style={{ left: 0, width: 136 }} />
            <div className={css.kick} style={{ left: 276, width: 52, transform: "scaleX(-1)" }} />
            {/* 옆면의 곡면 명암: 나무와 크롬 밑판 모두 같은 곡률로 */}
            <BoothShade />
            <div className={css.flashLight} />
          </div>

          <button className={css.hitDoor} onClick={onEnter} disabled={open} aria-label="open the curtain and step inside" />
          <button className={css.hitSlot} onClick={onAlbum} disabled={open || total === 0} aria-label={`view ${total} saved ${total === 1 ? "photo" : "photos"}`} />
        </div>
      </div>
    </div>
  );
}
