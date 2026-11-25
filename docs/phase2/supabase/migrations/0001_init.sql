-- 포토부스(가칭) 초기 스키마 + RLS
-- 원칙: 읽기는 RLS로 공개 범위 강제, 상태를 바꾸는 쓰기(참여·수락·마감·빠지기)는
--       검증 로직이 담긴 security definer RPC로만 허용한다.

create extension if not exists pgcrypto;

-- ───────────────────────── tables
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 20),
  avatar_seed text not null default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.users (id) on delete cascade, -- 사용자당 1개
  created_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 40),
  creator_id uuid not null references public.users (id) on delete cascade,
  origin_space_id uuid not null references public.spaces (id) on delete cascade,
  status text not null default 'developing' check (status in ('developing', 'printed')),
  layout_key text not null default 'strip-v',
  visibility text not null default 'link' check (visibility in ('participants', 'link', 'public')),
  -- 추측 불가능한 초대 토큰 (192bit)
  invite_token text not null unique default encode(gen_random_bytes(24), 'base64'),
  created_at timestamptz not null default now(),
  printed_at timestamptz
);

create table public.cuts (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  image_path text not null,
  thumb_path text not null,
  slot_index int not null default 0,
  back_comment text check (char_length(back_comment) <= 140),
  created_at timestamptz not null default now(),
  unique (photo_id, user_id) -- 1인 1컷
);
create index on public.cuts (photo_id, slot_index);
create index on public.cuts (user_id);

create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  requester_id uuid not null references public.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  decided_by uuid references public.users (id),
  created_at timestamptz not null default now()
);
create unique index join_requests_one_pending on public.join_requests (photo_id, requester_id) where status = 'pending';

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.board_pins (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  photo_id uuid not null references public.photos (id) on delete cascade,
  x real not null default 0,
  y real not null default 0,
  rotation real not null default 0,
  pin_type text not null default 'pushpin' check (pin_type in ('pushpin', 'tape', 'clip', 'magnet')),
  hidden boolean not null default false,
  unique (space_id, photo_id)
);

create table public.slot_holds (
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  primary key (photo_id, user_id)
);

