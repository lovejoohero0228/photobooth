// v1 도메인 타입 — 모든 데이터는 기기 안(IndexedDB)에만 저장된다.
// 원격 참여 버전의 스키마는 docs/phase2/supabase 참고.

export type PhotoStatus = "developing" | "printed";
export type PinType = "pushpin" | "tape" | "clip" | "magnet";

export interface BoardPin {
  /** 게시판 월드 좌표(사진 중심) */
  x: number;
  y: number;
  rotation: number;
  pinType: PinType;
}

export interface Photo {
  id: string;
  title: string;
  status: PhotoStatus;
  layoutKey: string;
  createdAt: string;
  printedAt: string | null;
  pin: BoardPin;
}

export interface Cut {
  id: string;
  photoId: string;
  /** 선택 입력 이름 (증명사진 시트 라벨, 폴라로이드 캡션, 뒷면) */
  name: string;
  imageKey: string;
  thumbKey: string;
  slotIndex: number;
  backComment: string | null;
  createdAt: string;
}

/** 렌더링용 컷 (이미지 URL이 해석된 상태) */
export interface CutView {
  id: string;
  name: string;
  imageUrl: string;
  thumbUrl: string;
  slotIndex: number;
  backComment?: string | null;
}

export interface PhotoWithCuts {
  photo: Photo;
  cuts: CutView[];
}
