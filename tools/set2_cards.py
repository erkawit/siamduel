"""การ์ดชุดที่ 2 (SD101–SD200) ระดับตำนานลงไป 100 ใบ
รัน: python tools/set2_cards.py
- เพิ่ม/อัปเดตการ์ดใน data/siam_duel_cards.json และ src/cards_min.json (รันซ้ำได้ ไม่ซ้ำซ้อน)
- สร้างภาพชั่วคราว game_assets/art/(thumb/)SD1xx.webp เฉพาะใบที่ยังไม่มีภาพ (มีภาพจริงแล้วจะไม่ทับ)
- เขียน docs/prompts/set2_art_prompts_1x1.csv สำหรับสร้างภาพจริง และ supabase/005_set2_cards.sql
ความสามารถทุกใบใช้คำสั่ง ability_code ที่เอนจินรองรับอยู่แล้วเท่านั้น (ตรวจด้วย node duel/selfplay.js)"""
import json, os, csv, math, random
from PIL import Image, ImageDraw, ImageFilter

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(R, *a)
TH = {'common': 'ธรรมดา', 'standard': 'ทั่วไป', 'rare': 'หายาก', 'epic': 'มหากาพย์', 'legend': 'ตำนาน'}
OLD = {'common': 'Common', 'standard': 'Uncommon', 'rare': 'Rare', 'epic': 'Epic', 'legend': 'Legendary'}

# ---------- ตัวช่วยเขียน ability_code ----------
def on(trig, *do, **kw): return dict({'on': trig, 'do': list(do)}, **kw)
def play(*do, **kw): return on('play', *do, **kw)
def dmg(t, n, **f): return {'damage': dict({'target': t, 'amount': n}, **({'filter': f} if f else {}))}
def heal(t, n, **f): return {'heal': dict({'target': t, 'amount': n}, **({'filter': f} if f else {}))}
def buff(t, a, h, dur='perm', **f): return {'buff': dict({'target': t, 'atk': a, 'hp': h, 'duration': dur}, **({'filter': f} if f else {}))}
def summon(tok, n=1, zone=None): return {'summon': dict({'token': tok, 'count': n}, **({'zone': zone} if zone else {}))}
def draw(n=1): return {'draw': {'count': n}}
def sleep(t, turns=1, count=None, **f): return {'sleep': dict({'target': t, 'turns': turns}, **({'count': count} if count else {}), **({'filter': f} if f else {}))}
def noatk(t, turns=1, count=None): return {'disable_attack': dict({'target': t, 'turns': turns}, **({'count': count} if count else {}))}
def seal(t, turns=1): return {'seal': {'target': t, 'turns': turns}}
def poison(t, n=1): return {'poison': {'target': t, 'amount': n}}
def destroy(t, **f): return {'destroy': dict({'target': t}, **({'filter': f} if f else {}))}
def grant(t, kws, dur='perm', **f): return {'grant': dict({'target': t, 'keywords': kws, 'duration': dur}, **({'filter': f} if f else {}))}
def cleanse(t): return {'cleanse': {'target': t}}
def reveal(n=1): return {'reveal_hand': {'count': n}}
def discard(n=1): return {'discard': {'side': 'enemy', 'count': n, 'random': True}}
def revive(**f): return {'revive': dict({'from': 'my_crypt', 'count': 1, 'pick': 'choose', 'hp': 'full'}, **({'filter': f} if f else {}))}
def steal(t, **f): return {'steal': dict({'target': t}, **({'filter': f} if f else {}))}
def equip(a=0, h=0, kws=None, rule=None):
    e = {'target': 'chosen_ally_unit', 'atk': a, 'hp': h}
    if kws: e['grant'] = kws
    if rule: e['rule'] = rule
    return play({'equip': e})
def aura(t, a=0, h=0, kws=None, rule=None, cond=None, **f):
    x = {'target': t}
    if a: x['atk'] = a
    if h: x['hp'] = h
    if kws: x['grant'] = kws
    if rule: x['rule'] = rule
    if f: x['filter'] = f
    if cond: x['if'] = cond
    return {'aura': x}
NOT_RULER = ['ผู้ปกครอง', 'เทพเจ้า']

