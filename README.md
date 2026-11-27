# 포토부스(가칭)

연말 흑백 빈티지 포토부스 단체컷 웹. v1은 서버 없이 **사진이 기기 밖으로 나가지 않는** 정적 웹이다. 범위는 `photobooth-spec.md` 0장 참고.

## 실행

```bash
npm install
npm run dev -- -p 3123
```

화면은 `/` 하나다. 그 안에서 밖 → 부스 안 → 배출구 → 사진 꺼내기가 페이지 이동 없이 이어진다.

1. 밖: 커튼(enter)을 누르면 커튼이 걷히고 문 안으로 들어간다. 사진을 찍은 뒤에는 배출구에 최근 사진이 꽂혀 보이고, 누르면 보관함이 열린다.
2. 부스 안: 바로 카메라가 켜진다. "start shooting"을 누르면 그 자리에서 3부터 1까지 세고 찍기를 6번 반복한다.
3. 고르기: 2·3·4컷 중 프레임을 고르고 넣을 사진을 고른 뒤 print.
4. 배출구: 2초 뒤 사진이 내려와 놓이고 곧 화면 가운데로 커진다. 사진만(Plain), 또는 `public/bg/`의 사진 배경(목록은 `src/lib/develop.ts`의 `BACKDROPS`)을 깔아 9:16으로 저장·공유한다.

촬영 장수, 카운트다운, 인화 대기 시간은 `src/lib/config.ts`에서 바꾼다. 폰트는 영문 Google Sans, 한글 Monoplex KR(`src/app/fonts/`).

## 휴대폰에서 테스트

카메라는 HTTPS에서만 동작한다. 임시 HTTPS 터널:

```bash
cloudflared tunnel --url http://localhost:3123
```

출력된 `https://….trycloudflare.com` 을 휴대폰에서 연다. 켜져 있는 동안 주소를 아는 누구나 접속 가능하니 테스트 후 바로 끈다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/components/pb/Booth.tsx` | 장면 전환(밖·안·배출구)을 맡는 최상위 |
| `src/components/pb/Exterior.tsx` | 부스 외관 일러스트 |
| `src/components/pb/Interior.tsx` | 부스 안: 프레임 선택, 촬영 |
| `src/components/pb/Delivery.tsx` | 배출구와 사진 꺼내기 |
| `src/components/pb/Album.tsx` | 기기 안 보관함 |
| `src/lib/frames.ts` | 프레임(인화지 모양) 정의 |
| `src/lib/develop.ts` | 흑백 현상, 인화지 합성, 저장·공유 |
| `src/lib/strips.ts` | 기기 안 저장소 (IndexedDB) |
| `archive/v1/` | 이전 버전 화면(스페이스·게시판·단체컷). 빌드에서 제외 |
| `docs/phase2/` | 원격 참여 버전(2단계)용 스키마·인프라 설계 |
