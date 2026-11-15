// node duel/rules.test.js — ทดสอบกติกาหลักตาม docs/tests.md
const fs = require('fs'), path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/siam_duel_cards.json'), 'utf8'));
const E = require('./engine.js').create(data), A = require('./ai.js');
let pass = 0, fail = 0; const T = (name, fn) => { try { fn(); pass++; console.log('✓', name); } catch (e) { fail++; console.log('✗', name, '—', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || ''} ได้ ${JSON.stringify(a)} ควรเป็น ${JSON.stringify(b)}`); };
const filler = Array(30).fill('SD093');
let H = 0;
function setup(seed) { const st = E.newGame({ seed: seed || 1, names: ['ก', 'ข'], decks: [filler, filler] }); E.apply(st, { t: 'mulligan', pid: 0, uids: [] }); E.apply(st, { t: 'mulligan', pid: 1, uids: [] });
  for (const p of st.players) { p.hand = []; p.units = [null, null, null, null, null]; p.slots = [null, null]; p.crypt = []; } st.turn = 1; st.rahuUntil = 0; st.rahuWas = false; return st; }
function put(st, pid, id, slot, picks, opts) { const cur = st.cur; st.cur = pid; const P = st.players[pid]; const uid = 'h' + (++H); P.hand.push({ uid, id }); P.akhom = 99; P.barami = 0;
  const r = E.apply(st, { t: 'play', pid, card: uid, slot: slot == null ? P.units.findIndex(x => !x) : slot, picks: picks || [] }); st.cur = cur;
  if (!r.ok) throw new Error('ลงการ์ดไม่ได้: ' + r.err); const u = slot != null ? P.units[slot] : P.units.filter(Boolean).slice(-1)[0];
  if (u && !(opts && opts.fresh)) u.played = -1; return u; }
const atk = (st, u, target) => { st.cur = u.owner; return E.apply(st, { t: 'attack', pid: u.owner, unit: u.uid, target }); };
const hp = (st, u) => E.hpOf(st, u), at = (st, u) => E.atkOf(st, u);

T('T01 เริ่มเกม 3/4+เบี้ย ดวงชะตา 30', () => { const st = E.newGame({ seed: 3, names: ['ก', 'ข'], decks: [filler, filler] });
  eq(st.players[st.cur].hand.length, 3); eq(st.players[1 - st.cur].hand.length, 5); eq(st.players[1 - st.cur].hand.some(c => c.id === 'TK_COIN'), true); eq(st.players[0].fate, 30); });
T('T02 mulligan จำนวนรวมเท่าเดิม', () => { const st = E.newGame({ seed: 4, names: ['ก', 'ข'], decks: [filler, filler] }); const p = st.cur, P = st.players[p];
  const tot = P.hand.length + P.deck.length; E.apply(st, { t: 'mulligan', pid: p, uids: P.hand.slice(0, 2).map(c => c.uid) }); eq(P.hand.length + P.deck.length, tot); });
T('T03 อาคมสูงสุด 10 · เหลือ 2 แปลงบารมี 2 · บารมีไม่เกิน 3', () => { const st = setup(); const P = st.players[st.cur]; P.akhomMax = 9; P.akhom = 2; P.barami = 0;
  const me = st.cur; E.apply(st, { t: 'end', pid: me }); eq(st.players[me].barami, 2); E.apply(st, { t: 'end', pid: st.cur }); eq(st.players[me].akhomMax, 10);
  st.players[me].akhom = 5; E.apply(st, { t: 'end', pid: me }); eq(st.players[me].barami, 3); });
T('T04 มือเต็มจั่วแล้วลงสุสาน', () => { const st = setup(); const p = 1 - st.cur; const P = st.players[p]; P.hand = Array(5).fill(0).map((_, i) => ({ uid: 'x' + i, id: 'SD093' })); P.turnsTaken = 1;
  E.apply(st, { t: 'end', pid: st.cur }); eq(P.hand.length, 5); eq(P.crypt.length, 1); });
T('T05 เด็คหมด 1+2+3', () => { const st = setup(); const p = 1 - st.cur, P = st.players[p]; P.deck = []; P.turnsTaken = 1; P.fate = 30;
  for (let i = 0; i < 3; i++) { E.apply(st, { t: 'end', pid: st.cur }); E.apply(st, { t: 'end', pid: st.cur }); } eq(P.fate, 24); });
T('T06 จัดเด็คผิดกติกาถูกปฏิเสธ', () => { eq(E.deckErrors(['SD001', 'SD002', ...Array(28).fill('SD093')]).length > 0, true); eq(E.deckErrors(A.DECKS.ghost.ids).length, 0); });
T('T07 ลงแล้วตีไม่ได้ ยกเว้นฮึกเหิม', () => { const st = setup(); const a = put(st, 0, 'SD093', 0, [], { fresh: true }); eq(atk(st, a, { player: 1 }).ok, false); const b = put(st, 0, 'SD097', 1, [], { fresh: true }); eq(atk(st, b, { player: 1 }).ok, true); });
T('T08 ทวารบาลต้องตีก่อน ยกเว้นเหาะเหิน', () => { const st = setup(); put(st, 1, 'SD093', 0); const a = put(st, 0, 'SD097', 0); eq(atk(st, a, { player: 1 }).ok, false); const f = put(st, 0, 'SD092', 1); eq(atk(st, f, { player: 1 }).ok, true); });
T('T09 น้ำ 4 ตีไฟ → 6 · ไฟ 3 ตอบ → 3', () => { const st = setup(); const w = put(st, 0, 'SD055', 0); /* ไกรทอง น้ำ 4/4 */ const f = put(st, 1, 'SD074', 0); /* ยักษ์กุมภัณฑ์ ไฟ 4/3 */
  f.php = 10; f.patk = -1; const h0 = hp(st, f), w0 = hp(st, w); atk(st, w, { uid: f.uid }); eq(h0 - hp(st, f), 6); eq(w0 - hp(st, w), 3); });
T('T11 กำบังเลือกเป็นเป้าไม่ได้ แต่โดน all · หายหลังโจมตี', () => { const st = setup(); const s = put(st, 1, 'SD078', 0); const a = put(st, 0, 'SD097', 0);
  eq(atk(st, a, { uid: s.uid }).ok, false); put(st, 0, 'SD035', 1); eq(st.players[1].units[0], null); });
T('T12 คงกระพันกันครั้งแรก · ดาบฟ้าฟื้นทะลุ', () => { const st = setup(); const t = put(st, 1, 'SD047', 0); t.php = 20; t.shroudOff = true; const a = put(st, 0, 'SD093', 0); a.php = 20; const h0 = hp(st, t);
  atk(st, a, { uid: t.uid }); eq(hp(st, t), h0); a.attacks = 0; atk(st, a, { uid: t.uid }); eq(hp(st, t) < h0, true);
  const t2 = put(st, 1, 'SD047', 1); t2.php = 20; t2.shroudOff = true; const b = put(st, 0, 'SD093', 1); put(st, 0, 'SD036', null, [b.uid]); const h1 = hp(st, t2); atk(st, b, { uid: t2.uid }); eq(hp(st, t2) < h1, true); });
T('T13 พิษ 2 ทำดาเมจ 2 ยามเช้าเจ้าของ 2 ครั้ง', () => { const st = setup(); st.cur = 0; const v = put(st, 1, 'SD093', 0); v.php = 20; const p = put(st, 0, 'SD041', 0); /* นางไม้ พิษ 2 */
  p.php = 20; v.patk = 0; st.cur = 1; E.apply(st, { t: 'attack', pid: 1, unit: v.uid, target: { uid: p.uid } }); const h = hp(st, v);
  st.cur = 1; E.apply(st, { t: 'end', pid: 1 }); E.apply(st, { t: 'end', pid: 0 }); eq(h - hp(st, v), 2); E.apply(st, { t: 'end', pid: 1 }); E.apply(st, { t: 'end', pid: 0 }); eq(h - hp(st, v), 4);
  E.apply(st, { t: 'end', pid: 1 }); E.apply(st, { t: 'end', pid: 0 }); eq(h - hp(st, v), 4); });
T('T14 อมตะกลับมา HP1 ครั้งเดียว · ส่งวิญญาณแล้วไม่กลับ', () => { const st = setup(); const g = put(st, 1, 'SD053', 0); g.dmg = 99; put(st, 0, 'SD093', 4);
  const u = st.players[1].units[0]; eq(!!u, true); eq(hp(st, u), 1); u.dmg = 5; put(st, 0, 'SD093', 3); eq(st.players[1].units[0], null);
  const g2 = put(st, 1, 'SD053', 1); put(st, 0, 'SD045', 1, [g2.uid]); eq(st.players[1].units[1], null); eq(st.players[1].purged.some(c => c.id === 'SD053'), true); });
T('T16 หม้อดินขังผียกเลิกปลุกพราย + ส่งวิญญาณ 3', () => { const st = setup(); st.turn = 5; st.players[1].slots[0] = { uid: 'tr', id: 'SD067', owner: 1, facedown: true, placed: 1, dmg: 0 };
  st.players[0].crypt = [{ id: 'SD080' }, { id: 'SD078' }, { id: 'SD088' }, { id: 'SD096' }]; st.cur = 0; const P = st.players[0]; P.hand.push({ uid: 'pp', id: 'SD066' }); P.akhom = 9;
  const r = E.apply(st, { t: 'play', pid: 0, card: 'pp', picks: ['0:0'] }); eq(r.ok, true); eq(P.units.filter(Boolean).length, 0); eq(P.purged.length, 3); });
T('T17 ทศกัณฐ์กลับมาเมื่อกล่องอยู่ · ทำลายกล่องแล้วตายจริง', () => { const st = setup(); const r = put(st, 1, 'SD013', 0); r.lost.push('อมตะ'); r.dmg = 99; put(st, 0, 'SD093', 0);
  eq(!!st.players[1].units[0], true); const box = st.players[1].slots.find(s => s && s.id === 'TK_HEARTBOX'); eq(!!box, true);
  const a = put(st, 0, 'SD097', 1); a.patk = 10; eq(atk(st, a, { slot: box.uid }).ok, true); eq(st.players[1].slots.some(s => s && s.id === 'TK_HEARTBOX'), false); st.players[1].units[0].dmg = 99; put(st, 0, 'SD093', 2); eq(st.players[1].units[0], null); });
T('T18 พระนารายณ์อวตาร 2 ครั้ง (+2/+2) ครั้งที่ 3 ตายจริง', () => { const st = setup(); const n = put(st, 1, 'SD002', 0); n.lost.push('คงกระพัน');
  for (let i = 0; i < 2; i++) { st.players[1].units[0].dmg = 99; put(st, 0, 'SD093', i); eq(!!st.players[1].units[0], true); }
  eq(at(st, st.players[1].units[0]), 9 + 4); st.players[1].units[0].dmg = 99; put(st, 0, 'SD093', 2); eq(st.players[1].units[0], null); });
T('T19 โทเคนตายไม่ลงสุสาน', () => { const st = setup(); put(st, 1, 'SD057', 0); const tk = st.players[1].units.find(u => u && u.id === 'TK_TAKHON'); tk.dmg = 9; put(st, 0, 'SD093', 0); eq(st.players[1].crypt.some(c => c.id === 'TK_TAKHON'), false); });
T('T21 ราหูเทิร์น 3–4: ผี +1 เทพ -1 พระราหูไม่ลด ผู้ปกครองคงที่', () => { const st = setup(); const g = put(st, 0, 'SD093', 0); const ghost = put(st, 0, 'SD096', 1); const deity = put(st, 0, 'SD022', 2); const ruler = put(st, 0, 'SD033', 3); const rahu = put(st, 0, 'SD016', 4); st.rahuUntil = 0; st.turn = 1;
  const a0 = [at(st, ghost), at(st, deity), at(st, ruler)]; st.turn = 3; eq([at(st, ghost), at(st, deity), at(st, ruler)], [a0[0] + 1, a0[1] - 1, a0[2]]); st.turn = 5; st.rahuUntil = 0; eq(at(st, ghost), a0[0]); });
T('T23 น้ำมันพรายใช้กับผู้ปกครอง/เทพไม่ได้', () => { const st = setup(); put(st, 1, 'SD033', 0); st.cur = 0; const P = st.players[0]; P.hand.push({ uid: 'oil', id: 'SD043' }); P.akhom = 9;
  eq(E.apply(st, { t: 'play', pid: 0, card: 'oil', picks: [] }).ok, false); });
T('T25 ตากสิน ดวงชะตา 10 ต้นทุน 5 · ทิ้ง 3 ใบ +3/+3 และฮึกเหิม', () => { const st = setup(); const P = st.players[0]; P.fate = 10; const a = put(st, 0, 'SD093', 0);
  P.hand = [{ uid: 'k', id: 'SD011' }, { uid: 'x1', id: 'SD093' }, { uid: 'x2', id: 'SD093' }, { uid: 'x3', id: 'SD093' }]; eq(E.costOf(st, 0, P.hand[0]), 5);
  st.cur = 0; P.akhom = 5; const a0 = at(st, a); eq(E.apply(st, { t: 'play', pid: 0, card: 'k', slot: 1, picks: [] }).ok, true); eq(at(st, a), a0 + 3); eq(E.kwOf(st, a).includes('ฮึกเหิม'), true); });
T('T26 ยุทธหัตถีปะทะจนตาย ผู้แพ้ถูกส่งวิญญาณ', () => { const st = setup(); const foe = put(st, 1, 'SD070', 0); put(st, 0, 'SD012', 0); eq(st.players[1].units[0], null); eq(st.players[1].purged.some(c => c.id === 'SD070'), true); });
T('T27 replay ได้ผลเหมือนเดิม', () => { const AI = A.create(E); const run = () => { const st = E.newGame({ seed: 77, names: ['ก', 'ข'], decks: [A.DECKS.lanka.ids, A.DECKS.himmapan.ids] }); const acts = [];
  for (const p of [0, 1]) { const a = { t: 'mulligan', pid: p, uids: [] }; E.apply(st, a); acts.push(a); } let n = 0; while (!st.over && n++ < 400) { const a = AI.decide(st, st.cur, 'normal'); acts.push(JSON.parse(JSON.stringify(a))); E.apply(st, a); } return { st, acts }; };
  const r1 = run(); const st2 = E.newGame({ seed: 77, names: ['ก', 'ข'], decks: [A.DECKS.lanka.ids, A.DECKS.himmapan.ids] }); for (const a of r1.acts) E.apply(st2, a); eq(JSON.stringify(st2), JSON.stringify(r1.st)); });
T('T28 view ซ่อนมือ เด็ค กับดักคว่ำของอีกฝ่าย', () => { const st = setup(); st.players[1].hand = [{ uid: 'a', id: 'SD001' }]; st.players[1].slots[0] = { uid: 't', id: 'SD086', owner: 1, facedown: true, placed: 1, dmg: 0 };
  const v = E.view(st, 0); eq(v.players[1].hand[0].id, null); eq(v.players[1].slots[0].id, undefined); eq(typeof v.players[1].deck, 'number'); });
console.log(`\nผ่าน ${pass} · ไม่ผ่าน ${fail}`); process.exit(fail ? 1 : 0);
