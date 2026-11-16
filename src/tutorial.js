/* ---------- สอนเล่นแบบจับมือ 8 บท (หมอผีเฒ่า) ---------- */
const TUT_REWARD = { 1: 'โกลด์ ๕๐๐', 2: 'โกลด์ ๕๐๐', 3: 'การ์ดหายาก ๑ ใบ', 4: 'โกลด์ ๑,๐๐๐', 5: 'การ์ดมหากาพย์ ๑ ใบ', 6: 'โกลด์ ๑,๐๐๐', 7: 'โกลด์ ๑,๐๐๐', 8: 'โกลด์ ๑,๐๐๐ (เท่าสุ่ม ๑๐ ครั้ง)' };
const TUT_LOCAL = { 1: { gold: 500 }, 2: { gold: 500 }, 3: { rarity: 'rare' }, 4: { gold: 1000 }, 5: { rarity: 'epic' }, 6: { gold: 1000 }, 7: { gold: 1000 }, 8: { gold: 1000 } };
const FILL = Array(30).fill('SD093');
const q = s => document.querySelector(s);
const F = {
  hand: id => q(`#dHand .hcard[data-cid="${id}"]`),
  unit: (side, id) => [...document.querySelectorAll(`#dBoard .dslot.u[data-side="${side}"] .dunit[data-cid="${id}"]`)][0],
  opp: () => q('#dOpp'), me: () => q('#dMe'), res: () => q('#dMe .res'), end: () => q('#dEnd'), hand0: () => q('#dHand'),
  moon: () => q('#dBoard .dmoon'), crypt: () => q('#dMe [data-crypt]'), trapRow: () => q('#dBoard .dslot.t:nth-last-of-type(1)'),
};
const n2 = id => DE.D(id).name_th;
const TCH = [
  null,
  { title: 'ลงการ์ดใบแรก', learn: 'อาคม ต้นทุน และการลงยูนิต',
    setup: S => { S.me({ akhomMax: 1, akhom: 1 }); S.hand(['SD097', 'SD093']); },
    steps: [
      { say: 'ยินดีต้อนรับสู่กระดานชนวน เจ้าหนู ข้าจะสอนเจ้าทีละขั้น ด้านล่าง (หรือด้านขวา) คือ <b>ไพ่ในมือ</b> ตัวเลขในวงกลมมุมซ้ายบนของการ์ดคือ <b>ต้นทุน</b>', focus: F.hand0, next: 1 },
      { say: 'เพชรสีฟ้า ◆ คือ <b>อาคม</b> ใช้จ่ายค่าการ์ด ทุกเทิร์นอาคมสูงสุดเพิ่มขึ้น ๑ (สูงสุด ๑๐) และเติมเต็มใหม่ ตอนนี้เจ้ามีอาคม ๑', focus: F.res, next: 1 },
      { say: `แตะ <b>${n2('SD097')}</b> (ต้นทุน ๑) แล้วแตะช่องว่างบนกระดานแถวล่าง ซึ่งเป็นฝั่งของเจ้า`, focus: () => F.hand('SD097'), expect: { t: 'play', id: 'SD097' },
        wrong: { SD093: `ยังไม่ได้ — ${n2('SD093')} ต้นทุน ๒ แต่เจ้ามีอาคมแค่ ๑ (อาคมไม่พอ) เลือกใบที่ต้นทุน ๑` } },
      { say: 'ถูกต้อง! ยูนิตลงสนามแล้ว ปกติยูนิตที่เพิ่งลงต้องรอเทิร์นหน้าจึงโจมตีได้ แต่ใบนี้มีคีย์เวิร์ด <b>ฮึกเหิม</b> จึงโจมตีได้ทันที ไว้บทหน้าข้าจะสอนโจมตี', next: 1 },
      { say: 'อาคมหมดแล้ว กด <b>จบเทิร์น</b> ได้เลย อาคมที่เหลือตอนจบเทิร์นจะกลายเป็น <b>บารมี</b> ● (เก็บได้สูงสุด ๓) ไว้ใช้กับคาถา กับดัก และของขลัง', focus: F.end, expect: { t: 'end' } },
    ] },
  { title: 'โจมตี', learn: 'เลือกผู้โจมตี เลือกเป้า ATK/HP',
    setup: S => { S.me({ akhomMax: 2, akhom: 2 }); S.unit(0, 'SD050', 1); S.unit(1, 'SD094', 2); S.hand(['SD093']); },
    steps: [
      { say: `ยูนิตทุกตัวมีวงกลม<b>แดง = ATK</b> (พลังโจมตี) และ<b>เขียว = HP</b> (พลังชีวิต) ${n2('SD050')} ของเจ้าพร้อมรบแล้ว (เรืองเขียว)`, focus: () => F.unit(0, 'SD050'), next: 1 },
      { say: `ลง <b>${n2('SD093')}</b> ก่อน`, focus: () => F.hand('SD093'), expect: { t: 'play', id: 'SD093' } },
      { say: `ลองแตะ ${n2('SD093')} ที่เพิ่งลงเพื่อสั่งโจมตีดูสิ`, focus: () => F.unit(0, 'SD093'), expect: { t: 'try', id: 'SD093' } },
      { say: 'เห็นไหม — <b>ยูนิตที่เพิ่งลงต้องรอเทิร์นหน้า</b> (ยกเว้นฮึกเหิม) ทีนี้แตะ ' + n2('SD050') + ' แล้วแตะยูนิตศัตรู ' + n2('SD094'), focus: () => F.unit(0, 'SD050'), expect: { t: 'attack', from: 'SD050', to: 'SD094' },
        wrong: { player: 'ลองตียูนิตศัตรูก่อน เพื่อดูการปะทะกัน' } },
      { say: 'ถูกต้อง! เมื่อยูนิตปะทะกัน <b>ทั้งสองฝ่ายทำดาเมจใส่กันพร้อมกัน</b> เท่ากับ ATK ของตน HP เหลือ ๐ คือตาย ลงสุสาน ยูนิตแต่ละตัวโจมตีได้เทิร์นละ ๑ ครั้ง', next: 1 },
      { say: 'กด <b>จบเทิร์น</b>', focus: F.end, expect: { t: 'end' } },
    ] },
  { title: 'ทวารบาลและเหาะเหิน', learn: 'ต้องตีทวารบาลก่อน เหาะเหินบินข้ามได้',
    setup: S => { S.me({ akhomMax: 3, akhom: 0 }); S.unit(0, 'SD091', 1); S.unit(0, 'SD092', 3); S.unit(1, 'SD072', 2); S.opp({ fate: 30 }); },
    steps: [
      { say: `ศัตรูมี <b>${n2('SD072')}</b> ที่มีคีย์เวิร์ด <b>ทวารบาล</b> ตราบที่ทวารบาลยังยืนอยู่ เจ้าต้องโจมตีมันก่อน จะข้ามไปตียูนิตอื่นหรือดวงชะตาไม่ได้`, focus: () => F.unit(1, 'SD072'), next: 1 },
      { say: `แต่ <b>${n2('SD092')}</b> มี <b>เหาะเหิน</b> บินข้ามทวารบาลได้ แตะมัน แล้วแตะ<b>กรอบหมอผีเฒ่าด้านบน</b> เพื่อโจมตีดวงชะตาโดยตรง`, focus: () => F.unit(0, 'SD092'), expect: { t: 'attack', from: 'SD092', to: 'player' },
        wrong: { SD091: `${n2('SD091')} บินไม่ได้ ต้องตีทวารบาลก่อน ลองใช้ ${n2('SD092')}`, SD072: 'ตีดวงชะตาศัตรูดีกว่า เพราะยูนิตนี้บินข้ามได้' } },
      { say: `ถูกต้อง! ดวงชะตาของศัตรูลดลง ใครดวงชะตาเหลือ ๐ ก่อนคือแพ้ ทีนี้แตะ ${n2('SD091')} ซึ่งบินไม่ได้ — สังเกตว่ากรอบศัตรูไม่ขึ้นเป็นเป้า มีแค่ทวารบาลให้ตี`, focus: () => F.unit(0, 'SD091'), expect: { t: 'attack', from: 'SD091', to: 'SD072' } },
      { say: 'นี่แหละทวารบาล กำแพงของทัพ ถ้าจะเจาะเข้าไป ต้องทลายทวารบาลก่อน หรือใช้ตัวที่บินได้ กด <b>จบเทิร์น</b>', focus: F.end, expect: { t: 'end' } },
    ] },
  { title: 'ธาตุ', learn: 'น้ำ > ไฟ > ดิน > ลม > น้ำ ×๑.๕',
    setup: S => { S.me({ akhomMax: 4, akhom: 0 }); S.unit(0, 'SD055', 1); S.unit(0, 'SD054', 3); const e = S.unit(1, 'SD074', 2); e.php = 3; e.patk = -1; },
    steps: [
      { say: 'การ์ดทุกใบมี<b>ธาตุ</b> (ไอคอนบนการ์ด) วงจรคือ <b>น้ำ ชนะ ไฟ · ไฟ ชนะ ดิน · ดิน ชนะ ลม · ลม ชนะ น้ำ</b> ฝ่ายที่ชนะทำดาเมจ <b>×๑.๕</b> (ปัดลง) ส่วนธาตุอากาศเป็นกลาง ใช้เฉพาะตอนปะทะกัน', next: 1 },
      { say: `ศัตรู ${n2('SD074')} เป็นธาตุ<b>ไฟ</b> HP ๖ เจ้ามี ${n2('SD055')} (น้ำ ATK ๔) และ ${n2('SD054')} (ดิน ATK ๔) เลือกตัวที่ฆ่ามันได้ในทีเดียว`, focus: () => F.unit(1, 'SD074'), expect: { t: 'attack', from: 'SD055', to: 'SD074' },
        wrong: { SD054: `ดินแพ้ไฟ! ${n2('SD054')} จะทำดาเมจแค่ ๔ และโดนสวนแรงขึ้นเป็น ๖ ลองใช้ ${n2('SD055')} ธาตุน้ำ` } },
      { say: 'ถูกต้อง! น้ำชนะไฟ ATK ๔ × ๑.๕ = <b>๖</b> พอดี HP ศัตรู ฆ่าได้ในทีเดียว ก่อนโจมตีให้ดูธาตุทุกครั้ง', next: 1 },
      { say: 'กด <b>จบเทิร์น</b>', focus: F.end, expect: { t: 'end' } },
    ] },
  { title: 'คาถา ของขลัง กับดัก', learn: 'ใช้คาถา ติดของขลัง คว่ำกับดัก บารมี',
    setup: S => { S.me({ akhomMax: 6, akhom: 6, barami: 3 }); S.unit(0, 'SD050', 2); S.unit(1, 'SD033', 1); S.unit(1, 'SD070', 3); S.hand(['SD084', 'SD043', 'SD086']); },
    steps: [
      { say: 'นอกจากยูนิต ยังมี<b>คาถา</b> (ใช้แล้วลงสุสาน) <b>ของขลัง</b> (ติดยูนิต หรือตั้งในช่องของขลัง) และ<b>กับดัก</b> (คว่ำไว้ ทำงานเองเมื่อเงื่อนไขเกิด) สามแบบนี้จ่ายด้วย<b>บารมี ●</b> ได้ก่อน แล้วค่อยใช้อาคม', focus: F.res, next: 1 },
      { say: `แตะ <b>${n2('SD084')}</b> แล้วแตะ ${n2('SD050')} เพื่อติดของขลัง ยูนิตจะได้ <b>คงกระพัน</b> (กันดาเมจครั้งแรกได้ ๑ ครั้ง)`, focus: () => F.hand('SD084'), expect: { t: 'play', id: 'SD084' } },
      { say: `ต่อไป <b>${n2('SD043')}</b> — ขโมยยูนิตศัตรูต้นทุนไม่เกิน ๕ มาเป็นของเรา สังเกตว่า ${n2('SD033')} จะ<b>ไม่เรืองแสงให้เลือก</b> เพราะผู้ปกครองและเทพเป็นเป้าของคาถานี้ไม่ได้ แตะการ์ด แล้วแตะ ${n2('SD070')}`, focus: () => F.hand('SD043'), expect: { t: 'play', id: 'SD043' } },
      { say: `ถูกต้อง! ${n2('SD070')} ย้ายมาอยู่ฝั่งเจ้าแล้ว สุดท้ายแตะ <b>${n2('SD086')}</b> เพื่อคว่ำกับดักไว้ในช่องกับดักแถวล่างสุด`, focus: () => F.hand('SD086'), expect: { t: 'play', id: 'SD086' } },
      { say: 'กับดักคว่ำอยู่ ศัตรูมองไม่เห็นว่าเป็นอะไร มันจะทำงานเองในเทิร์นศัตรู (ไม่ทำงานในเทิร์นที่วาง) ใบนี้ทำลายผีต้นทุนไม่เกิน ๔ ที่บุกเข้ามา กด <b>จบเทิร์น</b>', focus: F.end, expect: { t: 'end' } },
    ] },
  { title: 'ตายและชุบชีวิต', learn: 'สุสาน ปลุกพราย อมตะ ส่งวิญญาณ',
    setup: S => { S.me({ akhomMax: 7, akhom: 7, barami: 0 }); S.crypt(0, ['SD078']); S.unit(0, 'SD038', 0); S.unit(1, 'SD053', 2); S.hand(['SD066', 'SD045']); },
    steps: [
      { say: 'ยูนิตที่ตายจะไปอยู่ใน<b>สุสาน</b> กดปุ่ม "สุสาน" ดูได้ตลอด และการ์ดบางใบ<b>ชุบชีวิต</b>จากสุสานได้', focus: F.crypt, next: 1 },
      { say: `ใช้คาถา <b>${n2('SD066')}</b> ชุบชีวิตผีในสุสานของเจ้า แล้วเลือกการ์ดที่จะปลุก`, focus: () => F.hand('SD066'), expect: { t: 'play', id: 'SD066' } },
      { say: `ผีกลับมาแล้ว! ทีนี้ดูศัตรู <b>${n2('SD053')}</b> มีคีย์เวิร์ด <b>อมตะ</b> — ตายครั้งแรกจะลุกกลับมาด้วย HP ๑ ลองใช้ ${n2('SD038')} ตีมัน`, focus: () => F.unit(0, 'SD038'), expect: { t: 'attack', from: 'SD038', to: 'SD053' } },
      { say: 'เห็นไหม มันลุกขึ้นมาอีก (อมตะใช้ได้ครั้งเดียว) วิธีกำจัดให้สิ้นซากคือ <b>ส่งวิญญาณ</b> — การ์ดที่ถูกส่งวิญญาณไม่ลงสุสาน ไม่กลับมา และชุบชีวิตไม่ได้อีก', next: 1 },
      { say: `ลง <b>${n2('SD045')}</b> ปลุกเสกจับผีใส่หม้อดิน (ส่งวิญญาณ) แล้วเลือก ${n2('SD053')}`, focus: () => F.hand('SD045'), expect: { t: 'play', id: 'SD045' } },
      { say: 'ถูกต้อง! ผีตนนั้นหายไปตลอดกาล จำไว้ว่า <b>คำว่า "ทำลาย" ยังโดนอมตะ ชุบชีวิต และกลไกสิ้นใจได้ แต่ "ส่งวิญญาณ" จบเลย</b> กด <b>จบเทิร์น</b>', focus: F.end, expect: { t: 'end' } },
    ] },
  { title: 'ราหูอมจันทร์', learn: 'ทุกเทิร์นที่ ๓ ๖ ๙ … ผีแรงขึ้น เทพอ่อนลง',
    setup: S => { S.turn(2); S.me({ akhomMax: 2, akhom: 0 }); S.unit(0, 'SD061', 2); S.unit(1, 'SD070', 2); },
    steps: [
      { say: 'ดวงจันทร์กลางกระดานคือนาฬิกา<b>ราหูอมจันทร์</b> เริ่มที่เทิร์น ๓ ๖ ๙ … แต่ละครั้งกินเวลา ๒ เทิร์น (ของเราและของศัตรู) ระหว่างนั้น <b>ผี +๑ ATK · เทพ −๑ ATK · ผู้ปกครองไม่เปลี่ยน</b> และการ์ดบางใบมีพลังพิเศษตอนราหู', focus: F.moon, next: 1 },
      { say: `${n2('SD061')} ของเจ้า ATK ๓ ยังฆ่า ${n2('SD070')} (HP ๖) ไม่ได้ อดใจรอราหูก่อน กด <b>จบเทิร์น</b>`, focus: F.end, expect: { t: 'end' },
        wrong: { SD061: 'ยังไม่ถึงเวลา รอให้ราหูอมจันทร์ก่อน กดจบเทิร์น' } },
      { say: `ราหูมาแล้ว! ${n2('SD061')} เป็นผี <b>+๑ ATK</b> และพลังพิเศษตอนราหูอีก <b>+๒</b> รวม ATK ๖ ทีนี้ตี ${n2('SD070')} ได้เลย`, focus: () => F.unit(0, 'SD061'), expect: { t: 'attack', from: 'SD061', to: 'SD070' },
        wrong: { player: 'ลองกำจัดยูนิตศัตรูด้วยพลังราหู' } },
      { say: 'ถูกต้อง! การวางแผนรอราหูก่อนบุก คือหัวใจของทัพผี ส่วนทัพเทพควรรีบชิงจังหวะก่อนราหูมา กด <b>จบเทิร์น</b>', focus: F.end, expect: { t: 'end' } },
    ] },
  { title: 'ดวลจริงครั้งแรก', learn: 'ดวลเต็มเกมกับ AI ง่าย มีคำแนะนำ', full: true, steps: [] },
];