-- 초대 링크로 들어왔거나 요청이 수락된 사람 = 부스 입장 자격 (아직 컷은 없음)
create table public.photo_access (
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  via text not null check (via in ('creator', 'invite', 'request')),
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

-- ───────────────────────── helpers
create or replace function public.is_participant(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from cuts where photo_id = p and user_id = auth.uid())
$$;

create or replace function public.has_access(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from photo_access where photo_id = p and user_id = auth.uid())
      or exists (select 1 from cuts where photo_id = p and user_id = auth.uid())
$$;

create or replace function public.my_space_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from spaces where owner_id = auth.uid()
$$;

-- 공개 범위:
--   participants → 참여자(+입장 자격자)만
--   link         → 링크(photo id)를 아는 사람. RLS로는 "id를 알고 조회"를 구분할 수 없으므로
--                  목록 조회(게시판)는 board_pins 경유로만 허용하고, 단건 조회는 허용한다.
--   public       → 누구나
create or replace function public.can_view_photo(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from photos ph
    where ph.id = p
      and (ph.visibility in ('link', 'public') or public.has_access(p))
  )
$$;

-- ───────────────────────── RLS
alter table public.users enable row level security;
alter table public.spaces enable row level security;
alter table public.photos enable row level security;
alter table public.cuts enable row level security;
alter table public.join_requests enable row level security;
alter table public.comments enable row level security;
alter table public.board_pins enable row level security;
alter table public.slot_holds enable row level security;
alter table public.photo_access enable row level security;

-- users: 닉네임은 공개, 본인만 생성·수정
create policy users_read on public.users for select using (true);
create policy users_insert on public.users for insert with check (id = auth.uid());
create policy users_update on public.users for update using (id = auth.uid());

-- spaces: 공개(스페이스 URL로 들어올 수 있어야 함), 본인만 생성
create policy spaces_read on public.spaces for select using (true);
create policy spaces_insert on public.spaces for insert with check (owner_id = auth.uid());

-- photos
create policy photos_read on public.photos for select using (public.can_view_photo(id));
-- 생성은 create_photo RPC로만. 만든 사람은 이름·레이아웃·공개 범위만 직접 수정 가능(아래 트리거로 컬럼 제한)
create policy photos_update on public.photos for update using (creator_id = auth.uid() and status = 'developing');

-- cuts: 사진을 볼 수 있으면 컷도 볼 수 있음. 본인 컷의 코멘트·이미지 교체(다시 찍기)만 직접 수정
create policy cuts_read on public.cuts for select using (public.can_view_photo(photo_id));
create policy cuts_update on public.cuts for update using (user_id = auth.uid());

-- join_requests: 요청자 본인 + 기존 참여자가 볼 수 있음
create policy jr_read on public.join_requests for select
  using (requester_id = auth.uid() or public.is_participant(photo_id));

-- comments: 사진을 볼 수 있으면 읽기, 참여자만 작성, 본인만 삭제
create policy comments_read on public.comments for select using (public.can_view_photo(photo_id));
create policy comments_insert on public.comments for insert
  with check (user_id = auth.uid() and public.is_participant(photo_id));
create policy comments_delete on public.comments for delete using (user_id = auth.uid());

-- board_pins: 볼 수 있는 사진의 핀만 읽기. 스페이스 주인만 위치·숨김 수정
create policy pins_read on public.board_pins for select using (public.can_view_photo(photo_id));
create policy pins_update on public.board_pins for update using (space_id = public.my_space_id());

create policy holds_read on public.slot_holds for select using (true);
create policy access_read on public.photo_access for select using (user_id = auth.uid());

-- photos 직접 수정 시 바꿀 수 있는 컬럼 제한
create or replace function public.photos_guard_update() returns trigger
language plpgsql as $$
begin
  if current_setting('app.rpc', true) = 'on' then
    return new; -- RPC 내부 변경은 통과
  end if;
  if new.creator_id <> old.creator_id or new.status <> old.status or new.invite_token <> old.invite_token
     or new.origin_space_id <> old.origin_space_id or new.printed_at is distinct from old.printed_at then
    raise exception 'photos: 이 컬럼은 직접 수정할 수 없습니다';
  end if;
  return new;
end $$;
create trigger photos_guard before update on public.photos for each row execute function public.photos_guard_update();

-- cuts 직접 수정 시 image/thumb/back_comment만 허용
create or replace function public.cuts_guard_update() returns trigger
language plpgsql as $$
begin
  if current_setting('app.rpc', true) = 'on' then return new; end if;
  if new.photo_id <> old.photo_id or new.user_id <> old.user_id or new.slot_index <> old.slot_index then
    raise exception 'cuts: 이 컬럼은 직접 수정할 수 없습니다';
  end if;
  if (select status from photos where id = old.photo_id) = 'printed' and new.image_path <> old.image_path then
    raise exception '인화 완료된 사진은 다시 찍을 수 없습니다';
  end if;
  return new;
end $$;
create trigger cuts_guard before update on public.cuts for each row execute function public.cuts_guard_update();

-- ───────────────────────── 레이아웃 자동 전환 (src/lib/layouts.ts 의 FAMILY_TIER 와 동일하게 유지)
create or replace function public.layout_tier(n int) returns int language sql immutable as $$
  select case when n <= 2 then 1 when n <= 4 then 2 when n <= 9 then 3 else 4 end
$$;

create or replace function public.resolve_layout(cur text, n int) returns text language plpgsql immutable as $$
declare
  fam text;
  t int := public.layout_tier(n);
  cur_t int;
begin
  select f, ti into fam, cur_t from (values
    ('strip-v','strip',1), ('strip-4','strip',2), ('film-2row','strip',3), ('contact-big','analog',4),
    ('side-2','grid',1), ('grid-2x2','grid',2), ('grid-3col','grid',3), ('id-sheet','grid',4),
    ('polaroid-2','analog',1), ('film-h','analog',2), ('contact','analog',3)
  ) as m(k, f, ti) where k = cur;
  if fam is null then fam := 'strip'; cur_t := 0; end if;
  if cur_t = t then return cur; end if;
  return case fam
    when 'strip'  then (array['strip-v','strip-4','film-2row','contact-big'])[t]
    when 'grid'   then (array['side-2','grid-2x2','grid-3col','id-sheet'])[t]
    else               (array['polaroid-2','film-h','contact','contact-big'])[t]
  end;
end $$;

-- 컷 수가 바뀌면: slot_index 재정렬 + 레이아웃 구간 전환
create or replace function public.reflow_photo(p uuid) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform set_config('app.rpc', 'on', true);
  with ordered as (
    select id, row_number() over (order by slot_index, created_at) - 1 as rn from cuts where photo_id = p
  )
  update cuts c set slot_index = o.rn from ordered o where c.id = o.id and c.slot_index <> o.rn;
  select count(*) into n from cuts where photo_id = p;
  update photos set layout_key = public.resolve_layout(layout_key, greatest(n, 1)) where id = p;
end $$;

-- 사진을 참여자 스페이스 게시판에 건다 (기존 사진들 근처에 자동 배치)
create or replace function public.pin_to_space(p uuid, s uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cnt int;
  cx real; cy real;
  ang real;
begin
  select count(*), coalesce(avg(x), 0), coalesce(avg(y), 0) into cnt, cx, cy from board_pins where space_id = s;
  ang := cnt * 2.39996; -- 황금각 나선으로 겹침 최소화
  insert into board_pins (space_id, photo_id, x, y, rotation, pin_type)
  values (s, p,
          cx + cos(ang) * (180 + sqrt(cnt) * 220),
          cy + sin(ang) * (180 + sqrt(cnt) * 220),
          (random() * 10 - 5)::real,
          (array['pushpin','tape','clip','magnet'])[1 + floor(random() * 4)::int])
  on conflict (space_id, photo_id) do nothing;
end $$;

-- ───────────────────────── RPC

-- 새 단체컷 만들기. friend_space가 있으면 그 친구 스페이스에도 건다(친구 자리는 빈자리로 표시)
create or replace function public.create_photo(p_title text, p_layout text, p_visibility text, p_origin_space uuid default null)
returns public.photos
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_space uuid := public.my_space_id();
  ph photos;
begin
  if me is null or my_space is null then raise exception '로그인이 필요합니다'; end if;
  insert into photos (title, creator_id, origin_space_id, layout_key, visibility)
  values (p_title, me, coalesce(p_origin_space, my_space), coalesce(p_layout, 'strip-v'), coalesce(p_visibility, 'link'))
  returning * into ph;
  insert into photo_access (photo_id, user_id, via) values (ph.id, me, 'creator');
  return ph;
end $$;

-- 초대 링크로 입장 자격 얻기
create or replace function public.redeem_invite(p uuid, token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from photos where id = p and invite_token = token and status = 'developing') then
    return false;
  end if;
  insert into photo_access (photo_id, user_id, via) values (p, auth.uid(), 'invite') on conflict do nothing;
  return true;
end $$;

-- "똑똑, 나도 끼워줘!"
create or replace function public.request_join(p uuid) returns public.join_requests
language plpgsql security definer set search_path = public as $$
declare r join_requests;
begin
  if not public.can_view_photo(p) then raise exception '볼 수 없는 사진입니다'; end if;
  if (select status from photos where id = p) <> 'developing' then raise exception '이미 인화가 끝났어요'; end if;
  if public.has_access(p) then raise exception '이미 참여 자격이 있어요'; end if;
  insert into join_requests (photo_id, requester_id) values (p, auth.uid())
  on conflict (photo_id, requester_id) where status = 'pending' do update set created_at = join_requests.created_at
  returning * into r;
  return r;
end $$;

-- 기존 참여자 누구나 수락/거절
create or replace function public.decide_join(req uuid, accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare r join_requests;
begin
  select * into r from join_requests where id = req for update;
  if r is null or r.status <> 'pending' then raise exception '처리할 수 없는 요청입니다'; end if;
  if not public.is_participant(r.photo_id) then raise exception '참여자만 수락할 수 있어요'; end if;
  update join_requests set status = case when accept then 'accepted' else 'rejected' end, decided_by = auth.uid() where id = req;
  if accept then
    insert into photo_access (photo_id, user_id, via) values (r.photo_id, r.requester_id, 'request') on conflict do nothing;
  end if;
end $$;

-- 부스 입장: 5분 자리 예약. 남은 자리 = 20 - (컷 수 + 유효한 다른 예약)
create or replace function public.hold_slot(p uuid) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  taken int;
  exp timestamptz := now() + interval '5 minutes';
begin
  if not public.has_access(p) then raise exception '참여 자격이 없어요'; end if;
  if (select status from photos where id = p for update) <> 'developing' then raise exception '이미 인화가 끝났어요'; end if;
  delete from slot_holds where expires_at < now();
  if exists (select 1 from cuts where photo_id = p and user_id = auth.uid()) then
    return exp; -- 다시 찍기: 이미 자리가 있음
  end if;
  select (select count(*) from cuts where photo_id = p)
       + (select count(*) from slot_holds where photo_id = p and user_id <> auth.uid()) into taken;
  if taken >= 20 then raise exception '자리가 다 찼어요 (최대 20명)'; end if;
  insert into slot_holds (photo_id, user_id, expires_at) values (p, auth.uid(), exp)
  on conflict (photo_id, user_id) do update set expires_at = excluded.expires_at;
  return exp;
end $$;

-- "이 컷으로 끼기": 이미지는 Storage(cuts/{photo}/{user}.ext)에 먼저 올린 뒤 호출
create or replace function public.commit_cut(p uuid, p_image text, p_thumb text, p_comment text default null)
returns public.cuts
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c cuts;
  next_slot int;
begin
  perform set_config('app.rpc', 'on', true);
  if (select status from photos where id = p for update) <> 'developing' then raise exception '이미 인화가 끝났어요'; end if;
  select * into c from cuts where photo_id = p and user_id = me;
  if found then
    update cuts set image_path = p_image, thumb_path = p_thumb, back_comment = coalesce(p_comment, back_comment)
    where id = c.id returning * into c;
    return c;
  end if;
  if not public.has_access(p) then raise exception '참여 자격이 없어요'; end if;
  if not exists (select 1 from slot_holds where photo_id = p and user_id = me and expires_at > now()) then
    raise exception '자리 예약 시간이 지났어요. 다시 입장해 주세요';
  end if;
  select coalesce(max(slot_index) + 1, 0) into next_slot from cuts where photo_id = p;
  insert into cuts (photo_id, user_id, image_path, thumb_path, slot_index, back_comment)
  values (p, me, p_image, p_thumb, next_slot, p_comment) returning * into c;
  delete from slot_holds where photo_id = p and user_id = me;
  -- 참여자 게시판에 걸기 (만든 사람 스페이스, origin 스페이스, 내 스페이스)
  perform public.pin_to_space(p, public.my_space_id());
  perform public.pin_to_space(p, (select origin_space_id from photos where id = p));
  perform public.pin_to_space(p, (select s.id from spaces s join photos ph on ph.creator_id = s.owner_id where ph.id = p));
  perform public.reflow_photo(p);
  return c;
end $$;

-- 사진에서 빠지기: 컷 삭제(Storage 파일은 클라이언트가 함께 삭제), 내 게시판 핀 제거, 레이아웃 재계산
create or replace function public.leave_photo(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from cuts where photo_id = p and user_id = auth.uid();
  delete from photo_access where photo_id = p and user_id = auth.uid();
  delete from board_pins where photo_id = p and space_id = public.my_space_id();
  perform public.reflow_photo(p);
  -- 남은 사람이 없으면 사진 삭제
  if not exists (select 1 from cuts where photo_id = p) then
    delete from photos where id = p;
  end if;
end $$;

-- 마감(인화 완료): 만든 사람만
create or replace function public.print_photo(p uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.rpc', 'on', true);
  update photos set status = 'printed', printed_at = now()
  where id = p and creator_id = auth.uid() and status = 'developing';
  if not found then raise exception '마감할 수 없어요'; end if;
  delete from slot_holds where photo_id = p;
  update join_requests set status = 'rejected' where photo_id = p and status = 'pending';
end $$;

-- 레이아웃 변경: 만든 사람, 현재 구간의 레이아웃만 (구간 검증은 resolve_layout으로)
create or replace function public.set_layout(p uuid, k text) returns void
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from cuts where photo_id = p;
  if public.resolve_layout(k, greatest(n, 1)) <> k then raise exception '현재 인원에 맞지 않는 레이아웃이에요'; end if;
  update photos set layout_key = k where id = p and creator_id = auth.uid();
end $$;

grant execute on all functions in schema public to authenticated;

-- ───────────────────────── Storage
-- 버킷: cuts (비공개). 경로 규칙: {photo_id}/{user_id}.{ext}, {photo_id}/{user_id}.thumb.{ext}
insert into storage.buckets (id, name, public) values ('cuts', 'cuts', false) on conflict do nothing;

create policy cuts_obj_read on storage.objects for select
  using (bucket_id = 'cuts' and public.can_view_photo(((storage.foldername(name))[1])::uuid));
create policy cuts_obj_write on storage.objects for insert
  with check (bucket_id = 'cuts' and split_part((storage.filename(name)), '.', 1) = auth.uid()::text
              and public.has_access(((storage.foldername(name))[1])::uuid));
create policy cuts_obj_update on storage.objects for update
  using (bucket_id = 'cuts' and split_part((storage.filename(name)), '.', 1) = auth.uid()::text);
create policy cuts_obj_delete on storage.objects for delete
  using (bucket_id = 'cuts' and split_part((storage.filename(name)), '.', 1) = auth.uid()::text);

-- 실시간 동기화(참여자 게시판 자동 갱신)
alter publication supabase_realtime add table public.photos, public.cuts, public.board_pins, public.join_requests;