# ---------- รายการการ์ด ----------
# (id, ชื่อไทย, ชื่ออังกฤษ, หมวด, เผ่า, ระดับ, ธาตุ, ประเภท, ต้นทุน, ATK, HP, คีย์เวิร์ด, ข้อความ, ability_code, คำบรรยายภาพ, ข้อความประกอบ)
U, S, A, T = 'ยูนิต', 'คาถา', 'ของขลัง', 'กับดัก'
CARDS = [
 # ===== ตำนาน 8 =====
 ('SD101','พระพิรุณ','Phra Pirun, God of Rain','เทพเจ้า','เทพ','legend','น้ำ',U,7,6,9,['เหาะเหิน'],
  'ปลุกเสก: ฝนห่าใหญ่ — ยูนิตเราทุกตัวฟื้น HP เต็ม และยูนิตไฟศัตรูทุกตัว -2 ATK ถาวร',
  [play(heal('all_ally_units','full'), buff('all_enemy_units',-2,0,element='ไฟ'))],
  'the Thai rain god Phra Pirun riding a giant naga through monsoon storm clouds, pouring rain from a golden vessel, deep blue and silver','ฝนแรกของปีมิได้ตกเพราะฟ้า แต่เพราะผู้ถือหม้อน้ำแห่งสวรรค์ยอมเปิดฝา'),
 ('SD102','พระเพลิง','Phra Phloeng, God of Fire','เทพเจ้า','เทพ','legend','ไฟ',U,7,8,6,['ฮึกเหิม'],
  'ปลุกเสก: 2 ดาเมจแก่ยูนิตศัตรูทุกตัว; ฆ่ายูนิตได้ 2 ดาเมจแก่ดวงชะตาศัตรู',
  [play(dmg('all_enemy_units',2)), on('kill', dmg('enemy_player',2))],
  'the Thai fire god Phra Phloeng riding a rhinoceros wreathed in flames, holding a flaming spear, molten orange and crimson','ไฟที่ชำระทุกสิ่ง ไม่เคยถามว่าสิ่งนั้นดีหรือร้าย'),
 ('SD103','พระพาย','Phra Phai, God of Wind','เทพเจ้า','เทพ','legend','ลม',U,6,6,6,['เหาะเหิน','ฮึกเหิม'],
  'ยูนิตลมฝ่ายเราตัวอื่น +1/+1 และได้เหาะเหิน',
  [aura('other_ally_units',1,1,['เหาะเหิน'],element='ลม')],
  'the Thai wind god Phra Phai riding a white horse across swirling clouds, flowing sashes and scarves, pale jade and white','ลมไม่มีรูป แต่ทุกธงในสนามรบรู้ว่าเขามาถึงแล้ว'),
 ('SD104','พญาอนันตนาคราช','Ananta Nagaraja','สัตว์หิมพานต์','หิมพานต์','legend','น้ำ',U,8,7,12,['ทวารบาล','คงกระพัน'],
  'ปลุกเสก: เรียกนาคบริวาร 2/2 สองตัว; ยูนิตน้ำฝ่ายเรารับดาเมจ -1',
  [play(summon('TK_NAGA',2)), aura('all_ally_units',rule='damage_taken_minus_1',element='น้ำ')],
  'Ananta the endless serpent king with seven hooded heads coiled beneath a cosmic ocean, emerald scales and gold crowns','บัลลังก์ของพระนารายณ์ทอดตัวอยู่ใต้ทะเลน้ำนม และมันไม่เคยหลับ'),
 ('SD105','สุวรรณหงส์','Suwan Hong, the Golden Swan','สัตว์หิมพานต์','หิมพานต์','legend','ลม',U,6,5,7,['เหาะเหิน','ฟื้นฟู'],
  'ต้นเทิร์น: ฟื้นดวงชะตา 2 และยูนิตเราทุกตัว +0/+1 ถาวร',
  [on('turn_start', heal('self_player',2), buff('all_ally_units',0,1))],
  'a radiant golden hamsa swan with a royal barge-like neck gliding over a moonlit lotus lake, gold leaf and soft violet mist','เมื่อหงส์ทองร่อนผ่าน บึงทั้งบึงก็เงียบเพื่อฟังเสียงปีก'),
 ('SD106','สมเด็จพระบรมไตรโลกนาถ','King Borommatrailokkanat','ผู้ปกครอง','มนุษย์','legend','ดิน',U,7,6,9,['ทวารบาล'],
  'ปลุกเสก: จตุสดมภ์ — จั่ว 2 ใบ; ยูนิตมนุษย์ฝ่ายเราตัวอื่น +1/+1',
  [play(draw(2)), aura('other_ally_units',1,1,tribe='มนุษย์')],
  'a dignified Ayutthaya king seated on a throne within a royal court of four ministers, scrolls of law, warm gold and ochre','บ้านเมืองตั้งมั่นได้เพราะเสาสี่ต้น และกษัตริย์ผู้รู้ว่าเสาใดต้องค้ำที่ใด'),
 ('SD107','นางมณีเมขลา','Mani Mekhala','เทพเจ้า','เทพ','legend','น้ำ',U,6,5,6,['เหาะเหิน','กำบัง'],
  'ปลุกเสก: ล่อแก้ว — ยูนิตศัตรู 2 ตัวหลับ 2 เทิร์น; ราหูอมจันทร์ +2/+2',
  [play(sleep('chosen_enemy_units',2,count=2)), on('rahu', buff('self',2,2,'rahu'))],
  'the sea goddess Mani Mekhala flying above stormy waves holding a glowing crystal orb that flashes lightning, teal and silver','แก้ววิเศษในมือนางส่องประกายเป็นสายฟ้า และไม่เคยตกอยู่ในมือใคร'),
 ('SD108','รามสูร','Ramasun, the Axe Giant','อสูร','อสูร','legend','ไฟ',U,7,9,7,['ฮึกเหิม','ลิ้มเลือด'],
  'ปลุกเสก: ขว้างขวาน — 4 ดาเมจแก่ยูนิตศัตรู 1 ตัว; ราหูอมจันทร์ +3 ATK',
  [play(dmg('chosen_enemy_unit',4)), on('rahu', buff('self',3,0,'rahu'))],
  'the giant Ramasun hurling a thunder axe across a dark stormy sky, green-skinned demon in golden armor, crimson lightning','เสียงฟ้าร้องคือเสียงขวานของเขาที่ยังตามหาแก้วดวงนั้นไม่พบ'),
 # ===== มหากาพย์ 14 =====
 ('SD109','สมเด็จพระนารายณ์มหาราช','King Narai the Great','ผู้ปกครอง','มนุษย์','epic','ลม',U,8,7,8,['ทวารบาล'],
  'ปลุกเสก: ราชทูต — จั่ว 1 ใบ และยูนิตศัตรู 2 ตัวโจมตีไม่ได้ 1 เทิร์น',
  [play(draw(1), noatk('chosen_enemy_units',1,count=2))],
  'a learned Ayutthaya king receiving foreign envoys in a palace hall at Lopburi, telescopes and maps, deep blue and gold','เมืองที่เปิดประตูรับโลก คือเมืองที่โลกต้องเกรงใจ'),
 ('SD110','พระมหาธรรมราชาลิไท','King Lithai','ผู้ปกครอง','มนุษย์','epic','อากาศ',U,7,5,9,['ฟื้นฟู'],
  'ปลุกเสก: ไตรภูมิ — ล้างคุณไสยและฟื้น HP เต็มยูนิตเราทุกตัว; ต้นเทิร์นฟื้นดวงชะตา 1',
  [play(cleanse('all_ally_units'), heal('all_ally_units','full')), on('turn_start', heal('self_player',1))],
  'a scholarly Sukhothai king writing the Traiphum cosmology on palm leaves, three worlds glowing behind him, soft gold and indigo','สวรรค์ มนุษย์ และนรก ถูกเขียนไว้ในใบลานไม่กี่ร้อยแผ่น'),
 ('SD111','พระนางจามเทวี','Queen Chamadevi','ผู้ปกครอง','มนุษย์','epic','ดิน',U,7,6,8,['ทวารบาล','คงกระพัน'],
  'ยูนิตเราข้างเคียง +1/+2; สิ้นใจ: ฟื้นดวงชะตา 5',
  [aura('adjacent_allies',1,2), on('death', heal('self_player',5))],
  'the founding queen of Hariphunchai standing before an ancient stupa with a war elephant behind her, earthen red and gold','นครหริภุญชัยถูกสร้างด้วยปัญญาของหญิงผู้หนึ่ง ไม่ใช่ด้วยดาบ'),
 ('SD112','ปู่เจ้าสมิงพราย','Pu Chao Saming Phrai','ผี','ผี','epic','ลม',U,7,7,7,['กำบัง','ราหูจร'],
  'สิ้นใจ: ศัตรูทิ้งไพ่สุ่ม 1 ใบ; ราหูอมจันทร์ ยูนิตผีฝ่ายเราทุกตัว +2 ATK',
  [on('death', discard(1)), on('rahu', buff('all_ally_units',2,0,'rahu',tribe='ผี'))],
  'an ancient forest hermit spirit half-transformed into a tiger, glowing eyes in a misty jungle, sacred threads and bones, dark green and amber','เสียงเรียกชื่อในป่าลึก อย่าขานตอบ ถ้าไม่แน่ใจว่าเป็นคน'),
 ('SD113','พระลอ','Phra Lo','วรรณคดี','มนุษย์','epic','น้ำ',U,6,6,7,['เมตตามหานิยม'],
  'ปลุกเสก: ขโมยยูนิตศัตรูต้นทุน ≤3 มาเป็นของเรา (ยกเว้นผู้ปกครองและเทพ)',
  [play(steal('chosen_enemy_unit',cost_lte=3,not_category=NOT_RULER))],
  'the handsome prince Phra Lo by a riverbank under a spell of enchanted betel, tragic romance, moonlit water, rose and silver','มนต์รักที่ปลุกเสกมาอย่างดี มักพาไปพบปลายทางที่ไม่มีใครอยากไปถึง'),
 ('SD114','อิเหนา','Inao','วรรณคดี','มนุษย์','epic','ลม',U,7,7,6,['ฮึกเหิม','กำบัง'],
  'โจมตีได้ 2 ครั้งต่อเทิร์น',
  [{'special':'extra_attack','attacks_per_turn':2}],
  'the Javanese-Thai hero prince Inao wielding a kris dagger in a dramatic leap, flowing silk and gold ornaments, sapphire and gold','เจ้าชายผู้เกิดมาพร้อมกริชในมือ และความรักที่ไม่ยอมฟังใคร'),
 ('SD115','นางมโนห์รา','Manohra','วรรณคดี','หิมพานต์','epic','ลม',U,6,5,6,['เหาะเหิน'],
  'ปลุกเสก: ยูนิตเราทุกตัวได้เหาะเหินและ +1 ATK เทิร์นนี้',
  [play(grant('all_ally_units',['เหาะเหิน'],'turn'), buff('all_ally_units',1,0,'turn'))],
  'the kinnari princess Manohra dancing with feathered wings and tail, taking flight from a lotus pond, rose gold and turquoise','ปีกที่ถูกยึดไป ย่อมกลับคืนแก่ผู้ที่ร่ายรำได้งามพอ'),
 ('SD116','พระสุธน','Phra Suthon','วรรณคดี','มนุษย์','epic','ไฟ',U,6,6,6,['ฮึกเหิม'],
  'มีนางมโนห์ราฝ่ายเรา +3/+3; ฆ่ายูนิตได้ จั่ว 1 ใบ',
  [aura('self',3,3,cond={'ally_name':'นางมโนห์รา'}), on('kill', draw(1))],
  'prince Suthon with a bow on a mountain path searching for his lost love, sunset fire and gold, determined gaze','ข้ามเจ็ดภูเขา เจ็ดแม่น้ำ เพื่อพิสูจน์ว่ารักไม่ใช่เพียงคำพูด'),
 ('SD117','ท้าววิรุฬหก','Thao Wirunhok','เทพเจ้า','เทพ','epic','ดิน',U,8,7,9,['ทวารบาล'],
  'ยูนิตเราตัวอื่นรับดาเมจ -1',
  [aura('other_ally_units',rule='damage_taken_minus_1')],
  'the guardian king of the south Thao Wirunhok in ornate armor holding a great sword, guarding a temple gate, deep red and gold','ประตูทิศใต้ไม่เคยแตก เพราะผู้เฝ้าไม่เคยก้าวถอย'),
 ('SD118','พญาช้างฉัททันต์','Chaddanta, the Six-tusked Elephant','สัตว์หิมพานต์','หิมพานต์','epic','ดิน',U,8,8,10,['ทวารบาล'],
  'ดาเมจเกินจากการฆ่ายูนิตทะลุไปที่ดวงชะตาศัตรู; ช้างฝ่ายเรา +2 ATK',
  [{'special':'trample','desc':'ดาเมจเกิน HP ของยูนิตที่ฆ่า ทะลุไปที่ดวงชะตาศัตรู'}, aura('other_ally_units',2,name_contains='ช้าง')],
  'a majestic white elephant king with six shining tusks in a Himmapan forest beside a golden lake, ivory and jade','งาทั้งหกส่องแสงจนนายพรานลืมว่ามาเพื่อล่า'),
 ('SD119','นกหัสดีลิงค์','Hatsadiling','สัตว์หิมพานต์','หิมพานต์','epic','ลม',U,7,8,6,['เหาะเหิน'],
  'ปลุกเสก: โฉบจับ — ทำลายยูนิตศัตรูต้นทุน ≤4 1 ตัว',
  [play(destroy('chosen_enemy_unit',cost_lte=4))],
  'the giant Hatsadiling bird with an elephant head and trunk swooping down with talons, royal cremation pyre motifs, crimson and gold','นกยักษ์ที่ยกช้างทั้งตัวขึ้นได้ ด้วยกรงเล็บเพียงข้างเดียว'),
 ('SD120','ผีเสื้อเมือง','Phi Suea Mueang','ผี','ผี','epic','ดิน',U,7,5,10,['ทวารบาล','ฟื้นฟู'],
  'ผีศัตรูโจมตีดวงชะตาเราโดยตรงไม่ได้; ต้นเทิร์นฟื้น 2 HP ยูนิตเราทุกตัว',
  [{'special':'ghosts_cannot_hit_player','desc':'ยูนิตผีศัตรูโจมตีดวงชะตาเราโดยตรงไม่ได้'}, on('turn_start', heal('all_ally_units',2))],
  'the guardian spirit of an old walled city standing at the city pillar shrine, garlands and incense, stern protective ancestor spirit, earth brown and gold','เจ้าเมืองเปลี่ยนไปกี่คนก็ตาม ผู้เฝ้าเสาหลักยังเป็นคนเดิม'),
 ('SD121','ศรีปราชญ์','Si Prat the Poet','วรรณคดี','มนุษย์','epic','อากาศ',U,6,4,7,[],
  'ปลุกเสก: กลอนแช่ง — ยูนิตศัตรูทุกตัว -2 ATK เทิร์นนี้ และจั่ว 1 ใบ',
  [play(buff('all_enemy_units',-2,0,'turn'), draw(1))],
  'the legendary Ayutthaya court poet writing a verse on a temple wall with his finger before exile, ink and smoke, indigo and parchment','ถ้อยคำบางบท คมกว่าดาบที่ฟันเขา'),
 ('SD122','มนต์สะกดทัพ','Spell of the Sleeping Army','คาถา/ของขลัง','-','epic','อากาศ',S,6,None,None,[],
  'ยูนิตศัตรูทุกตัวหลับ 1 เทิร์น และรับ 1 ดาเมจ',
  [play(sleep('all_enemy_units',1), dmg('all_enemy_units',1))],
  'a sorcerer chanting over a sleeping army in a misty battlefield at night, violet spell sigils in the air, violet and smoke grey','ทัพหมื่นนายหลับใหล ด้วยเสียงสวดเพียงหนึ่งเสียง'),
 # ===== หายาก 22 =====
 ('SD123','ทหารม้าเร็ว','Royal Courier Cavalry','8 อาชีพ','มนุษย์','rare','ลม',U,4,4,3,['ฮึกเหิม'],
  'ฆ่ายูนิตได้ +1 ATK ถาวร', [on('kill', buff('self',1,0))],
  'a Siamese cavalry rider galloping through a burning village at dusk with a royal message, lance raised, wind-swept dust','สารจากเมืองหลวงต้องไปถึงก่อนข้าศึก ไม่ว่าทางจะเต็มไปด้วยอะไร'),
 ('SD124','ครูดาบสำนักพุทไธสวรรย์','Sword Master of Phutthaisawan','8 อาชีพ','มนุษย์','rare','ไฟ',U,5,5,5,['ฮึกเหิม'],
  'ยูนิตมนุษย์ฝ่ายเราตัวอื่น +1 ATK', [aura('other_ally_units',1,tribe='มนุษย์')],
  'an old Thai sword master teaching krabi-krabong in a temple courtyard with twin swords, students in silhouette, ember red','ศิษย์ร้อยคน ล้วนจำได้ว่าครูไม่เคยยิ้ม จนวันที่พวกเขาชนะ'),
 ('SD125','หมอนวดตำรับวัดโพธิ์','Wat Pho Healer','8 อาชีพ','มนุษย์','rare','น้ำ',U,3,1,5,['ฟื้นฟู'],
  'ต้นเทิร์น: ฟื้น 2 HP ยูนิตเราทุกตัว', [on('turn_start', heal('all_ally_units',2))],
  'a traditional Thai healer beside stone carvings of massage postures in a temple pavilion, herbal compresses steaming, teal and warm wood','ทุกเส้นเอ็นมีชื่อ และหมอรู้จักทุกชื่อ'),
 ('SD126','ช่างตีดาบน้ำพี้','Nam Phi Swordsmith','8 อาชีพ','มนุษย์','rare','ดิน',U,4,3,5,['ทวารบาล'],
  'ปลุกเสก: ยูนิตเรา 1 ตัว +2 ATK ถาวร', [play(buff('chosen_ally_unit',2,0))],
  'a muscular blacksmith forging a blade from sacred Nam Phi iron, sparks flying in a dark forge, molten orange on black','เหล็กจากบ่อน้ำพี้ ไม่ยอมหักให้ใครนอกจากเจ้าของ'),
 ('SD127','ผีโหงพราย','Phi Hong Phrai','ผี','ผี','rare','ไฟ',U,5,5,4,['ดูดชีพ','ราหูจร'],
  'ราหูอมจันทร์ +2/+2; ฆ่ายูนิตได้ ฟื้นดวงชะตา 2',
  [on('rahu', buff('self',2,2,'rahu')), on('kill', heal('self_player',2))],
  'a vengeful violent-death ghost rising from a crossroads shrine in red mist, tattered clothes and burning eyes, blood red and black','ตายไม่ทันได้ลา จึงไม่ยอมไปไหน'),
 ('SD128','ผีหัวขาด','Headless Ghost','ผี','ผี','rare','อากาศ',U,4,4,3,['เหาะเหิน'],
  'สิ้นใจ: ยูนิตศัตรูสุ่ม 1 ตัวหลับ 1 เทิร์น', [on('death', sleep('random_enemy_unit',1))],
  'a headless ghost soldier in ancient armor carrying its own head lantern-like through a ruined temple at night, pale violet','มันไม่ได้ตามหาศัตรู มันตามหาหัวของตัวเอง'),
 ('SD129','ผีพรายทะเล','Sea Phrai','ผี','ผี','rare','น้ำ',U,4,3,5,['กำบัง'],
  'ถูกโจมตีแล้ว: ผู้โจมตี -1 ATK ถาวร', [on('attacked', buff('attacker',-1,0))],
  'a drowned sea spirit with seaweed hair rising from dark waves beside a sunken junk ship, bioluminescent teal','ลูกเรือที่จมไปกับสำเภา ยังคงชักใบเรือลำใหม่ทุกคืน'),
 ('SD130','เถรขวาด','Then Khwat the Crocodile Monk','วรรณคดี','อสูร','rare','น้ำ',U,5,6,5,[],
  'ลากลงน้ำ: ยูนิตที่ถูกโจมตีถ้า HP เหลือ ≤2 ถูกทำลาย',
  [on('after_hit', destroy('attack_target'), **{'if': {'target_hp_lte': 2}})],
  'a rogue sorcerer monk transforming into a giant crocodile in a murky river, robes tearing into scales, murky green and gold','วิชาแปลงกายที่ใช้ผิดทาง ย่อมกลืนผู้ใช้เสียเอง'),
 ('SD131','นางสีดา','Sita','วรรณคดี','มนุษย์','rare','ไฟ',U,4,2,6,['กำบัง'],
  'ปลุกเสก: ลุยไฟ — ฟื้นดวงชะตา 3 และยูนิตเรา 1 ตัวได้คงกระพัน',
  [play(heal('self_player',3), grant('chosen_ally_unit',['คงกระพัน']))],
  'the virtuous princess Sita walking unharmed through a ring of sacred fire, serene and dignified, white and flame orange','ไฟไม่อาจแผดเผาผู้ที่ใจบริสุทธิ์'),
 ('SD132','พิเภก','Phiphek','วรรณคดี','อสูร','rare','อากาศ',U,4,3,5,[],
  'ปลุกเสก: ดูดาว — แอบดูไพ่ในมือศัตรู 2 ใบ และจั่ว 1 ใบ', [play(reveal(2), draw(1))],
  'the wise giant astrologer Phiphek reading the stars with an astrolabe atop a tower in Lanka, green skin and calm eyes, deep indigo','ผู้รู้ชะตาของกรุงลงกา ก่อนที่กรุงลงกาจะรู้ตัว'),
 ('SD133','องคต','Ongkhot','วรรณคดี','หิมพานต์','rare','ลม',U,5,5,5,['ฮึกเหิม'],
  'มีหนุมานฝ่ายเรา +2/+2; ปลุกเสก ยูนิตอสูรศัตรู 1 ตัว -2 ATK ถาวร',
  [aura('self',2,2,cond={'ally_name':'หนุมาน'}), play(buff('chosen_enemy_unit',-2,0,tribe='อสูร'))],
  'the monkey prince Ongkhot as royal envoy standing defiantly in a demon king court, green fur and gold crown','ทูตที่ส่งไปเจรจา แต่ทำให้ทั้งท้องพระโรงสั่นสะเทือน'),
 ('SD134','สุครีพ','Sukhrip','วรรณคดี','หิมพานต์','rare','ไฟ',U,5,4,6,['ทวารบาล'],
  'ปลุกเสก: ยูนิตหิมพานต์ฝ่ายเราทุกตัว +1/+1 ถาวร', [play(buff('all_ally_units',1,1,tribe='หิมพานต์'))],
  'the red monkey king Sukhrip leading a vast monkey army across a stone bridge, red fur and golden armor','ทัพวานรนับแสน เดินตามเสียงคำรามเพียงเสียงเดียว'),
 ('SD135','ม้านิลมังกร','Ma Nin Mangkon','สัตว์หิมพานต์','หิมพานต์','rare','น้ำ',U,5,5,5,['เหาะเหิน'],
  'มีสุดสาครฝ่ายเรา +2/+2', [aura('self',2,2,cond={'ally_name':'สุดสาคร'})],
  'a dragon-headed horse with dark blue scales galloping across ocean waves, mane like sea foam, deep blue and gold','ร่างเป็นม้า หัวเป็นมังกร วิ่งบนน้ำได้เหมือนวิ่งบนดิน'),
 ('SD136','นางเงือก','Mermaid of Ko Kaeo','สัตว์หิมพานต์','หิมพานต์','rare','น้ำ',U,4,3,5,['กำบัง'],
  'ปลุกเสก: ยูนิตเรา 1 ตัวฟื้น 3 HP และล้างคุณไสย', [play(heal('chosen_ally_unit',3), cleanse('chosen_ally_unit'))],
  'a gentle Thai mermaid sitting on a rock near a sacred island at dawn, pearls and coral ornaments, aquamarine and pearl','ผู้ที่พาเจ้าชายหนีจากนางยักษ์ คือผู้ที่ไม่มีขาแม้แต่ข้างเดียว'),
 ('SD137','เหมราช','Hemarat','สัตว์หิมพานต์','หิมพานต์','rare','ไฟ',U,5,5,4,['เหาะเหิน','ฮึกเหิม'],
  'โจมตีข้ามทวารบาลได้ (เหาะเหิน)', [],
  'the golden winged lion-bird Hemarat soaring above temple spires, feathered mane in flame colors, gold and crimson','ราชสีห์ที่มีปีก ไม่ต้องรอให้ใครเปิดทาง'),
 ('SD138','ครุฑยุดนาค','Garuda Seizes the Naga','คาถา/ของขลัง','-','rare','ลม',S,4,None,None,[],
  'ทำลายยูนิตศัตรูต้นทุน ≤3 1 ตัว', [play(destroy('chosen_enemy_unit',cost_lte=3))],
  'a Garuda gripping a writhing naga in its talons high above a temple roof, iconic Thai royal motif, crimson and gold','ภาพบนหน้าบันเตือนทุกคนว่า ใครอยู่เหนือใคร'),
 ('SD139','พระขรรค์ชัยศรี','Phra Saeng Khan Chai Si','คาถา/ของขลัง','-','rare','ไฟ',A,4,None,None,[],
  'ติดยูนิต +2/+2 และได้ทวารบาล', [equip(2,2,['ทวารบาล'])],
  'an ornate royal sword of victory resting on a gold cushion, radiant blade with engraved kanok patterns, gold and flame','ดาบที่ปรากฏจากน้ำ ตามตำนานว่าเลือกเจ้าของได้เอง'),
 ('SD140','ตะกรุดมหาอุด','Takrut Maha Ut','คาถา/ของขลัง','-','rare','ดิน',A,3,None,None,[],
  'ติดยูนิต +0/+3 และได้คงกระพัน', [equip(0,3,['คงกระพัน'])],
  'a rolled metal takrut amulet inscribed with yantra on a red cord, glowing protective sigils, bronze and red','ยิงไม่ออก ฟันไม่เข้า อย่างน้อยก็ตามคำเล่า'),
 ('SD141','คาถาเสกหนังเข้าท้อง','Hide-in-the-Belly Curse','คาถา/ของขลัง','-','rare','ไฟ',S,4,None,None,[],
  '3 ดาเมจแก่ยูนิตศัตรู 1 ตัว และติดพิษ 1', [play(dmg('chosen_enemy_unit',3), poison('chosen_enemy_unit',1))],
  'a black magic sorcerer chanting over a buffalo hide in a dark shrine, cursed smoke and red sigils, dark red and black','ไสยดำที่เก่าแก่ที่สุด มักเป็นไสยดำที่เจ็บที่สุด'),
 ('SD142','พิธีทำขวัญ','Tham Khwan Ceremony','คาถา/ของขลัง','-','rare','น้ำ',S,3,None,None,[],
  'ชุบชีวิตยูนิตต้นทุน ≤3 จากสุสานเรา HP เต็ม', [play(revive(cost_lte=3))],
  'a Thai soul-calling ceremony with a banana-leaf bai si tower, candles and white threads, warm gold and green','ขวัญเอ๋ย กลับมาเถิด'),
 ('SD143','บ่วงบาศ','Lasso of Binding','คาถา/ของขลัง','-','rare','ลม',T,3,None,None,[],
  'เมื่อยูนิตศัตรูโจมตี: ยกเลิกการโจมตีนั้น และผู้โจมตีหลับ 1 เทิร์น',
  [on('enemy_attack', {'counter':{}}, sleep('attacker',1))],
  'an enchanted rope lasso glowing with spell runes snaring a charging warrior in mid-air, wind-blown dust, pale gold','ไม่ต้องรีบหนี บ่วงยังไม่เคยพลาดใคร'),
 ('SD144','ฤๅษีกไลยโกฏ','Hermit Kalaiyakot','วรรณคดี','มนุษย์','rare','อากาศ',U,4,2,6,[],
  'ต้นเทิร์นแรกหลังลง: ได้อาคม +1', [on('turn_start', {'gain_akhom':{'amount':1}}, once=True)],
  'an ancient hermit with a deer horn on his forehead meditating in a forest hermitage, mystical aura, moss green and gold','ฤๅษีผู้มีเขาดั่งกวาง บำเพ็ญจนฝนต้องหยุดฟัง'),
 # ===== ทั่วไป 24 =====
 ('SD145','สุดสาคร','Sut Sakhon','วรรณคดี','มนุษย์','standard','น้ำ',U,3,3,3,['ฮึกเหิม'],
  'มีม้านิลมังกรฝ่ายเรา +2/+2', [aura('self',2,2,cond={'ally_name':'ม้านิลมังกร'})],
  'young prince Sut Sakhon with a magic staff riding along a beach at dawn, sea breeze, aquamarine and gold','ลูกของมนุษย์กับนางเงือก ผู้ไม่เคยกลัวทะเล'),
 ('SD146','ศรีสุวรรณ','Si Suwan','วรรณคดี','มนุษย์','standard','ดิน',U,3,3,4,['ทวารบาล'],
  'มีพระอภัยมณีฝ่ายเรา +1/+1', [aura('self',1,1,cond={'ally_name':'พระอภัยมณี'})],
  'prince Si Suwan holding a club in a heroic stance, loyal younger brother, ochre and bronze','น้องที่ไม่เคยทิ้งพี่ ไม่ว่าพี่จะเป่าปี่ไปถึงไหน'),
 ('SD147','นางละเวงวัณฬา','Nang Laweng','วรรณคดี','มนุษย์','standard','ลม',U,4,3,4,['เมตตามหานิยม'],
  'ปลุกเสก: ยูนิตศัตรู 1 ตัว -2 ATK ถาวร', [play(buff('chosen_enemy_unit',-2,0))],
  'a beautiful western queen of Langka in ornate gown holding an enchanted portrait, charming yet dangerous, rose and teal','ภาพวาดเพียงภาพเดียว ทำให้ทัพทั้งทัพวางอาวุธ'),
 ('SD148','ขุนไกรพลพ่าย','Khun Krai','วรรณคดี','มนุษย์','standard','ไฟ',U,3,4,2,['ฮึกเหิม'],
  'โจมตีได้ทันที', [],
  'a fierce Ayutthaya warrior on horseback charging a wild buffalo herd with a spear, dust and fire light','ทวนในมือเขาไม่เคยลังเล แม้คำสั่งจะเป็นคำสั่งตาย'),
 ('SD149','นางทองประศรี','Nang Thong Prasi','วรรณคดี','มนุษย์','standard','ดิน',U,3,1,5,['ทวารบาล'],
  'สิ้นใจ: จั่ว 1 ใบ', [on('death', draw(1))],
  'a strong-willed Thai mother in traditional dress protecting her son behind her in a village house, warm earth tones','แม่ผู้พาลูกหนีภัย และสอนให้ลูกเป็นยอดคน'),
 ('SD150','พลายชุมพล','Phlai Chumphon','วรรณคดี','มนุษย์','standard','ลม',U,4,4,3,[],
  'ปลุกเสก: มีพลายงามฝ่ายเรา ตัวนี้ +2/+2 ถาวร',
  [play(buff('self',2,2), **{'if': {'ally_name': 'พลายงาม'}})],
  'a young warrior disguised as a Mon soldier with a spear, clever smile, battlefield smoke, jade and bronze','น้องที่หัวไวพอ จะแปลงกายเข้าไปในทัพของพี่เอง'),
 ('SD151','ผีปอบน้อย','Little Phi Pop','ผี','ผี','standard','ไฟ',U,2,2,2,['ลิ้มเลือด'],
  'ฆ่ายูนิตได้ +1/+1 ถาวร', [],
  'a small hungry Phi Pop spirit crouching in a dark kitchen, glowing red eyes, smoke and embers','ยังเล็กอยู่ ก็กินยังไม่มาก'),
 ('SD152','เปรตขอส่วนบุญ','Merit-begging Pret','ผี','ผี','standard','อากาศ',U,3,2,4,[],
  'ต้นเทิร์น: ฟื้นดวงชะตา 1; สิ้นใจ ฟื้นดวงชะตา 2',
  [on('turn_start', heal('self_player',1)), on('death', heal('self_player',2))],
  'a tall thin hungry ghost with a tiny mouth waiting at a temple during a merit-making festival, pale grey and candle gold','กรวดน้ำให้หน่อยเถิด แล้วจะไม่มาหลอกอีก'),
 ('SD153','ผีกองข้าว','Rice-heap Spirit','ผี','ผี','standard','ดิน',U,3,2,5,['ทวารบาล'],
  'เมื่อยูนิตใดตายบนสนาม +0/+1 ถาวร', [on('any_death', buff('self',0,1))],
  'a guardian spirit rising from a golden rice heap in a moonlit paddy field, straw and gold','อย่าเหยียบข้าวในนา ผีเฝ้ายังนับเม็ดอยู่'),
 ('SD154','นกแสกลางร้าย','Ill-omen Barn Owl','ผี','ผี','standard','ลม',U,3,3,2,['เหาะเหิน'],
  'ปลุกเสก: ยูนิตศัตรู 1 ตัวติดพิษ 1', [play(poison('chosen_enemy_unit',1))],
  'a ghostly white barn owl screeching over a village roof at midnight, omen of misfortune, pale silver and black','เสียงร้องผ่านหลังคาบ้านใด บ้านนั้นต้องจุดธูป'),
 ('SD155','ผีโป่งค่าง','Phi Pong Khang','ผี','ผี','standard','ดิน',U,4,4,4,[],
  'ราหูอมจันทร์ +2 ATK และได้ลิ้มเลือด',
  [on('rahu', buff('self',2,0,'rahu'), grant('self',['ลิ้มเลือด'],'rahu'))],
  'a forest monkey-ghost with glowing eyes leaping between banyan trees at night, mossy green and violet','กลางคืนในป่าใหญ่ อย่านับเสียงลิงที่ได้ยิน'),
 ('SD156','งูซวง','Ngu Suang Serpent','สัตว์หิมพานต์','หิมพานต์','standard','น้ำ',U,3,2,4,['พิษ 1'],
  'ยูนิตที่โจมตีการ์ดนี้ติดพิษ 1', [],
  'a venomous jungle serpent coiled around a jungle shrine, iridescent scales, emerald and black','งูเฝ้าป่าไม่ไล่ใคร มันแค่รอ'),
 ('SD157','นาคเฝ้าบันได','Stairway Naga','สัตว์หิมพานต์','หิมพานต์','standard','น้ำ',U,4,3,6,['ทวารบาล'],
  'มีพญาศรีสุทโธนาคฝ่ายเรา +2 ATK', [aura('self',2,cond={'ally_name':'พญาศรีสุทโธนาค'})],
  'a naga balustrade coming alive along temple stairs, multi-headed serpent of glazed tiles, emerald and gold','บันไดนาคทุกขั้นมีชีวิต ถ้าเดินขึ้นด้วยใจไม่บริสุทธิ์'),
 ('SD158','คชปักษา','Khotchapaksa','สัตว์หิมพานต์','หิมพานต์','standard','ลม',U,4,3,4,['เหาะเหิน'],
  'ปลุกเสก: จั่ว 1 ใบ', [play(draw(1))],
  'a Himmapan creature with an elephant head and bird body flying over misty peaks, jade and ivory','สัตว์ป่าหิมพานต์ที่หนักเกินบิน แต่ก็บินอยู่ดี'),
 ('SD159','ไกรสรนาคา','Kraisorn Nakha','สัตว์หิมพานต์','หิมพานต์','standard','น้ำ',U,4,4,4,['ดูดชีพ'],
  '', [],
  'a lion with a serpent tail and scaled body prowling by a waterfall, Himmapan beast, teal and gold','ครึ่งราชสีห์ ครึ่งนาค และหิวทั้งสองครึ่ง'),
 ('SD160','มังกรสกุณี','Mangkon Sakuni','สัตว์หิมพานต์','หิมพานต์','standard','ไฟ',U,4,4,3,['เหาะเหิน'],
  'ราหูอมจันทร์ +1/+1', [on('rahu', buff('self',1,1,'rahu'))],
  'a dragon-headed bird with fiery plumage circling a full moon being swallowed by Rahu, crimson and gold','เมื่อจันทร์ถูกอม มันจะร้องรับราหูเป็นตัวแรก'),
 ('SD161','อัปสรสีหะ','Apsonsi','สัตว์หิมพานต์','หิมพานต์','standard','อากาศ',U,3,2,3,['กำบัง'],
  'ปลุกเสก: ยูนิตเรา 1 ตัว +1/+2 ถาวร', [play(buff('chosen_ally_unit',1,2))],
  'a graceful half-angel half-lion Apsonsi with gilded crown in a temple garden, gold and soft white','ร่างงามดุจนางฟ้า แต่ก้าวเท้าดั่งราชสีห์'),
 ('SD162','ชาวนาเมืองลพบุรี','Lopburi Farmer','มนุษย์','มนุษย์','standard','ดิน',U,2,1,4,['ทวารบาล'],
  'สิ้นใจ: ฟื้นดวงชะตา 3', [on('death', heal('self_player',3))],
  'a Thai farmer with a sickle standing guard over a rice field during war, straw hat, sunset earth tones','ทุ่งนาเล็ก ๆ ก็เป็นแนวรบได้ ถ้าเจ้าของไม่ยอมถอย'),
 ('SD163','แม่ทัพเรือ','Admiral of the River Fleet','8 อาชีพ','มนุษย์','standard','น้ำ',U,4,4,4,[],
  'ยูนิตน้ำฝ่ายเราตัวอื่น +1 ATK', [aura('other_ally_units',1,element='น้ำ')],
  'a Siamese naval commander on the prow of a war barge with oars and banners on the Chao Phraya river, deep blue and gold','เรือรบร้อยลำ ตีกลองจังหวะเดียวกัน'),
 ('SD164','ทหารเสือกรุงธนบุรี','Thonburi Tiger Guard','8 อาชีพ','มนุษย์','standard','ไฟ',U,4,5,3,['ฮึกเหิม'],
  '', [],
  'an elite Thonburi era tiger-guard soldier in battle stance with a sword and shield, fire-lit ruins, crimson and black','ทหารที่เกิดจากกรุงที่แตก และไม่ยอมให้แตกอีก'),
 ('SD165','หมอดูริมกำแพง','Wall-side Fortune Teller','8 อาชีพ','มนุษย์','standard','อากาศ',U,2,1,3,[],
  'ปลุกเสก: แอบดูไพ่ในมือศัตรู 1 ใบ และจั่ว 1 ใบ', [play(reveal(1), draw(1))],
  'an old fortune teller with cards and a palm chart sitting by an old city wall at dusk, candlelight and violet','ดวงของท่านดีมาก ตราบใดที่ท่านจ่ายครบ'),
 ('SD166','มนต์พรายกระซิบ','Whispering Phrai Spell','คาถา/ของขลัง','-','standard','อากาศ',S,2,None,None,[],
  'ยูนิตศัตรู 1 ตัวหลับ 2 เทิร์น', [play(sleep('chosen_enemy_unit',2))],
  'spectral whispering spirits curling around a warrior ear, sleep-inducing violet mist, dark violet','บางเสียงในหัว ไม่ได้มาจากตัวเรา'),
 ('SD167','ผ้าขาวม้ามงคล','Blessed Pha Khao Ma','คาถา/ของขลัง','-','standard','ดิน',A,2,None,None,[],
  'ติดยูนิต +1/+2', [equip(1,2)],
  'a checkered Thai loincloth blessed with gold yantra glowing faintly, tied around a warrior waist, earth red and gold','ผ้าผืนเดียว ใช้ได้ทุกอย่าง รวมทั้งกันภัย'),
 ('SD168','หลุมขวากหนาม','Spiked Pit Trap','คาถา/ของขลัง','-','standard','ดิน',T,3,None,None,[],
  'เมื่อยูนิตศัตรูโจมตี: 3 ดาเมจแก่ผู้โจมตี', [on('enemy_attack', dmg('attacker',3))],
  'a concealed pit lined with sharpened bamboo stakes on a jungle path, ominous shadows, earth brown','ทางลัดในป่า มักเป็นทางสุดท้าย'),
 # ===== ธรรมดา 32 =====
 ('SD169','พลทวน','Spearman','มนุษย์','มนุษย์','common','ดิน',U,2,2,3,['ทวารบาล'],'', [],
  'a Siamese spearman in a shield wall formation, ochre and bronze','ทวนยาวเพียงหนึ่งเล่ม กั้นม้าได้หนึ่งตัว'),
 ('SD170','ทหารกองระวังหน้า','Vanguard Scout','มนุษย์','มนุษย์','common','ลม',U,1,1,2,[],
  'ปลุกเสก: แอบดูไพ่ในมือศัตรู 1 ใบ', [play(reveal(1))],
  'a scout crouching in tall grass watching an enemy camp at night, moonlit silver','เห็นก่อน รู้ก่อน รอดก่อน'),
 ('SD171','นักรบหญิงเมืองถลาง','Thalang Woman Warrior','มนุษย์','มนุษย์','common','ไฟ',U,2,3,2,['ฮึกเหิม'],'', [],
  'a fierce woman warrior of Thalang in battle with a sword, coastal fortress on fire, crimson','ศึกครั้งนั้น ผู้หญิงทั้งเมืองถือดาบ'),
 ('SD172','ชาวประมงลุ่มเจ้าพระยา','Chao Phraya Fisherman','มนุษย์','มนุษย์','common','น้ำ',U,1,1,2,[],
  'ปลุกเสก: ยูนิตเรา 1 ตัวฟื้น 2 HP', [play(heal('chosen_ally_unit',2))],
  'a fisherman casting a net from a small boat on a misty river at dawn, soft blue','แม่น้ำให้ปลา และให้ยาสมุนไพรติดแหมาด้วย'),
 ('SD173','ควาญช้างหนุ่ม','Young Mahout','มนุษย์','มนุษย์','common','ดิน',U,2,2,2,[],
  'ช้างฝ่ายเรา +0/+2', [aura('all_ally_units',0,2,name_contains='ช้าง')],
  'a young mahout bathing an elephant in a river under morning light, warm earth and jade','ช้างฟังเสียงเขามากกว่าเสียงแม่ทัพ'),
 ('SD174','เด็กวัดซุกซน','Mischievous Temple Boy','มนุษย์','มนุษย์','common','ลม',U,1,1,1,['กำบัง'],
  'สิ้นใจ: จั่ว 1 ใบ', [on('death', draw(1))],
  'a cheeky temple boy hiding behind a pillar with a slingshot, temple courtyard, warm light','ถูกจับได้ทุกครั้ง แต่ก็ได้ขนมทุกครั้ง'),
 ('SD175','แม่ค้าข้าวแกง','Curry-rice Vendor','มนุษย์','มนุษย์','common','ไฟ',U,2,1,3,[],
  'ปลุกเสก: ฟื้นดวงชะตา 2', [play(heal('self_player',2))],
  'a market vendor with steaming pots of curry under lantern light, warm amber and red','อิ่มก่อน แล้วค่อยไปรบ'),
 ('SD176','นายท้ายเรือ','Boat Helmsman','มนุษย์','มนุษย์','common','น้ำ',U,2,2,2,[],
  'ยูนิตน้ำฝ่ายเราตัวอื่น +0/+1', [aura('other_ally_units',0,1,element='น้ำ')],
  'a helmsman steering a long wooden boat through a narrow canal, rain and lanterns, blue and amber','เรือจะไปถึงไหน ขึ้นกับคนท้ายเรือ'),
 ('SD177','ผีตายทั้งกลม','Phi Tai Thang Klom','ผี','ผี','common','น้ำ',U,3,3,3,['อมตะ'],'', [],
  'a sorrowful ghost woman in white by a riverbank under a pale moon, eerie mist, pale blue','วิญญาณที่หนักที่สุด ไม่ยอมจมน้ำ'),
 ('SD178','ผีขโมยข้าว','Rice-thief Ghost','ผี','ผี','common','ดิน',U,2,1,1,[],
  'ปลุกเสก: ศัตรูทิ้งไพ่สุ่ม 1 ใบ', [play(discard(1))],
  'a mischievous little ghost sneaking away with a sack of rice from a granary, moonlight, brown and grey','ข้าวหายจากยุ้งทีละนิด จนวันหนึ่งไม่เหลือ'),
 ('SD179','ผีตุ๊กแกเฝ้าบ้าน','House Gecko Spirit','ผี','ผี','common','ลม',U,1,1,1,['เหาะเหิน'],'', [],
  'a ghostly tokay gecko clinging to an old teak house wall, glowing spots, green and violet','ตุ๊กแกร้องเจ็ดครั้ง แล้วเงียบไปนานเกิน'),
 ('SD180','ผีลิงลม','Wind Monkey Ghost','ผี','ผี','common','ลม',U,2,2,1,['เหาะเหิน'],
  'ราหูอมจันทร์ +1 ATK', [on('rahu', buff('self',1,0,'rahu'))],
  'a spectral monkey leaping on wind currents between temple spires, translucent body, pale jade','ลมกรรโชกกลางคืน บางครั้งก็มีหาง'),
 ('SD181','ผีโคมลอย','Floating Lantern Ghost','ผี','ผี','common','ไฟ',U,2,2,1,['เหาะเหิน'],
  'สิ้นใจ: 1 ดาเมจแก่ดวงชะตาศัตรู', [on('death', dmg('enemy_player',1))],
  'a ghost flame within a sky lantern drifting above a dark river festival, orange glow on black','โคมที่ปล่อยไปแล้วไม่ย้อนกลับ ยกเว้นดวงนี้'),
 ('SD182','ผีบ่อน้ำร้าง','Abandoned Well Ghost','ผี','ผี','common','น้ำ',U,2,1,4,['ทวารบาล'],'', [],
  'a ghost hand reaching out of an old stone well in an abandoned village, moss and moonlight, cold teal','อย่าก้มมองลงไปนานเกินไป'),
 ('SD183','ผีนางไม้ไผ่','Bamboo Spirit','ผี','ผี','common','ดิน',U,2,2,3,['กำบัง'],'', [],
  'a delicate female spirit emerging from a bamboo grove, swaying stalks and green light','ไผ่ลำสวยที่สุดในกอ อย่าตัด'),
 ('SD184','ผีเฝ้าป่าช้า','Cemetery Watcher','ผี','ผี','common','อากาศ',U,2,2,2,[],
  'เมื่อยูนิตใดตายบนสนาม +0/+1 ถาวร', [on('any_death', buff('self',0,1))],
  'a hooded ghost keeper among old cremation stupas with a lantern, violet fog','ทุกดวงวิญญาณที่ผ่านมา ต้องลงชื่อกับเขาก่อน'),
 ('SD185','ยักษ์เฝ้าประตูวัด','Temple Gate Giant','อสูร','อสูร','common','ดิน',U,3,2,5,['ทวารบาล'],'', [],
  'a towering guardian giant statue at a temple gate coming alive with a club, porcelain mosaic armor, multicolor','รูปปั้นที่ยืนเฝ้ามาสองร้อยปี ยืดเส้นยืดสายบ้างก็ได้'),
 ('SD186','อสูรเขี้ยวเพลิง','Flame-fang Demon','อสูร','อสูร','common','ไฟ',U,3,4,2,['ลิ้มเลือด'],'', [],
  'a snarling demon with flaming fangs crouching on volcanic rocks, red and black','กลิ่นเลือดทำให้ไฟในปากมันลุกโชน'),
 ('SD187','บริวารทศกัณฐ์','Servant of Thotsakan','อสูร','อสูร','common','ไฟ',U,2,3,2,[],
  'มีทศกัณฐ์ฝ่ายเรา +1/+1', [aura('self',1,1,cond={'ally_name':'ทศกัณฐ์'})],
  'a minor demon soldier of Lanka in green armor marching with a spear, red sky','จงรักภักดีต่อเจ้าลงกา ถึงแม้จะไม่เคยเห็นหน้า'),
 ('SD188','นางยักษ์แปลงกาย','Shapeshifting Giantess','อสูร','อสูร','common','ลม',U,2,2,2,['กำบัง'],
  'ปลุกเสก: ยูนิตศัตรู 1 ตัว -1 ATK เทิร์นนี้', [play(buff('chosen_enemy_unit',-1,0,'turn'))],
  'a giantess half-transformed into a beautiful maiden in a forest clearing, illusion shimmer, violet and green','หน้างามเกินจริง มักไม่ใช่หน้าจริง'),
 ('SD189','วานรเผือก','White Forest Monkey','สัตว์หิมพานต์','หิมพานต์','common','ลม',U,1,1,2,[],
  'มีหนุมานฝ่ายเรา +1 ATK', [aura('self',1,cond={'ally_name':'หนุมาน'})],
  'a small white monkey with bright eyes on a Himmapan tree branch, pale gold','ลูกน้องคนเล็กที่สุดในทัพวานร'),
 ('SD190','กวางทองมารีศ','Golden Deer Marit','วรรณคดี','อสูร','common','ดิน',U,2,1,3,['กำบัง'],
  'สิ้นใจ: ยูนิตศัตรูสุ่ม 1 ตัวหลับ 1 เทิร์น', [on('death', sleep('random_enemy_unit',1))],
  'a shimmering golden deer with jeweled spots luring in a dark forest, gold on deep green','ยิ่งไล่ตาม ยิ่งห่างจากบ้าน'),
 ('SD191','นกการเวก','Karawek Bird','สัตว์หิมพานต์','หิมพานต์','common','ลม',U,2,2,2,['เหาะเหิน'],
  'ปลุกเสก: ยูนิตเราทุกตัวฟื้น 1 HP', [play(heal('all_ally_units',1))],
  'a mythical karawek bird singing on a flowering branch, melody notes of light, gold and pink','เสียงเพลงของมันทำให้แม้แต่ลมหยุดพัด'),
 ('SD192','ปลาบู่ทอง','Golden Goby','วรรณคดี','หิมพานต์','common','น้ำ',U,2,1,3,[],
  'สิ้นใจ: ยูนิตเราทุกตัวฟื้น 2 HP', [on('death', heal('all_ally_units',2))],
  'a golden goby fish glowing in a clear pond with lotus leaves, gentle and magical, gold and teal','แม่ไม่เคยจากไปไหน แค่เปลี่ยนรูปเพื่ออยู่ใกล้'),
 ('SD193','ช้างศึกหนุ่ม','Young War Elephant','สัตว์หิมพานต์','หิมพานต์','common','ดิน',U,3,3,4,['ทวารบาล'],'', [],
  'a young war elephant with ornate battle cloth and tusk guards, dusty battlefield, earth and gold','ยังไม่เคยออกศึก แต่ก็ไม่เคยถอยแม้ก้าวเดียว'),
 ('SD194','น้ำมนต์ธรณีสาร','Thoranisan Holy Water','คาถา/ของขลัง','-','common','น้ำ',S,2,None,None,[],
  'ยูนิตเรา 1 ตัวฟื้น 4 HP และล้างคุณไสย', [play(heal('chosen_ally_unit',4), cleanse('chosen_ally_unit'))],
  'a monk sprinkling holy water from a silver bowl with a bundle of leaves, droplets glowing, silver and teal','ธรณีสารล้างได้ทั้งดินและใจ'),
 ('SD195','คาถาฟ้าแลบ','Lightning Incantation','คาถา/ของขลัง','-','common','ไฟ',S,2,None,None,[],
  '2 ดาเมจแก่ยูนิตศัตรู 1 ตัว', [play(dmg('chosen_enemy_unit',2))],
  'a forked lightning bolt summoned by a sorcerer striking a demon, white and orange','สวดผิดหนึ่งพยางค์ ฟ้าก็ผ่าผิดหลัง'),
 ('SD196','ลมเพลมพัด','Lom Phlaem Phat','คาถา/ของขลัง','-','common','ลม',S,1,None,None,[],
  'ยูนิตศัตรู 1 ตัวโจมตีไม่ได้ 1 เทิร์น', [play(noatk('chosen_enemy_unit',1))],
  'a cursed gust of wind with spectral faces knocking a warrior off balance, pale jade','ลมที่พัดมาโดยไม่มีพายุ ระวังไว้'),
 ('SD197','ผ้าประเจียด','Prajiad Armband','คาถา/ของขลัง','-','common','อากาศ',A,1,None,None,[],
  'ติดยูนิต +0/+2', [equip(0,2)],
  'a red yantra cloth armband tied around a boxer arm, glowing script, red and gold','ผูกไว้ที่แขน ให้ครูคุ้มครอง'),
 ('SD198','เบี้ยแก้','Bia Kae Amulet','คาถา/ของขลัง','-','common','ดิน',A,2,None,None,[],
  'ติดยูนิต +0/+1 และได้ฟื้นฟู', [equip(0,1,['ฟื้นฟู'])],
  'a cowrie shell amulet filled with mercury and wrapped in cloth on a cord, protective glow, silver and bronze','เบี้ยหนึ่งตัว แก้ได้ร้อยภัย'),
 ('SD199','มีดหมอ','Mo Knife','คาถา/ของขลัง','-','common','ไฟ',A,2,None,None,[],
  'ติดยูนิต +2 ATK', [equip(2,0)],
  'a sacred shaman knife with an engraved handle glowing with sigils on a ritual cloth, black and gold','มีดที่ไม่ได้มีไว้หั่นอะไร นอกจากคุณไสย'),
 ('SD200','ตาข่ายสายสิญจน์','Sacred Thread Net','คาถา/ของขลัง','-','common','อากาศ',T,2,None,None,[],
  'เมื่อผีศัตรูโจมตี: ยกเลิกการโจมตีนั้น และผู้โจมตีถูกสายสิญจน์ 1 เทิร์น',
  [on('enemy_attack', {'counter':{}}, seal('attacker',1), **{'if': {'attacker_tribe': 'ผี'}})],
  'a glowing net of white sacred threads trapping a ghost in mid-air at a temple, white and violet','ด้ายเส้นบางที่สุด ผูกผีที่ดื้อที่สุด'),
]

