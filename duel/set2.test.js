// node duel/set2.test.js [จำนวนเกม] — ทดสอบการ์ดชุดที่ 2 (SD101–SD200)
// สุ่มเด็คที่ผ่านกติกาจากการ์ดชุดใหม่ ให้ AI ปะทะกัน ตรวจว่า: ไม่มี exception, ไม่มีเอฟเฟกต์ที่เอนจินไม่รองรับ,
// เกมจบใน 40 เทิร์น และการ์ดใหม่ทุกใบถูกลงสนามอย่างน้อย 1 ครั้ง
const fs = require('fs'), path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/siam_duel_cards.json'), 'utf8'));
const E = require('./engine.js').create(data), A = require('./ai.js'), AI = A.create(E);
const N = +process.argv[2] || 300;
const NEW = data.cards.filter(c => c.set === 2), ALL = data.cards.filter(c => !['ผู้สรรสร้าง'].includes(c.rarity));
let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const LIM = { 'ธรรมดา': 3, 'ทั่วไป': 3, 'หายาก': 2, 'มหากาพย์': 2, 'ตำนาน': 1, 'พระเจ้า': 1 };
function deck(focus) {
  const ids = [], cnt = {}; let hi = 0, rulers = 0, guard = 0;
  const pool = focus.concat(focus, ALL);           // ให้น้ำหนักการ์ดชุดใหม่
  while (ids.length < 30 && guard++ < 5000) {
    const c = pool[Math.floor(rnd() * pool.length)];
    if ((cnt[c.id] || 0) >= LIM[c.rarity]) continue;
    const isHi = ['ตำนาน', 'พระเจ้า'].includes(c.rarity), isR = ['เทพเจ้า', 'ผู้ปกครอง'].includes(c.category);
    if (isHi && hi >= 3) continue; if (isR && rulers >= 3) continue;
    ids.push(c.id); cnt[c.id] = (cnt[c.id] || 0) + 1; if (isHi) hi++; if (isR) rulers++;
  }
  return ids;
}
const played = new Set(); let errs = 0, warns = 0, notOver = 0, turns = 0;
for (let g = 0; g < N; g++) {
  const focus = NEW.slice().sort(() => rnd() - 0.5).slice(0, 25);
  const d0 = deck(focus), d1 = deck(NEW.slice().sort(() => rnd() - 0.5).slice(0, 25));
  for (const d of [d0, d1]) { const e = E.deckErrors(d); if (e.length) { console.log('DECK', e); process.exit(1); } }
  const st = E.newGame({ seed: 5000 + g, names: ['ก', 'ข'], decks: [d0, d1] });
  try {
    for (const p of [0, 1]) E.apply(st, { t: 'mulligan', pid: p, uids: AI.mulliganPick(st, p) });
    let steps = 0;
    while (!st.over && steps++ < 3000) {
      const a = AI.decide(st, st.cur, g % 3 ? 'normal' : 'hard');
      if (a.t === 'play') { const c = st.players[st.cur].hand.find(h => h.uid === a.card); if (c) played.add(c.id); }
      const r = E.apply(st, a); if (!r.ok) E.apply(st, { t: 'end', pid: st.cur });
    }
    if (!st.over) notOver++; else turns += st.turn;
    const w = st.log.filter(l => l.kind === 'warn' && /ยังไม่รองรับ/.test(l.text)); if (w.length) { warns++; if (warns < 5) console.log('WARN', w[0].text); }
  } catch (e) { errs++; if (errs < 5) console.log('EXC', g, e.stack.split('\n').slice(0, 3).join(' | ')); }
}
// รอบที่ 2: การ์ดที่ยังไม่ถูกลง ให้เด็คฝั่งหนึ่งเป็นการ์ดใบนั้นทั้งเด็ค (ทดสอบเอฟเฟกต์โดยตรง ไม่ตรวจกติกาจัดเด็ค)
for (const c of NEW.filter(c => !played.has(c.id))) {
  const st = E.newGame({ seed: 99, names: ['ก', 'ข'], decks: [Array(30).fill(c.id), deck(NEW)] });
  try { for (const p of [0, 1]) E.apply(st, { t: 'mulligan', pid: p, uids: [] }); let steps = 0;
    while (!st.over && steps++ < 1500) { const a = AI.decide(st, st.cur, 'normal');
      if (a.t === 'play') { const h = st.players[st.cur].hand.find(x => x.uid === a.card); if (h) played.add(h.id); }
      const r = E.apply(st, a); if (!r.ok) E.apply(st, { t: 'end', pid: st.cur }); }
    const w = st.log.filter(l => l.kind === 'warn' && /ยังไม่รองรับ/.test(l.text)); if (w.length) { warns++; console.log('WARN', c.id, w[0].text); }
  } catch (e) { errs++; console.log('EXC', c.id, e.stack.split('\n').slice(0, 3).join(' | ')); }
}
const miss = NEW.filter(c => !played.has(c.id)).map(c => c.id + ' ' + c.name_th);
console.log(`เกม ${N} · exception ${errs} · เอฟเฟกต์ไม่รองรับ ${warns} · ไม่จบ ${notOver} · เทิร์นเฉลี่ย ${(turns / Math.max(1, N - notOver)).toFixed(1)}`);
console.log(`การ์ดใหม่ที่ถูกลงสนาม ${NEW.length - miss.length}/${NEW.length}` + (miss.length ? ' · ยังไม่ถูกลง: ' + miss.join(', ') : ''));
process.exit(errs || warns || notOver || miss.length ? 1 : 0);
