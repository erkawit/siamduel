-- =====================================================================
-- สยามมินทร์ดูเอล — ระบบ Dashboard Monitoring (หน้าแยก /monitor/)
-- รันหลัง schema.sql, 002_tutorial.sql, 003_admin_gold.sql
-- รันซ้ำได้ (ล้างสถิติการใช้โกลด์/กิจกรรมเดิม = เริ่มนับใหม่) · ถ้ารัน schema.sql ใหม่ ต้องรันไฟล์นี้ใหม่ด้วย
--
-- กฎความเป็นส่วนตัวของการ์ดระดับตำนานขึ้นไป (ตำนาน / พระเจ้า / ผู้สรรสร้าง):
--   * ไม่มีฟังก์ชันใดในไฟล์นี้คืนข้อมูลว่า "ใคร" ได้รับ/ถือการ์ดใบใด
--   * Dashboard เห็นได้เพียง "จำนวนการ์ดที่ออกจากระบบ" แยกตามระดับ นับถึงเที่ยงคืนที่ผ่านมา (เวลาไทย)
--     ไม่นับแบบเรียลไทม์ เพื่อไม่ให้จับคู่กับผู้ที่กำลังสุ่มอยู่ได้
--   * รายการเคลื่อนไหวของตู้สุ่มและตลาดกลาง แสดงแบบไม่ระบุชื่อผู้เล่น
--   * ตารางผู้เล่นไม่มีจำนวนครั้งสุ่ม ตัวนับการันตี หรือการ์ดในคลัง
-- =====================================================================

drop table if exists public.gold_ledger cascade;
drop table if exists public.player_activity cascade;

-- ---------- บันทึกการเปลี่ยนแปลงโกลด์ทุกครั้ง ----------
create table public.gold_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null,
  balance integer not null,
  reason text not null,
  at timestamptz not null default now()
);
create index on public.gold_ledger(at);
create index on public.gold_ledger(user_id, id);

-- ---------- กิจกรรมผู้เล่นรายวัน (ping ทุก ๑ นาทีขณะเปิดเกม) ----------
create table public.player_activity (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  first_at timestamptz not null default now(),
  last_at timestamptz not null default now(),
  pings integer not null default 1,
  screen text,
  primary key (user_id, day)
);
create index on public.player_activity(day);
create index on public.player_activity(last_at);

-- ไม่มี policy = อ่าน/เขียนจากเว็บโดยตรงไม่ได้ ต้องผ่านฟังก์ชันเท่านั้น
alter table public.gold_ledger enable row level security;
alter table public.player_activity enable row level security;

-- ---------- ทริกเกอร์บันทึกโกลด์ ----------
-- ระบุที่มาจากชื่อฟังก์ชัน RPC ที่เรียก (PostgREST ตั้งค่า request.path ให้อัตโนมัติ)
-- ฟังก์ชันอื่นในอนาคตตั้งเองได้ด้วย perform set_config('siamduel.reason','ชื่อเหตุผล',true);
create or replace function public.log_gold() returns trigger
language plpgsql security definer set search_path = public as $$
declare src text; r text; d integer;
begin
  if tg_op = 'INSERT' then
    d := new.gold; r := 'start';
  else
    d := new.gold - old.gold;
    if d = 0 then return new; end if;
    src := coalesce(nullif(current_setting('siamduel.reason', true), ''),
                    substring(coalesce(current_setting('request.path', true), '') from '/rpc/([a-z0-9_]+)'));
    r := case src
      when 'gacha_pull'       then 'gacha'
      when 'gacha_event_pull' then 'event'
      when 'market_buy'       then case when d < 0 then 'market_buy' else 'market_sell' end
      when 'tutorial_claim'   then 'tutorial'
      when 'admin_give_gold'  then 'admin'
      when 'admin_add_gold'   then 'admin'
      else coalesce(src, 'other') end;
  end if;
  insert into gold_ledger(user_id, delta, balance, reason) values (new.id, d, new.gold, r);
  return new;
