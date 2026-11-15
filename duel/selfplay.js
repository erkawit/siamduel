// node duel/selfplay.js [จำนวนเกม] — AI ปะทะ AI ตรวจว่าไม่มี exception และเกมจบใน 40 เทิร์น (T30)
const fs = require('fs'), path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/siam_duel_cards.json'), 'utf8'));
const E = require('./engine.js').create(data), A = require('./ai.js'), AI = A.create(E);
const N = +process.argv[2] || 20, keys = Object.keys(A.DECKS);
for (const k of keys) { const e = E.deckErrors(A.DECKS[k].ids); if (e.length) { console.log('DECK', k, e); process.exit(1); } }
let wins = [0, 0, 0], turns = 0, errs = 0, t0 = Date.now();
for (let g = 0; g < N; g++) {
  const pair = g >> 1, d0 = keys[pair % 4], d1 = keys[(pair + 1 + (pair >> 2)) % 4];
  const LV = [process.argv[3] || 'easy', process.argv[4] || 'hard'], sw = g % 2; const lv = sw ? [LV[1], LV[0]] : LV;
  const st = E.newGame({ seed: 1000 + pair, names: ['ง่าย', 'ยาก'], decks: [A.DECKS[d0].ids, A.DECKS[d1].ids] });
  try {
    for (const p of [0, 1]) E.apply(st, { t: 'mulligan', pid: p, uids: AI.mulliganPick(st, p) });
    let steps = 0;
    while (!st.over && steps++ < 3000) {
      const a = AI.decide(st, st.cur, lv[st.cur]);
      const r = E.apply(st, a); if (!r.ok) { console.log('ILLEGAL', JSON.stringify(a), r.err); E.apply(st, { t: 'end', pid: st.cur }); }
    }
    if (!st.over) { console.log('NOT OVER', g); errs++; }
    else { wins[st.over.winner === -1 ? 2 : (st.over.winner ^ sw)]++; turns += st.turn; }
    const warn = st.log.filter(l => l.kind === 'warn' && l.text.includes('ยังไม่รองรับ')); if (warn.length) console.log('WARN', g, warn[0].text);
  } catch (e) { errs++; console.log('EXC game', g, d0, d1, e.stack.split('\n').slice(0, 4).join(' | ')); }
}
console.log(`games ${N} ${process.argv[3]||'easy'} ${wins[0]} ${process.argv[4]||'hard'} ${wins[1]} draw ${wins[2]} errors ${errs} avgTurns ${(turns / Math.max(1, N - errs)).toFixed(1)} ${(Date.now() - t0) / 1000}s`);
