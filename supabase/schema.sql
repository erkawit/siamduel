-- =====================================================================
-- สยามมินทร์ดูเอล — ฐานข้อมูลช่วง CBT (Supabase)
-- วิธีใช้: Supabase → SQL Editor → New query → วางทั้งไฟล์ → Run
-- รันซ้ำได้ (ลบของเดิมแล้วสร้างใหม่ = รีเซตข้อมูล CBT ทั้งหมด ยกเว้นบัญชีล็อกอิน)
-- =====================================================================

drop table if exists public.market_listings cascade;
drop table if exists public.cards cascade;
drop table if exists public.news cascade;
drop table if exists public.card_supply cascade;
drop table if exists public.card_catalog cascade;
drop table if exists public.game_config cascade;
drop table if exists public.admins cascade;
drop table if exists public.profiles cascade;

-- ---------- ตาราง ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  name text not null default '',
  gender text check (gender in ('male','female')),
  gold integer not null default 20000 check (gold >= 0),
  merit integer not null default 0,
  pulls integer not null default 0,
  since_legend integer not null default 0,
  decks jsonb not null default '[]'::jsonb,
  guide jsonb not null default '{}'::jsonb,
  tutorial integer[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.admins (user_id uuid primary key references auth.users(id) on delete cascade);

create table public.card_catalog (
  card_id text primary key,
  name_th text not null,
  rarity text not null,
  max_supply integer
);

create table public.card_supply (card_id text primary key references public.card_catalog, minted integer not null default 0);

create table public.cards (
  id bigserial primary key,
  owner uuid not null references public.profiles(id) on delete cascade,
  card_id text not null references public.card_catalog,
  serial text,
  listed boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.cards(owner);

create table public.market_listings (
  id bigserial primary key,
  seller uuid references public.profiles(id) on delete cascade,  -- null = พ่อค้า NPC
  seller_name text,
  card_row bigint references public.cards(id) on delete cascade,
  card_id text not null references public.card_catalog,
  serial text,
  price integer not null check (price between 10 and 100000000),
  status text not null default 'open' check (status in ('open','sold','cancelled')),
  buyer uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  sold_at timestamptz
);
create index on public.market_listings(status);

create table public.news (
  id bigserial primary key,
  kind text not null default 'info',
  text text not null,
  created_at timestamptz not null default now()
);

create table public.game_config (key text primary key, value jsonb not null);
insert into public.game_config values
  ('event', '{"open":false,"card_id":"SD001","name":"เทศกาลลอยกระทง"}'),
  ('threshold', '10000');

-- ---------- สิทธิ์ (RLS) ----------
alter table public.profiles enable row level security;
alter table public.admins enable row level security;
alter table public.card_catalog enable row level security;
alter table public.card_supply enable row level security;
alter table public.cards enable row level security;
alter table public.market_listings enable row level security;
alter table public.news enable row level security;
alter table public.game_config enable row level security;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (name, gender, decks, guide) on public.profiles to authenticated;

create policy "catalog read" on public.card_catalog for select using (true);
create policy "supply read" on public.card_supply for select using (true);
create policy "own cards read" on public.cards for select to authenticated using (owner = auth.uid());
create policy "market read" on public.market_listings for select to authenticated using (status = 'open' or seller = auth.uid() or buyer = auth.uid());
create policy "news read" on public.news for select using (true);
create policy "config read" on public.game_config for select using (true);
-- ตาราง admins ไม่มี policy = อ่าน/เขียนจากเว็บไม่ได้

-- ---------- สร้างโปรไฟล์อัตโนมัติเมื่อสมัคร ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username) values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- บัญชีที่สมัครไว้ก่อนรันไฟล์นี้
insert into public.profiles (id, username)
  select id, coalesce(raw_user_meta_data->>'username', split_part(email,'@',1)) from auth.users
  on conflict do nothing;

-- ---------- ตัวช่วย ----------
create or replace function public.th_num(n integer) returns text language sql immutable as $$
  select translate(n::text, '0123456789', '๐๑๒๓๔๕๖๗๘๙') $$;
create or replace function public.tier_th(r text) returns text language sql immutable as $$
  select case r when 'common' then 'ธรรมดา' when 'standard' then 'ทั่วไป' when 'rare' then 'หายาก' when 'epic' then 'มหากาพย์'
    when 'legend' then 'ตำนาน' when 'divine' then 'พระเจ้า' when 'creator' then 'ผู้สรรสร้าง' end $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid()) $$;