end $$;

drop trigger if exists gold_ledger_ins on public.profiles;
drop trigger if exists gold_ledger_upd on public.profiles;
create trigger gold_ledger_ins after insert on public.profiles for each row execute function public.log_gold();
create trigger gold_ledger_upd after update of gold on public.profiles for each row
  when (old.gold is distinct from new.gold) execute function public.log_gold();

-- ยอดคงเหลือตั้งต้นของผู้เล่นที่มีอยู่แล้ว (delta = 0 ไม่นับเป็นโกลด์ที่ถูกสร้าง)
insert into public.gold_ledger(user_id, delta, balance, reason) select id, 0, gold, 'opening' from public.profiles;

-- ---------- ผู้เล่นส่งสัญญาณว่ายังเล่นอยู่ ----------
create or replace function public.player_ping(p_screen text default null) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Bangkok')::date;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then return; end if;
  insert into player_activity(user_id, day, screen) values (auth.uid(), d, left(p_screen, 20))
  on conflict (user_id, day) do update
    set last_at = now(), screen = excluded.screen,
        pings = player_activity.pings + case when player_activity.last_at < now() - interval '45 seconds' then 1 else 0 end;
end $$;

-- ---------- สถิติทั้งหมดสำหรับหน้า Monitor ----------
create or replace function public.admin_monitor() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  tz constant text := 'Asia/Bangkok';
  t0 timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;   -- เที่ยงคืนวันนี้ (เวลาไทย)
  hr timestamptz := date_trunc('hour', now());
  hi constant text[] := array['legend','divine','creator'];
  j_users jsonb; j_days jsonb; j_gold jsonb; j_reason jsonb; j_hours jsonb; j_gacha jsonb;
  j_cards jsonb; j_market jsonb; j_players jsonb; j_feed jsonb; j_cfg jsonb;
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;

  with last_seen as (select user_id, max(last_at) seen from player_activity group by user_id)
  select jsonb_build_object(
    'total',    count(*),
    'today',    count(*) filter (where p.created_at >= t0),
    'd7',       count(*) filter (where p.created_at >= t0 - interval '6 days'),
    'd30',      count(*) filter (where p.created_at >= t0 - interval '29 days'),
    'm5',       count(*) filter (where l.seen >= now() - interval '5 minutes'),
    'm15',      count(*) filter (where l.seen >= now() - interval '15 minutes'),
    'h24',      count(*) filter (where l.seen >= now() - interval '24 hours'),
    'never',    count(*) filter (where l.seen is null),
    'male',     count(*) filter (where p.gender = 'male'),
    'female',   count(*) filter (where p.gender = 'female'),
    'nogender', count(*) filter (where p.gender is null),
    'tut_any',  count(*) filter (where cardinality(p.tutorial) > 0),
    'tut_all',  count(*) filter (where cardinality(p.tutorial) >= 8),
    'decks',    count(*) filter (where jsonb_array_length(p.decks) > 0),
    'admins',   (select count(*) from admins)
  ) into j_users
  from profiles p left join last_seen l on l.user_id = p.id;

  -- รายวัน ๓๐ วัน: สมัครใหม่ / ผู้เล่นที่เข้าเกม / นาทีเล่นรวม / โกลด์เข้า-ออก
  select jsonb_agg(jsonb_build_object(
      'd',    to_char(d at time zone tz, 'YYYY-MM-DD'),
      'reg',  (select count(*) from profiles where created_at >= d and created_at < d + interval '1 day'),
      'dau',  (select count(*) from player_activity where day = (d at time zone tz)::date),
      'mins', (select coalesce(sum(pings), 0) from player_activity where day = (d at time zone tz)::date),
      'gin',  (select coalesce(sum(delta), 0) from gold_ledger where delta > 0 and at >= d and at < d + interval '1 day'),
      'gout', (select coalesce(-sum(delta), 0) from gold_ledger where delta < 0 and at >= d and at < d + interval '1 day')
    ) order by d) into j_days
  from generate_series(t0 - interval '29 days', t0, interval '1 day') d;

  -- รายชั่วโมง ๒๔ ชั่วโมงล่าสุด
  select jsonb_agg(jsonb_build_object(
      'h', to_char(h at time zone tz, 'HH24:00'),
      'in', coalesce(s.gin, 0), 'out', coalesce(s.gout, 0),
      'pulls', coalesce(s.pulls, 0), 'reg', coalesce(s.reg, 0), 'act', coalesce(s.act, 0)
    ) order by h) into j_hours
  from generate_series(hr - interval '23 hours', hr, interval '1 hour') h
  left join lateral (
    select sum(greatest(delta, 0)) gin, sum(greatest(-delta, 0)) gout,
           coalesce(sum(-delta) filter (where reason = 'gacha'), 0) / 100 pulls,
           (select count(*) from profiles where created_at >= h and created_at < h + interval '1 hour') reg,
           (select count(*) from player_activity where last_at >= h and first_at < h + interval '1 hour') act
    from gold_ledger where at >= h and at < h + interval '1 hour') s on true;

  -- โกลด์แยกตามที่มา
  select coalesce(jsonb_agg(to_jsonb(x) order by x.gout desc, x.gin desc), '[]') into j_reason from (
    select reason,
      coalesce(sum(delta) filter (where delta > 0), 0)                 gin,
      coalesce(-sum(delta) filter (where delta < 0), 0)                gout,
      count(*) filter (where delta <> 0)                               n,
      coalesce(sum(delta) filter (where delta > 0 and at >= t0), 0)    tin,
      coalesce(-sum(delta) filter (where delta < 0 and at >= t0), 0)   tout,
      count(*) filter (where delta <> 0 and at >= t0)                  tn,
      count(distinct user_id) filter (where delta <> 0)                users
    from gold_ledger where reason <> 'opening' group by reason) x;

  select jsonb_build_object(
    'circulating', coalesce(sum(gold), 0),
    'avg',         coalesce(round(avg(gold)), 0),
    'median',      coalesce(percentile_cont(0.5) within group (order by gold), 0),
    'zero',        count(*) filter (where gold = 0),
    'b_lt1k',      count(*) filter (where gold < 1000),
    'b_1k_10k',    count(*) filter (where gold >= 1000 and gold < 10000),
    'b_10k_50k',   count(*) filter (where gold >= 10000 and gold < 50000),
    'b_50k_200k',  count(*) filter (where gold >= 50000 and gold < 200000),
    'b_200k',      count(*) filter (where gold >= 200000),
    'minted',      (select coalesce(sum(delta), 0) from gold_ledger where delta > 0),
    'burned',      (select coalesce(-sum(delta), 0) from gold_ledger where delta < 0),
    'today_in',    (select coalesce(sum(delta), 0) from gold_ledger where delta > 0 and at >= t0),
    'today_out',   (select coalesce(-sum(delta), 0) from gold_ledger where delta < 0 and at >= t0),
    'since',       (select min(at) from gold_ledger)
  ) into j_gold from profiles;

  select jsonb_build_object(
    'pulls',         coalesce(sum(-delta) filter (where reason = 'gacha'), 0) / 100,
    'pulls_today',   coalesce(sum(-delta) filter (where reason = 'gacha' and at >= t0), 0) / 100,
    'x10',           count(*) filter (where reason = 'gacha' and delta = -1000),
    'x1',            count(*) filter (where reason = 'gacha' and delta = -100),
    'pullers',       count(distinct user_id) filter (where reason = 'gacha'),
    'pullers_today', count(distinct user_id) filter (where reason = 'gacha' and at >= t0),
    'event',         count(*) filter (where reason = 'event'),
    'event_today',   count(*) filter (where reason = 'event' and at >= t0),
    'lifetime',      (select coalesce(sum(pulls), 0) from profiles)
  ) into j_gacha from gold_ledger;

  -- การ์ดที่ออกจากระบบ แยกระดับ — นับถึงเที่ยงคืนวันนี้เท่านั้น (ไม่เรียลไทม์) และไม่มีข้อมูลรายคน
  select jsonb_build_object(
    'asof', to_char(t0 at time zone tz, 'YYYY-MM-DD HH24:MI'),
    'tiers', coalesce((select jsonb_object_agg(rarity, n) from (
        select c.rarity, count(*) n from cards x join card_catalog c using (card_id)
        where x.created_at < t0 group by c.rarity) s), '{}'),
    'high', (select count(*) from cards x join card_catalog c using (card_id)
             where x.created_at < t0 and c.rarity = any(hi))
  ) into j_cards;

  select jsonb_build_object(
    'open',         count(*) filter (where status = 'open'),
    'open_npc',     count(*) filter (where status = 'open' and seller is null),
    'open_player',  count(*) filter (where status = 'open' and seller is not null),
    'sold',         count(*) filter (where status = 'sold'),
    'sold_today',   count(*) filter (where status = 'sold' and sold_at >= t0),
    'sold_npc',     count(*) filter (where status = 'sold' and seller is null),
    'sold_p2p',     count(*) filter (where status = 'sold' and seller is not null),
    'cancelled',    count(*) filter (where status = 'cancelled'),
    'volume',       coalesce(sum(price) filter (where status = 'sold'), 0),
    'volume_today', coalesce(sum(price) filter (where status = 'sold' and sold_at >= t0), 0),
    'npc_sales',    coalesce(sum(price) filter (where status = 'sold' and seller is null), 0),
    'fee',          coalesce(sum(floor(price * 0.05)) filter (where status = 'sold' and seller is not null), 0),
    'listed_today', count(*) filter (where created_at >= t0 and seller is not null)
  ) into j_market from market_listings;

  -- ผู้เล่น (ไม่มีการ์ด ไม่มีจำนวนสุ่ม ไม่มีตัวนับการันตี)
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]') into j_players from (
    select p.username, p.name, p.gold, p.created_at,
      (select max(last_at) from player_activity a where a.user_id = p.id)  last_seen,
      (select count(*) from player_activity a where a.user_id = p.id)      days,
      (select coalesce(sum(pings), 0) from player_activity a where a.user_id = p.id) mins,
      (select coalesce(sum(delta), 0) from gold_ledger g where g.user_id = p.id and delta > 0) gin,
      (select coalesce(-sum(delta), 0) from gold_ledger g where g.user_id = p.id and delta < 0) gout,
      exists (select 1 from admins a where a.user_id = p.id) is_admin
    from profiles p order by p.created_at desc limit 500) x;

  -- ความเคลื่อนไหวล่าสุด: ตู้สุ่ม/ตลาดกลาง ไม่ระบุชื่อ
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc), '[]') into j_feed from (
    select g.id, g.at, g.reason, g.delta,
      case when g.reason in ('start', 'admin', 'tutorial') then p.username end username
    from gold_ledger g left join profiles p on p.id = g.user_id
    where g.reason <> 'opening' order by g.id desc limit 60) x;

  select jsonb_build_object(
    'start_gold', (select value from game_config where key = 'start_gold'),
    'event',      (select value - 'card_id' from game_config where key = 'event'),
    'threshold',  (select value from game_config where key = 'threshold')
  ) into j_cfg;

  return jsonb_build_object('now', now(), 'users', j_users, 'days', j_days, 'hours', j_hours,
    'gold', j_gold, 'reasons', j_reason, 'gacha', j_gacha, 'cards', j_cards, 'market', j_market,
    'players', j_players, 'feed', j_feed, 'config', j_cfg);
end $$;

revoke execute on function public.log_gold() from anon, public, authenticated;
revoke execute on function public.player_ping(text), public.admin_monitor() from anon, public;
grant execute on function public.player_ping(text), public.admin_monitor() to authenticated;
