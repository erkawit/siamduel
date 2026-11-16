-- สยามมินทร์ดูเอล · ส่วนเพิ่ม: แอดมินเสกโกลด์ให้ผู้เล่น และตั้งโกลด์เริ่มต้นของบัญชีใหม่ (รันครั้งเดียวใน SQL Editor)
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
