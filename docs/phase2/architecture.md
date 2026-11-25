# 인프라 설계 — 대규모 트래픽 기준

> 결론: **DB·인증은 Supabase, 이미지는 Cloudflare R2 + CDN**으로 분리한다. 비용과 병목의 대부분이 이미지 전송량이기 때문이다.

## 1. 부하 가정

12월 한정 시즌 서비스이고, 카카오톡 링크로 퍼지면 크리스마스이브·12월 31일 밤에 트래픽이 몰린다고 가정한다.

| 항목 | 가정값 | 근거 |
|---|---|---|
| 12월 MAU | 100만 | 설계 목표치 |
| 피크 동시 접속 | 5만 | 이브 21~23시, MAU의 5% |
| 1인당 참여 단체컷 | 3장 | |
| 단체컷 평균 인원 | 6명 | |
| 총 컷 수 | 300만 | 100만 × 3 |
| 총 단체컷 수 | 50만 | 300만 ÷ 6 |
| 컷 1장 용량 | 원본 220KB + 썸네일 10KB | `/lab/camera` 실측 |

| 파생 수치 | 값 |
|---|---|
| 이미지 저장량 | 약 0.8TB |
| DB 행 수 (cuts + board_pins) | 약 600만 |
| 피크 API 요청 | 약 3,500 RPS (동시 5만 × 15초당 1회) |
| 피크 컷 업로드 | 약 50건/초 |
| 월 이미지 전송량 | 약 90TB (1인당 게시판 20회 × 2.4MB + 상세 30회 × 1.3MB) |

DB 행 수와 RPS는 Postgres 한 대로 충분한 규모다. **전송량 90TB가 핵심 변수**다.

## 2. 구성

```
[모바일 브라우저]
   │  정적 JS/CSS ─────────────▶ Vercel (Next.js, CDN 캐시)
   │  데이터 (RPC) ────────────▶ Supabase: PostgREST → Postgres (+ 읽기 복제본)
   │  실시간 무효화 ◀──────────  Supabase Realtime (Broadcast)
   │  이미지 GET ──────────────▶ Cloudflare CDN → Worker(서명 검증) → R2
   └  이미지 PUT (presigned) ──▶ R2 직접 업로드
                                    │ 업로드 완료 이벤트
                                    ▼
                         Queue → Worker: 합성 미리보기·OG 이미지 렌더(resvg)
```

## 3. 핵심 설계 결정

### 3-1. 이미지: R2 + 서명 URL + CDN 캐시

| 선택지 | 월 90TB 전송 비용 | 접근 제어 |
|---|---|---|
| Supabase Storage | 약 $8,000 | RLS |
| Cloudflare R2 + CDN | $0 (전송 무료, 저장·요청 비용만) | Worker에서 서명 검증 |

가격은 공개 요금표 기준 추정치이며 계약 전 재확인 필요.

- 업로드: `commit` 전에 서버가 참여 자격(`has_access`)을 확인하고 **presigned PUT URL**을 발급 → 브라우저가 R2에 직접 올린다. Vercel 함수를 거치지 않는다.
- 다운로드: `get_board`·`get_photo` RPC가 **HMAC 서명 URL**을 함께 돌려준다. 서명은 Postgres `pgcrypto.hmac()` + Vault 비밀키로 만들어, 추가 왕복이 없다.
- 서명 만료 시각을 **정시 단위로 반올림** → 같은 시간대엔 URL이 같아 브라우저·CDN 캐시가 맞는다.
- 공개 범위 변경·빠지기는 최대 1시간 지연 반영된다. 빠지기는 R2 객체 삭제 + CDN purge로 즉시 차단한다.
- 키 규칙: `cuts/{photo_id}/{user_id}/{version}.{webp|jpg}` — 다시 찍기마다 새 키라 캐시 무효화가 필요 없다.

### 3-2. 게시판: 사진 1장 = 이미지 1장 (합성 미리보기)

게시판 100장 × 평균 6컷을 컷 단위로 그리면 이미지 요청이 600건이다. 그래서 단체컷마다 **합성 미리보기(sheet preview)** 를 서버에서 미리 만들어 둔다.