STYLE = ('Dark Thai mural painting meets cinematic concept art, ornate Thai details, single centered subject, square 1:1 composition, '
         'subject centered with head and face in the upper half, full background filled edge to edge. No text, no letters, no logo, no frame, no border, no watermark.')
RESPECT = 'respectful, dignified and majestic depiction faithful to traditional Thai iconography, no caricature, no humor. '

def build():
    data = json.load(open(P('data/siam_duel_cards.json'), encoding='utf-8'))
    ids = {c[0] for c in CARDS}
    assert len(CARDS) == 100 and len(ids) == 100, (len(CARDS), len(ids))
    old_names = {c['name_th'] for c in data['cards'] if c['id'] not in ids}
    data['cards'] = [c for c in data['cards'] if c['id'] not in ids]
    out = []
    for (cid, nm, en, cat, tribe, r, el, ty, cost, atk, hp, kw, text, code, art, flavor) in CARDS:
        assert nm not in old_names, nm
        respectful = cat in ('เทพเจ้า', 'ผู้ปกครอง')
        out.append({'id': cid, 'name_th': nm, 'name_en': en, 'category': cat, 'tribe': tribe, 'rarity': TH[r], 'element': el, 'type': ty,
            'cost': cost, 'atk': atk, 'hp': hp, 'keywords': kw, 'text_th': text, 'flavor_th': flavor, 'ability_code': code,
            'art': f'/assets/cards/{cid}.webp',
            'art_prompt': f'Thai dark fantasy trading card illustration of {art}, ' + (RESPECT if respectful else '') + STYLE,
            'is_ruler': cat == 'ผู้ปกครอง', 'is_deity': cat == 'เทพเจ้า', 'rarity_old': OLD[r], 'rarity_code': r, 'max_supply': None,
            'collector_edition': False, 'collector_fx': None, 'set': 2, 'art_status': 'placeholder'})
    data['cards'] += out
    data['set'] = 'ชุดที่ 1: ราหูอมจันทร์ · ชุดที่ 2: ตำนานแผ่นดินสยาม'
    data['version'] = '1.2'
    json.dump(data, open(P('data/siam_duel_cards.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    mn = [c for c in json.load(open(P('src/cards_min.json'), encoding='utf-8')) if c['id'] not in ids]
    mn += [{'id': c['id'], 'name_th': c['name_th'], 'rarity_code': c['rarity_code'], 'type': c['type'], 'element': c['element'], 'cost': c['cost'],
            'atk': c['atk'], 'hp': c['hp'], 'keywords': c['keywords'], 'text_th': c['text_th'], 'max_supply': None, 'set': 2} for c in out]
    json.dump(mn, open(P('src/cards_min.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    man = json.load(open(P('game_assets/manifest.json'), encoding='utf-8'))
    for c in out:
        man['cards'][c['id']] = {'tier': c['rarity_code'], 'art': f"art/{c['id']}.webp", 'art_thumb': f"art/thumb/{c['id']}.webp", 'token': False, 'placeholder': True}
    json.dump(man, open(P('game_assets/manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    with open(P('docs/prompts/set2_art_prompts_1x1.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f); w.writerow(['ID', 'ชื่อไทย', 'ระดับ', 'Prompt ภาพ (1:1 สำหรับช่องภาพ)', 'ชื่อไฟล์ที่ต้องบันทึก'])
        for c in out: w.writerow([c['id'], c['name_th'], c['rarity'], c['art_prompt'], c['id'] + '.png'])

    q = lambda s: "'" + s.replace("'", "''") + "'"
    sql = ['-- =====================================================================',
           '-- สยามมินทร์ดูเอล — การ์ดชุดที่ 2 (SD101–SD200) + สถิติการ์ดสำหรับหน้าตู้สุ่ม',
           '-- รันหลัง schema.sql / 002 / 003 / 004 · รันซ้ำได้ (ไม่ลบการ์ดที่ผู้เล่นมีอยู่)',
           '-- ถ้ารัน schema.sql ใหม่ (รีเซต CBT) ต้องรันไฟล์นี้ซ้ำ เพื่อให้ตู้สุ่มมีการ์ดชุดที่ 2',
           '-- =====================================================================', '',
           'insert into public.card_catalog (card_id, name_th, rarity, max_supply) values']
    sql.append(',\n'.join(f"({q(c['id'])},{q(c['name_th'])},{q(c['rarity_code'])},null)" for c in out))
    sql[-1] += '\non conflict (card_id) do update set name_th = excluded.name_th, rarity = excluded.rarity, max_supply = excluded.max_supply;'
    sql.append(open(P('tools/card_stats.sql'), encoding='utf-8').read())
    open(P('supabase/005_set2_cards.sql'), 'w', encoding='utf-8').write('\n'.join(sql) + '\n')

    made = 0
    for c in out:
        full, thumb = P('game_assets/art', c['id'] + '.webp'), P('game_assets/art/thumb', c['id'] + '.webp')
        if os.path.exists(full) and not man['cards'][c['id']].get('placeholder'): continue
        if os.path.exists(full) and os.path.getsize(full) > 60000: continue   # มีภาพจริงแล้ว
        im = placeholder(c); im.save(full, 'WEBP', quality=80, method=6)
        t = im.copy(); t.thumbnail((320, 320), Image.LANCZOS); t.save(thumb, 'WEBP', quality=78, method=6); made += 1
    print(f'การ์ดชุดที่ 2: {len(out)} ใบ · ภาพชั่วคราวใหม่ {made} ภาพ · รวมการ์ดทั้งหมด {len(data["cards"])} ใบ')

# ---------- ภาพชั่วคราว (ลายมณฑลตามธาตุ ไม่มีตัวอักษร) ----------
PAL = {'ไฟ': ((26, 6, 4), (160, 40, 20), (246, 176, 74)), 'น้ำ': ((4, 12, 28), (24, 84, 140), (140, 210, 240)),
       'ดิน': ((18, 12, 4), (120, 78, 30), (232, 199, 102)), 'ลม': ((6, 20, 16), (40, 120, 96), (200, 240, 210)),
       'อากาศ': ((14, 6, 26), (92, 60, 160), (217, 206, 255))}
def placeholder(c, S=768):
    rnd = random.Random(c['id'])
    dark, mid, light = PAL.get(c['element'], PAL['อากาศ'])
    im = Image.new('RGB', (S, S), dark); px = im.load(); cx = cy = S / 2
    for y in range(S):
        for x in range(S):
            d = min(1, math.hypot(x - cx, y - cy * 0.9) / (S * 0.62))
            px[x, y] = tuple(int(mid[i] * (1 - d) + dark[i] * d) for i in range(3))
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); dr = ImageDraw.Draw(g)
    col = light + (150,); faint = light + (60,)
    n = rnd.choice([8, 12, 16])
    for k in range(n * 2):                                    # รัศมี
        a = k * math.pi / n; r1, r2 = S * 0.16, S * (0.46 if k % 2 else 0.40)
        dr.line([(cx + r1 * math.cos(a), cy + r1 * math.sin(a)), (cx + r2 * math.cos(a), cy + r2 * math.sin(a))], fill=faint, width=2)
    for k in range(n):                                        # กลีบบัว
        a = k * 2 * math.pi / n; r = S * 0.25
        pts = [(cx + S * 0.08 * math.cos(a + t) + r * math.cos(a) * s, cy + S * 0.08 * math.sin(a + t) + r * math.sin(a) * s) for t, s in ((-.5, .5), (0, 1.05), (.5, .5))]
        dr.polygon([(cx, cy)] + pts, outline=col, fill=light + (28,))
    for rr, w in ((0.47, 3), (0.43, 1), (0.30, 2), (0.14, 3), (0.09, 1)):
        dr.ellipse([cx - S * rr, cy - S * rr, cx + S * rr, cy + S * rr], outline=col, width=w)
    dr.ellipse([cx - S * 0.06, cy - S * 0.06, cx + S * 0.06, cy + S * 0.06], fill=light + (200,))
    for _ in range(70):                                       # ประกายไฟ
        x, y, r = rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(1, 3)
        dr.ellipse([x - r, y - r, x + r, y + r], fill=light + (rnd.randint(40, 160),))
    g = g.filter(ImageFilter.GaussianBlur(0.6))
    im = Image.alpha_composite(im.convert('RGBA'), g).convert('RGB')
    v = Image.new('L', (S, S), 0); ImageDraw.Draw(v).ellipse([-S * .15, -S * .15, S * 1.15, S * 1.15], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(S * 0.08))
    return Image.composite(im, Image.new('RGB', (S, S), dark), v)

if __name__ == '__main__':
    build()
