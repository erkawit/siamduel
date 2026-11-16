
-- ---------- สถิติการ์ดที่ออกจากระบบ สำหรับหน้าตู้สุ่ม ----------
-- คืนเฉพาะจำนวนรวมต่อระดับ (ไม่มีข้อมูลผู้ถือ) นับถึงเที่ยงคืนที่ผ่านมา (เวลาไทย) ไม่อัปเดตแบบเรียลไทม์
-- ระดับผู้สรรสร้างไม่ถูกส่งออกจากฟังก์ชันนี้เลย (หน้าตู้ปกติแสดงว่า "ไม่เปิดเผยจำนวน")
create or replace function public.card_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with t0 as (select date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok' as t),
  iss as (select c.rarity, x.card_id, count(*) n from cards x join card_catalog c using (card_id)
          where x.created_at < (select t from t0) and c.rarity <> 'creator' group by c.rarity, x.card_id),
  cat as (select rarity, count(*) kinds, sum(max_supply) maxs from card_catalog where rarity <> 'creator' group by rarity),
  agg as (select rarity, count(*) found, sum(n) issued from iss group by rarity)
  select jsonb_build_object(
    'asof', to_char((select t from t0) at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI'),
    'tiers', coalesce((select jsonb_object_agg(cat.rarity, jsonb_build_object('kinds', cat.kinds, 'max', cat.maxs,
               'found', coalesce(agg.found, 0), 'issued', coalesce(agg.issued, 0))) from cat left join agg using (rarity)), '{}'))
$$;
revoke execute on function public.card_stats() from anon, public;
grant execute on function public.card_stats() to authenticated;