- 컷이 바뀌면 `photos.version` 증가 → Queue → Worker가 `GroupPhoto` SVG(지금 렌더러 그대로, `renderToStaticMarkup`)를 resvg로 래스터화해 R2에 저장.
- 같은 결과물을 **동적 OG 이미지**로도 쓴다.
- LOD: 멀리 = 합성 미리보기(1장), 가까이 = 개별 컷 원본, 화면 밖 = 렌더링 안 함.
- 게시판 조회는 `get_board(space_id)` RPC 한 번: 핀 + 사진 메타 + 미리보기 URL만. 컷 목록은 확대 시 사진별로 지연 로딩.

### 3-3. DB: 쓰기는 RPC, 읽기 핫패스는 RLS 함수 우회

- 쓰기는 이미 `security definer` RPC로만 받는다 (`supabase/migrations/0001_init.sql`).
- 게시판·상세 읽기는 행마다 `can_view_photo()`를 호출하는 RLS 대신, 권한 검사를 조인으로 한 번에 하는 RPC로 처리한다.
- 비정규화: `photos.participant_count`, `photos.version`, `photos.preview_path`.
- 인덱스: `board_pins(space_id)`, `cuts(photo_id, slot_index)`, `photo_access(user_id)`.
- 자리 예약 경합은 사진당 최대 20명이라 `photos` 행 잠금으로 충분하다.
- 만료된 `slot_holds`, 고아 업로드, 보관 기간 정리는 pg_cron으로.
- 읽기 부하가 커지면 Supabase 읽기 복제본으로 `get_board`를 보낸다.

### 3-4. 실시간: Broadcast로 "바뀌었다"만 알린다

- `postgres_changes`는 구독자마다 RLS를 평가해 대규모에서 병목이 되므로 쓰지 않는다.
- DB 트리거가 `photo:{id}`, `space:{id}` 채널로 **무효화 신호만** 보내고, 클라이언트가 다시 조회한다.
- 구독은 **지금 보고 있는 화면만**: 부스 안(내 단체컷), 사진 상세, 열어둔 게시판. "새 소식" 배지는 진입 시 조회로 대체.
- Supabase Realtime 동시 연결 한도는 요금제에 묶여 있다. 피크 5만 동시 연결이 필요해지면 Cloudflare Durable Objects로 옮기거나 30초 폴링으로 낮춘다.

### 3-5. 인증·남용 방지

- 익명 로그인 + **Cloudflare Turnstile**(봇 방지) — 익명 가입은 스팸 계정 생성 통로가 되기 쉽다.
- RPC별 rate limit: 참여 요청, 업로드 URL 발급, 방명록.
- 카카오 로그인은 익명 계정에 identity를 연결하는 방식으로 이후 추가.

### 3-6. 앱 호스팅

- Next.js는 거의 클라이언트 앱이라 Vercel CDN이 정적 자원을 서빙한다.
- 서버 렌더링은 `/p/[id]`·`/s/[id]`의 OG 메타 태그 정도라 서버 함수 부하는 작다.

## 4. 시즌 대비 체크리스트

1. 11월 말 k6 부하 테스트: 피크 3,500 RPS, 업로드 50건/초 시나리오
2. Supabase 컴퓨트 크기와 Realtime 연결 한도를 테스트 결과로 확정
3. R2 비용 알림, Supabase 지출 한도 설정
4. 장애 시 성능 저하 순서: 실시간 → 폴링, 개별 컷 원본 → 합성 미리보기만

## 5. 코드에 반영할 것

| 순서 | 작업 |
|---|---|
| 1 | `DataStore`에 Supabase 어댑터 추가, 이미지 URL은 RPC가 준 서명 URL 사용 |
| 2 | 스키마 수정: `photos.version`·`participant_count`·`preview_path`, `get_board`·`get_photo` RPC |
| 3 | R2 버킷 + 서명 검증 Worker + presigned 업로드 API |
| 4 | 합성 미리보기 Worker (resvg) + Queue |
| 5 | Broadcast 트리거와 화면별 구독 |