-- ---------- ตู้สุ่มปกติ ----------
create or replace function public.gacha_pull(n integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p profiles%rowtype; cost integer; i integer; x numeric; boost numeric; tier text;
  pick text; ser text; sup integer; newrow bigint; out jsonb := '[]'::jsonb; nm text;
begin
  if n not in (1,10) then raise exception 'จำนวนครั้งไม่ถูกต้อง'; end if;
  cost := case when n = 1 then 100 else 1000 end;
  select * into p from profiles where id = auth.uid() for update;
  if not found then raise exception 'ไม่พบผู้เล่น'; end if;
  if p.gold < cost then raise exception 'โกลด์ไม่พอ'; end if;
  p.gold := p.gold - cost;
  for i in 1..n loop
    p.pulls := p.pulls + 1; p.merit := p.merit + 1; p.since_legend := p.since_legend + 1;
    if p.since_legend >= 200 then tier := 'legend';
    else
      boost := greatest(0, p.since_legend - 149) * 0.5;
      x := random() * 100;
      tier := case
        when x < 0.001 then 'divine'
        when x < 0.001 + 1 + boost then 'legend'
        when x < 0.001 + 1 + boost + 2.89 then 'epic'
        when x < 0.001 + 1 + boost + 2.89 + 9 then 'rare'
        when x < 0.001 + 1 + boost + 2.89 + 9 + 27 then 'standard'
        else 'common' end;
    end if;
    ser := null;
    if tier = 'divine' then
      select c.card_id into pick from card_catalog c join card_supply s using (card_id)
        where c.rarity = 'divine' and s.minted < c.max_supply order by random() limit 1 for update of s;
      if pick is null then tier := 'legend';
      else
        update card_supply set minted = minted + 1 where card_id = pick returning minted into sup;
        ser := th_num(sup) || '/' || th_num(3);
        select name_th into nm from card_catalog where card_id = pick;
        insert into news(kind, text) values ('divine', 'ประกาศ: การ์ด ' || nm || ' ระดับพระเจ้า ' || ser || ' ถูกค้นพบแล้ว');
      end if;
    end if;
    if tier <> 'divine' then
      select card_id into pick from card_catalog where rarity = tier order by random() limit 1;
    end if;
    if tier in ('legend','divine') then p.since_legend := 0; end if;
    insert into cards(owner, card_id, serial) values (p.id, pick, ser) returning id into newrow;
    out := out || jsonb_build_object('row', newrow, 'id', pick, 'serial', ser);
  end loop;
  update profiles set gold = p.gold, pulls = p.pulls, merit = p.merit, since_legend = p.since_legend where id = p.id;
  return jsonb_build_object('gold', p.gold, 'pulls', p.pulls, 'merit', p.merit, 'since_legend', p.since_legend, 'cards', out);
end $$;

-- ---------- ตู้ผู้สรรสร้าง ----------
create or replace function public.gacha_event_pull() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles%rowtype; ev jsonb; th integer; m integer; nm text; newrow bigint; won boolean := false;
begin
  select value into ev from game_config where key = 'event';
  select value::text::integer into th from game_config where key = 'threshold';
  if not coalesce((ev->>'open')::boolean, false) then raise exception 'ตู้ผู้สรรสร้างยังไม่เปิด'; end if;
  select * into p from profiles where id = auth.uid() for update;
  if p.pulls < th then raise exception 'ยังสุ่มตู้ปกติไม่ครบตามเกณฑ์'; end if;
  if p.gold < 5000 then raise exception 'โกลด์ไม่พอ'; end if;
  select minted into m from card_supply where card_id = ev->>'card_id' for update;
  if m >= 1 then raise exception 'การ์ดใบนี้มีผู้ได้รับไปแล้ว'; end if;
  update profiles set gold = gold - 5000 where id = p.id;
  if random() < 0.005 then
    won := true;
    update card_supply set minted = 1 where card_id = ev->>'card_id';
    insert into cards(owner, card_id, serial) values (p.id, ev->>'card_id', '๑/๑') returning id into newrow;
    select name_th into nm from card_catalog where card_id = ev->>'card_id';
    insert into news(kind, text) values ('creator', 'การ์ด ' || nm || ' ระดับผู้สรรสร้าง มีผู้ได้รับไปดูแลต่อแล้ว');
    update game_config set value = jsonb_set(value, '{open}', 'false') where key = 'event';
  end if;
  return jsonb_build_object('won', won, 'gold', p.gold - 5000, 'row', newrow, 'id', ev->>'card_id');
end $$;

-- ---------- ตลาดกลาง ----------
create or replace function public.market_list(p_card_row bigint, p_price integer) returns bigint
language plpgsql security definer set search_path = public as $$
declare c cards%rowtype; r text; nm text; lid bigint;
begin
  select * into c from cards where id = p_card_row and owner = auth.uid() for update;
  if not found then raise exception 'ไม่พบการ์ดใบนี้ในคลังของคุณ'; end if;
  if c.listed then raise exception 'การ์ดใบนี้ลงขายอยู่แล้ว'; end if;
  if p_price < 10 then raise exception 'ราคาต่ำสุด 10 โกลด์'; end if;
  update cards set listed = true where id = c.id;
  insert into market_listings(seller, card_row, card_id, serial, price) values (c.owner, c.id, c.card_id, c.serial, p_price) returning id into lid;
  select rarity, name_th into r, nm from card_catalog where card_id = c.card_id;
  if r in ('divine','creator') then
    insert into news(kind, text) values (r, 'ประกาศทั้งเซิร์ฟเวอร์: การ์ด ' || nm || ' ระดับ' || tier_th(r) || coalesce(' ' || c.serial, '') || ' ถูกวางขายในตลาดกลาง');
  end if;
  return lid;
end $$;

create or replace function public.market_cancel(p_listing bigint) returns void
language plpgsql security definer set search_path = public as $$
declare l market_listings%rowtype;
begin
  select * into l from market_listings where id = p_listing and seller = auth.uid() and status = 'open' for update;
  if not found then raise exception 'ไม่พบรายการขายนี้'; end if;
  update market_listings set status = 'cancelled' where id = l.id;
  update cards set listed = false where id = l.card_row;
end $$;

create or replace function public.market_buy(p_listing bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l market_listings%rowtype; g integer; r text; nm text; fee integer; newrow bigint;
begin
  select * into l from market_listings where id = p_listing and status = 'open' for update;
  if not found then raise exception 'รายการนี้ถูกขายหรือยกเลิกไปแล้ว'; end if;
  if l.seller = auth.uid() then raise exception 'ซื้อการ์ดของตัวเองไม่ได้'; end if;
  select gold into g from profiles where id = auth.uid() for update;
  if g < l.price then raise exception 'โกลด์ไม่พอ'; end if;
  fee := floor(l.price * 0.05);
  update profiles set gold = gold - l.price where id = auth.uid();
  if l.seller is not null then
    update profiles set gold = gold + l.price - fee where id = l.seller;
    update cards set owner = auth.uid(), listed = false where id = l.card_row returning id into newrow;
  else
    insert into cards(owner, card_id, serial) values (auth.uid(), l.card_id, l.serial) returning id into newrow;
  end if;
  update market_listings set status = 'sold', buyer = auth.uid(), sold_at = now() where id = l.id;
  select rarity, name_th into r, nm from card_catalog where card_id = l.card_id;
  if r in ('divine','creator') then
    insert into news(kind, text) values (r, 'การ์ด ' || nm || ' ระดับ' || tier_th(r) || coalesce(' ' || l.serial, '') || ' มีผู้ได้รับไปดูแลต่อแล้ว');
  else
    insert into news(kind, text) values ('market', 'มีผู้ซื้อ ' || nm || ' (' || tier_th(r) || ') ราคา ' || to_char(l.price, 'FM999,999,999') || ' โกลด์');
  end if;
  -- พ่อค้า NPC เติมของเมื่อเหลือน้อย
  if (select count(*) from market_listings where status = 'open' and seller is null) < 10 then perform seed_market(8); end if;
  return jsonb_build_object('gold', g - l.price, 'row', newrow, 'id', l.card_id, 'serial', l.serial);
end $$;

-- ---------- แอดมิน ----------
create or replace function public.admin_set_event(p_open boolean, p_card text, p_name text, p_threshold integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  if p_open and exists (select 1 from card_supply where card_id = p_card and minted >= 1) then raise exception 'การ์ดใบนี้มีเจ้าของแล้ว'; end if;
  update game_config set value = jsonb_build_object('open', p_open, 'card_id', p_card, 'name', p_name) where key = 'event';
  update game_config set value = to_jsonb(greatest(1, p_threshold)) where key = 'threshold';
  if p_open then insert into news(kind, text) values ('event', 'ตู้ผู้สรรสร้างเปิดแล้ว: ' || p_name); end if;
end $$;

create or replace function public.admin_add_gold(p_amount integer) returns integer
language plpgsql security definer set search_path = public as $$
declare g integer;
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  update profiles set gold = gold + p_amount where id = auth.uid() returning gold into g;
  return g;
end $$;

create or replace function public.seed_market(p_n integer) returns integer
language plpgsql security definer set search_path = public as $$
declare i integer; t text; c record;
  npc text[] := array['พ่อค้าเรือสำเภา','แม่ค้าตลาดน้ำ','นายฮ้อยอีสาน','พรานป่าเมืองเหนือ','เถ้าแก่ท่าเตียน','ยายแก่หน้าวัด'];
begin
  for i in 1..p_n loop
    t := case when random() < .45 then 'common' when random() < .5 then 'standard' when random() < .6 then 'rare' when random() < .75 then 'epic' else 'legend' end;
    select card_id into c from card_catalog where rarity = t order by random() limit 1;
    insert into market_listings(seller, seller_name, card_id, price)
      values (null, npc[1 + floor(random()*array_length(npc,1))::int], c.card_id,
        (round(case t when 'common' then 50 when 'standard' then 120 when 'rare' then 400 when 'epic' then 1500 else 8000 end * (0.8 + random()*0.6) / 10) * 10)::int);
  end loop;
  return p_n;
end $$;

create or replace function public.admin_seed_market(p_n integer default 20) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  return seed_market(least(p_n, 100));
end $$;

-- อนุญาตให้ผู้ล็อกอินเรียกฟังก์ชัน
revoke execute on all functions in schema public from anon, public;
grant execute on function public.gacha_pull(integer), public.gacha_event_pull(), public.market_list(bigint,integer),
  public.market_cancel(bigint), public.market_buy(bigint), public.is_admin(),
  public.admin_set_event(boolean,text,text,integer), public.admin_add_gold(integer), public.admin_seed_market(integer) to authenticated;

-- ---------- รางวัลบทเรียน ----------
create or replace function public.tutorial_claim(p_ch integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles%rowtype; g integer := 0; r text; cid text; newrow bigint;
begin
  if p_ch < 1 or p_ch > 8 then raise exception 'ไม่มีบทเรียนนี้'; end if;
  select * into p from profiles where id = auth.uid() for update;
  if not found then raise exception 'ไม่พบผู้เล่น'; end if;
  if p_ch = any(p.tutorial) then raise exception 'รับรางวัลบทนี้ไปแล้ว'; end if;
  g := case p_ch when 1 then 500 when 2 then 500 when 4 then 1000 when 6 then 1000 when 7 then 1000 when 8 then 1000 else 0 end;
  r := case p_ch when 3 then 'rare' when 5 then 'epic' else null end;
  if r is not null then
    select card_id into cid from card_catalog where rarity = r order by random() limit 1;
    insert into cards(owner, card_id) values (p.id, cid) returning id into newrow;
  end if;
  update profiles set gold = gold + g, tutorial = array_append(tutorial, p_ch) where id = p.id returning gold into g;
  return jsonb_build_object('gold', g, 'card', case when cid is null then null else jsonb_build_object('row', newrow, 'id', cid) end);
end $$;
revoke execute on function public.tutorial_claim(integer) from anon, public;
grant execute on function public.tutorial_claim(integer) to authenticated;

-- ---------- แอดมินเสกโกลด์ / โกลด์เริ่มต้น ----------
insert into public.game_config values ('start_gold', '20000') on conflict (key) do nothing;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare g integer;
begin
  select value::text::integer into g from game_config where key = 'start_gold';
  insert into public.profiles (id, username, gold)
    values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), coalesce(g, 20000));
  return new;
end $$;

-- ให้โกลด์ผู้เล่นคนเดียว (p_username) หรือทุกคน (p_username = '*') · จำนวนติดลบ = หักออก (ไม่ต่ำกว่า 0)
create or replace function public.admin_give_gold(p_username text, p_amount integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n integer; g integer;
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  if p_amount = 0 or abs(p_amount) > 100000000 then raise exception 'จำนวนโกลด์ไม่ถูกต้อง'; end if;
  if p_username = '*' then
    update profiles set gold = greatest(0, gold + p_amount);
    get diagnostics n = row_count;
    if p_amount > 0 then insert into news(kind, text) values ('event', 'หมอผีเฒ่ามอบโกลด์ ' || to_char(p_amount, 'FM999,999,999') || ' ให้ผู้ทดสอบทุกคน'); end if;
    return jsonb_build_object('count', n);
  end if;
  update profiles set gold = greatest(0, gold + p_amount) where username = lower(p_username) returning gold into g;
  if not found then raise exception 'ไม่พบผู้เล่นชื่อผู้ใช้ %', p_username; end if;
  return jsonb_build_object('count', 1, 'gold', g);
end $$;

create or replace function public.admin_list_players() returns table(username text, name text, gold integer, pulls integer)
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  return query select p.username, p.name, p.gold, p.pulls from profiles p order by p.created_at desc limit 500;
end $$;

create or replace function public.admin_set_start_gold(p_amount integer) returns integer
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  if p_amount < 0 or p_amount > 100000000 then raise exception 'จำนวนโกลด์ไม่ถูกต้อง'; end if;
  insert into game_config values ('start_gold', to_jsonb(p_amount)) on conflict (key) do update set value = excluded.value;
  return p_amount;
end $$;

revoke execute on function public.admin_give_gold(text,integer), public.admin_list_players(), public.admin_set_start_gold(integer) from anon, public;
grant execute on function public.admin_give_gold(text,integer), public.admin_list_players(), public.admin_set_start_gold(integer) to authenticated;

-- ---------- เรียลไทม์ ----------
do $$ begin
  begin alter publication supabase_realtime add table public.news; exception when others then null; end;
  begin alter publication supabase_realtime add table public.game_config; exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when others then null; end;
end $$;

-- ---------- ข้อมูลการ์ด 100 ใบ ----------
insert into public.card_catalog (card_id, name_th, rarity, max_supply) values
('SD001','พระอิศวร','creator',1),
('SD002','พระนารายณ์','creator',1),
('SD003','พระพรหม','creator',1),
('SD004','PlayCH • วัชระสายฟ้าแยกฟ้า','creator',1),
('SD005','PlayCH • ปู่ผู้สร้างเกม ช่างปั้นวิญญาณ','creator',1),
('SD006','พระอินทร์','creator',1),
('SD007','PlayCH • ท้าวจตุรทิศจอยแดง','creator',1),
('SD008','PlayCH • ฤๅษีสี่มนตร์จอยคราม','creator',1),
('SD009','PlayCH • พรานเป้าเล็งมรณะ','creator',1),
('SD010','PlayCH • ศาลหมื่นวิญญาณ','creator',1),
('SD011','สมเด็จพระเจ้าตากสินมหาราช','epic',null),
('SD012','สมเด็จพระนเรศวรมหาราช','epic',null),
('SD013','ทศกัณฐ์','epic',null),
('SD014','พ่อขุนรามคำแหงมหาราช','epic',null),
('SD015','ปู่สังกะสา ย่าสังกะสี','divine',3),
('SD016','พระราหู','divine',3),
('SD017','ท้าวเวสสุวรรณ','divine',3),
('SD018','พญาครุฑ','legend',null),
('SD019','พญาศรีสุทโธนาค','legend',null),
('SD020','แม่นาคพระโขนง','epic',null),
('SD021','สมเด็จพระศรีสุริโยทัย','epic',null),
('SD022','พระแม่ธรณี','divine',3),
('SD023','กุมภกรรณ','epic',null),
('SD024','น้ำอมฤต','legend',null),
('SD025','สมเด็จพระเจ้าอู่ทอง','epic',null),
('SD026','ขุนแผนแสนสะท้าน','epic',null),
('SD027','พระอภัยมณี','epic',null),
('SD028','นางผีเสื้อสมุทร','epic',null),
('SD029','ช้างเอราวัณ','legend',null),
('SD030','ชาละวัน','epic',null),
('SD031','ท้าวสุรนารี (ย่าโม)','epic',null),
('SD032','พระยาพิชัยดาบหัก','epic',null),
('SD033','ท้าวเทพกระษัตรี และท้าวศรีสุนทร','epic',null),
('SD034','หนุมาน','legend',null),
('SD035','ไกรสรราชสีห์','legend',null),
('SD036','ดาบฟ้าฟื้น','epic',null),
('SD037','เปรตยักษ์','rare',null),
('SD038','ควาญช้างศึก','rare',null),
('SD039','ปอบเจ้าแม่หมู่บ้าน','rare',null),
('SD040','กระสือร้อยปี','rare',null),
('SD041','นางไม้ตะเคียน','rare',null),
('SD042','ยาสังกรณีตรีชวา','rare',null),
('SD043','น้ำมันพราย','rare',null),
('SD044','ทหารดาบสองมือ','rare',null),
('SD045','หมอผีปราบวิญญาณ','rare',null),
('SD046','ฤๅษีตาไฟ','rare',null),
('SD047','เสือร้ายคาถาอาคม','rare',null),
('SD048','นางวันทอง','rare',null),
('SD049','พิธีบูชาราหู','rare',null),
('SD050','นักมวยคาดเชือก','rare',null),
('SD051','หมอยาว่านร้อยแปด','rare',null),
('SD052','พรานไพรหน้าไม้อาบยาง','rare',null),
('SD053','ผีพรายตายโหง','standard',null),
('SD054','คชสีห์','standard',null),
('SD055','ไกรทอง','standard',null),
('SD056','พลายงาม','standard',null),
('SD057','ผีตาโขน','standard',null),
('SD058','ผีกะ','standard',null),
('SD059','ผีตานี','standard',null),
('SD060','ผีโพง','standard',null),
('SD061','ผีกระหัง','standard',null),
('SD062','ผีบ้านผีเรือน','standard',null),
('SD063','กินรี','standard',null),
('SD064','ม้าสีหมอก','standard',null),
('SD065','เจ้าเงาะ (สังข์ทอง)','standard',null),
('SD066','ปลุกพราย','standard',null),
('SD067','หม้อดินขังผี','standard',null),
('SD068','น้ำมนต์ทิพย์','standard',null),
('SD069','กุมารทอง','standard',null),
('SD070','ยักษ์ทวารบาล','common',null),
('SD071','ไมยราพ','common',null),
('SD072','ปู่โสมเฝ้าทรัพย์','common',null),
('SD073','ผีแม่ม่าย','common',null),
('SD074','ยักษ์กุมภัณฑ์','common',null),
('SD075','นางสำมนักขา','common',null),
('SD076','วานรสิบแปดมงกุฎ','common',null),
('SD077','ขุนช้าง','common',null),
('SD078','ผีกองกอย','common',null),
('SD079','ผีโขมด','common',null),
('SD080','ผีพุ่งไต้','common',null),
('SD081','ผีพรายน้ำ','common',null),
('SD082','นาคบริวาร','common',null),
('SD083','ศรีธนญชัย','common',null),
('SD084','ตะกรุดโทน','common',null),
('SD085','ผ้ายันต์','common',null),
('SD086','หนามพุทรา','common',null),
('SD087','ผีปะกำ','common',null),
('SD088','ผีโป่ง','common',null),
('SD089','ผีนางรำ','common',null),
('SD090','ชาวบ้านบางระจัน','common',null),
('SD091','นายขนมต้ม','common',null),
('SD092','ทหารหน้าไม้','common',null),
('SD093','สิงห์หิมพานต์','common',null),
('SD094','เปรตน้อย','common',null),
('SD095','แม่ซื้อ','common',null),
('SD096','ผีตาแฮก','common',null),
('SD097','ไพร่พลดาบ','common',null),
('SD098','สายสิญจน์','common',null),
('SD099','ใบหนาด','common',null),
('SD100','น้ำมนต์','common',null);

insert into public.card_supply (card_id) select card_id from public.card_catalog where rarity in ('divine','creator');

-- พ่อค้า NPC วางของในตลาดเริ่มต้น 30 รายการ
select public.seed_market(30);
insert into public.news(kind,text) values ('info','เปิดทดสอบ CBT สยามมินทร์ดูเอล ยินดีต้อนรับผู้กล้าทุกท่าน');