let TUT = null;   // { ch, i, hint, done }
function tutDone() { const u = me(); return (u && u.tut) || []; }
function openTutorialList() {
  const m = document.getElementById('modal'), b = document.getElementById('modalBox'), done = tutDone();
  b.innerHTML = `<div class="dsetup"><h3>บทเรียนกับหมอผีเฒ่า</h3><p style="color:var(--muted);font-size:13px">เรียนทีละบท ดวลจริงบนกระดาน ทำผิดได้ไม่เสียอะไร จบแต่ละบทรับรางวัล (ครั้งแรกครั้งเดียว) · อ่านกติกาละเอียดได้ที่ <a href="wiki.html" target="_blank" rel="noopener" style="color:var(--gold2)">คู่มือ Wiki</a></p>
    <div class="opts tutlist">${TCH.slice(1).map((c, i) => { const n = i + 1, ok = done.includes(n); return `<button class="opt ${ok ? 'on' : ''}" data-ch="${n}"><b>บทที่ ${TH(n)} ${c.title}</b>${ok ? ' ✓' : ''}<small>${c.learn}</small><small>รางวัล: ${TUT_REWARD[n]}${ok ? ' (รับแล้ว)' : ''}</small></button>`; }).join('')}</div>
    <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:10px"><button class="btn ghost" id="tlX">ปิด</button></div></div>`;
  b.querySelectorAll('[data-ch]').forEach(x => x.onclick = () => { m.classList.remove('on'); startTutorial(+x.dataset.ch); });
  b.querySelector('#tlX').onclick = () => m.classList.remove('on');
  m.classList.add('on');
}
function startTutorial(ch) {
  const C = TCH[ch];
  if (C.full) { TUT = { ch, i: 0, hint: true }; DSET.level = 'easy'; const st0 = SiamAI.DECKS.ayutthaya.ids; startDuel(st0); return; }
  const u = me();
  const st = DE.newGame({ seed: 4242 + ch, names: [u.name || 'ผู้เล่น', 'หมอผีเฒ่า'], decks: [FILL, FILL] });
  DE.apply(st, { t: 'mulligan', pid: 0, uids: [] }); DE.apply(st, { t: 'mulligan', pid: 1, uids: [] });
  st.cur = 0; st.turn = 1; st.rahuUntil = 0; st.rahuWas = false; st.over = null;
  for (const P of st.players) { P.hand = []; P.units = [null, null, null, null, null]; P.slots = [null, null]; P.crypt = []; P.purged = []; P.fate = 30; P.akhom = 0; P.akhomMax = 0; P.barami = 0; P.turnsTaken = 3; }
  let hu = 0;
  const S = {
    me: o => Object.assign(st.players[0], o), opp: o => Object.assign(st.players[1], o), turn: t => { st.turn = t; },
    hand: ids => { st.players[0].hand = ids.map(id => ({ uid: 'th' + (++hu), id })); },
    crypt: (p, ids) => { st.players[p].crypt = ids.map(id => ({ id })); },
    unit: (p, id, slot) => { const P = st.players[p], keep = { akhom: P.akhom, hand: P.hand, cur: st.cur }; st.cur = p; P.akhom = 99; P.hand = [{ uid: 'tu' + (++hu), id }];
      DE.apply(st, { t: 'play', pid: p, card: P.hand[0].uid, slot, picks: [] }); const un = P.units[slot]; un.played = -1; P.akhom = keep.akhom; P.hand = keep.hand; st.cur = keep.cur; return un; },
  };
  C.setup(S); st.log = []; st.fx = [];
  st.log.push({ t: st.turn, text: `บทที่ ${ch}: ${C.title}`, kind: 'turn' });
  TUT = { ch, i: 0 };
  setSide(0); DS = { mode: 'ai', st, level: 'easy', aiDeck: 'บทเรียน', mull: new Set() }; dSel = null; dBusy = false; dPrevMap = {};
  show('duel'); document.getElementById('dOver').classList.remove('on'); renderDuel();
}
const tutStep = () => TUT && !TCH[TUT.ch].full ? TCH[TUT.ch].steps[TUT.i] : null;
function tutSay(msg, bad) { const t = document.getElementById('tutText'); if (!t) return; t.innerHTML = msg; const box = document.getElementById('tutBox');
  if (bad) { box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad'); clearTimeout(tutSay._t); tutSay._t = setTimeout(() => { box.classList.remove('bad'); }, 4000); } }
function tutWrong(key, fallback) { const s = tutStep(); if (!s) return; const w = (s.wrong && s.wrong[key]) || fallback || (s.next ? 'กด "ต่อไป" ก่อนนะ' : 'ยังไม่ใช่ ลองทำตามที่ข้าบอก'); tutSay(`<span class="nope">ยังไม่ถูก</span> ${w}<br><small>${s.say}</small>`, true); }
function tutAdvance() {
  TUT.i++;
  if (TUT.i >= TCH[TUT.ch].steps.length) return tutComplete();
  renderDuel();
}
/* hooks จาก duel_ui (คืน true = อนุญาต) */
function tutAllowCard(c) { if (!TUT || TCH[TUT.ch].full) return true; const s = tutStep(); if (s && s.expect && s.expect.t === 'play' && s.expect.id === c.id) return true; tutWrong(c.id); return false; }
function tutAllowAttacker(u) { if (!TUT || TCH[TUT.ch].full) return true; const s = tutStep(); if (s && s.expect && s.expect.t === 'attack' && s.expect.from === u.id) return true;
  if (s && s.expect && s.expect.t === 'try' && s.expect.id === u.id) return true; tutWrong(u.id); return false; }
function tutTry(u, why) { if (!TUT || TCH[TUT.ch].full) return false; const s = tutStep(); if (s && s.expect && s.expect.t === 'try' && s.expect.id === u.id) { tutAdvance(); return true; } return false; }
function tutAllowTarget(attUid, target) { if (!TUT || TCH[TUT.ch].full) return true; const s = tutStep(); if (!s || !s.expect || s.expect.t !== 'attack') return false;
  if (s.expect.to === 'player') { if (target.player != null) return true; const u = findU(target.uid); tutWrong(u ? u.id : 'x'); return false; }
  const u = target.uid && findU(target.uid); if (u && u.id === s.expect.to) return true; tutWrong(target.player != null ? 'player' : (u ? u.id : 'x')); return false; }
function tutAllowEnd() { if (!TUT || TCH[TUT.ch].full) return true; const s = tutStep(); if (s && s.expect && s.expect.t === 'end') return true; tutWrong('end', s && s.next ? 'กด "ต่อไป" ก่อนนะ' : 'ยังไม่จบเทิร์น ทำตามขั้นนี้ให้เสร็จก่อน'); return false; }
function tutOnAction(a) { if (!TUT || TCH[TUT.ch].full) return; const s = tutStep(); if (!s || !s.expect) return; const e = s.expect;
  if (e.t === 'play' && a.t === 'play') tutAdvance();
  else if (e.t === 'attack' && a.t === 'attack') tutAdvance();
  else if (e.t === 'end' && a.t === 'end') { TUT.waitTurn = true; } }
function tutOppTurnDone() { if (TUT && TUT.waitTurn) { TUT.waitTurn = false; tutAdvance(); } }
function findU(uid) { for (const P of DS.st.players) for (const u of P.units) if (u && u.uid === uid) return u; return null; }
async function tutComplete() {
  const ch = TUT.ch; TUT.done = true; renderDuel();
  const got = await tutClaim(ch);
  const m = document.getElementById('modal'), b = document.getElementById('modalBox'), nx = ch < 8 ? ch + 1 : null;
  b.innerHTML = `<h3>จบบทที่ ${TH(ch)}: ${TCH[ch].title}</h3><p>${got}</p>${nx ? `<p>บทต่อไป: <b>${TCH[nx].title}</b> — ${TCH[nx].learn}</p>` : '<p>เจ้าผ่านบทเรียนครบแล้ว! ไปดวลกับหมอผีเฒ่าระดับปกติ หรือจัดเด็คของตัวเองในห้องพักได้เลย</p>'}
    <div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap"><button class="btn ghost" id="tcL">รายการบทเรียน</button><button class="btn ghost" id="tcH">กลับหน้าแรก</button>${nx ? '<button class="btn" id="tcN">บทต่อไป</button>' : ''}</div>`;
  m.classList.add('on');
  b.querySelector('#tcL').onclick = () => { m.classList.remove('on'); TUT = null; openTutorialList(); };
  b.querySelector('#tcH').onclick = () => { m.classList.remove('on'); TUT = null; show('home'); };
  if (nx) b.querySelector('#tcN').onclick = () => { m.classList.remove('on'); startTutorial(nx); };
}
async function tutClaim(ch) {
  const u = me(); u.tut = u.tut || [];
  if (u.tut.includes(ch)) return 'รางวัลบทนี้รับไปแล้ว';
  if (ONLINE) {
    const { data, error } = await sb.rpc('tutorial_claim', { p_ch: ch });
    if (error) return 'ยังรับรางวัลไม่ได้: ' + thErr(error) + (String(error.message).includes('function') ? ' (แอดมินต้องรัน supabase/002_tutorial.sql)' : '');
    u.tut.push(ch); if (data.gold != null) u.gold = data.gold; if (data.card) u.cards.push(inst({ id: data.card.row, card_id: data.card.id, serial: null }));
    return `ได้รับ ${TUT_REWARD[ch]}${data.card ? ': ' + BY[data.card.id].name_th : ''}`;
  }
  const r = TUT_LOCAL[ch]; let extra = '';
  if (r.gold) u.gold += r.gold;
  if (r.rarity) { const pool = CARDS.filter(c => c.rarity_code === r.rarity); const c = pool[Math.floor(Math.random() * pool.length)]; u.cards.push({ id: c.id, at: Date.now() }); extra = ': ' + c.name_th; }
  u.tut.push(ch); save(); return `ได้รับ ${TUT_REWARD[ch]}${extra}`;
}
/* วาดกล่องคำพูด + สปอตไลต์ */
let tutHintKey = '';
function tutPaint() {
  let box = document.getElementById('tutBox'), spot = document.getElementById('tutSpot');
  if (!TUT || !document.getElementById('duel').classList.contains('on')) { if (box) box.remove(); if (spot) spot.remove(); return; }
  const mobile = matchMedia('(max-width:900px),(orientation:portrait)').matches, host = mobile ? document.getElementById('duel') : document.getElementById('dMid');
  if (!box || box.parentElement !== host) { if (box) box.remove(); box = document.createElement('div'); box.id = 'tutBox'; box.className = 'tutbox';
    box.innerHTML = `<div class="tb"></div><div class="tx"><div class="who">หมอผีเฒ่า · บทที่ <span id="tutCh"></span></div><p id="tutText"></p><div class="tbtn"></div></div>`;
    box.querySelector('.tb').appendChild(charImg('npc_shaman', 'bust', 'หมอผีเฒ่า')); host.prepend(box); }
  if (!spot) { spot = document.createElement('div'); spot.id = 'tutSpot'; spot.className = 'tutspot'; spot.innerHTML = '<i>👆</i>'; document.getElementById('duel').appendChild(spot); }
  document.getElementById('tutCh').textContent = TH(TUT.ch) + ' ' + TCH[TUT.ch].title;
  const btns = box.querySelector('.tbtn'); btns.innerHTML = '';
  const add = (t, fn, cls) => { const b = document.createElement('button'); b.className = 'btn ' + (cls || ''); b.textContent = t; b.onclick = fn; btns.appendChild(b); };
  let focusEl = null, text = '';
  if (TCH[TUT.ch].full) {
    const st = DS.st;
    if (st.over) text = st.over.winner === 0 ? 'ชนะแล้ว! เจ้าพร้อมออกศึกจริงแล้ว' : 'ไม่เป็นไร ลองใหม่อีกครั้ง ดูคำแนะนำของข้าให้ดี';
    else if (st.phase !== 'main') text = 'เลือกเปลี่ยนไพ่ที่ต้นทุนสูงเกินไปสำหรับช่วงต้นเกม แล้วเริ่มดวล';
    else if (st.cur !== 0 || dBusy) text = 'เทิร์นของข้า ดูว่าข้าทำอะไร แล้วคิดหาทางรับมือ';
    else if (!TUT.hint) text = 'คำแนะนำปิดอยู่ เล่นตามใจเจ้าได้เลย';
    else { const key = st.log.length + ':' + st.players[0].hand.length + ':' + st.players[0].akhom;
      if (key !== tutHintKey) { tutHintKey = key; TUT.sug = DAI.decide(DE.clone(st), 0, 'normal'); }
      const a = TUT.sug; const P = st.players[0];
      if (a.t === 'play') { const c = P.hand.find(x => x.uid === a.card); text = c ? `คำแนะนำ: ลง <b>${n2(c.id)}</b>` : ''; focusEl = c ? F.hand(c.id) : null; }
      else if (a.t === 'attack') { const u = findU(a.unit), t = a.target.uid ? findU(a.target.uid) : null; text = u ? `คำแนะนำ: ให้ <b>${n2(u.id)}</b> โจมตี ${t ? '<b>' + n2(t.id) + '</b>' : 'ดวงชะตาศัตรู'}` : ''; focusEl = u ? F.unit(0, u.id) : null; }
      else { text = 'คำแนะนำ: ทำเท่าที่คุ้มแล้ว กด <b>จบเทิร์น</b>'; focusEl = F.end(); }
      if (dSel) focusEl = null; }
    add(TUT.hint ? 'ปิดคำแนะนำ' : 'เปิดคำแนะนำ', () => { TUT.hint = !TUT.hint; renderDuel(); }, 'ghost');
  } else {
    const s = tutStep();
    if (TUT.done) text = 'จบบทเรียนแล้ว';
    else if (s) {
      text = s.say;
      if (TUT.waitTurn) text = 'รอศัตรูเล่นเทิร์นของมันก่อน…';
      if (s.next) add('ต่อไป', () => tutAdvance());
      focusEl = s.focus ? s.focus() : null;
      if (dSel && dSel.kind === 'play') focusEl = q('#dBoard .dslot.can') || q('#dBoard .dslot.tgt') || focusEl;
      if (dSel && dSel.kind === 'atk' && s.expect && s.expect.t === 'attack') focusEl = s.expect.to === 'player' ? F.opp() : (F.unit(1, s.expect.to) || focusEl);
    }
  }
  add('ออกจากบทเรียน', () => { TUT = null; dSel = null; show('home'); tutPaint(); }, 'ghost');
  const t = document.getElementById('tutText'); if (!box.classList.contains('bad') || !t.innerHTML) t.innerHTML = text;
  if (focusEl) { const r = focusEl.getBoundingClientRect(), pad = 6; Object.assign(spot.style, { display: 'block', left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    spot.classList.toggle('up', r.top < 120); }
  else spot.style.display = 'none';
  if (mobile) { const fr = focusEl && focusEl.getBoundingClientRect(); box.classList.toggle('low', !!fr && fr.top < innerHeight * 0.42); }
}
