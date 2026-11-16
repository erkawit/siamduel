-- สยามมินทร์ดูเอล · ส่วนเพิ่ม: รางวัลบทเรียน 8 บท (รันครั้งเดียวใน SQL Editor หลัง schema.sql)
alter table public.profiles add column if not exists tutorial integer[] not null default '{}';

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
