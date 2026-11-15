/* สยามมินทร์ดูเอล — AI คู่ดวล (จำลองทุกทางเลือกแล้วเลือกทางที่สถานการณ์ดีที่สุด)
   ระดับ: easy (สุ่มพลาดบ้าง) · normal · hard (คิดล่วงหน้าการโจมตีสวนของอีกฝ่ายแบบคร่าว ๆ) */
(function (root) {
'use strict';
const DECKS = {
  ayutthaya: { name: 'ทัพกรุงศรี', ids: ['SD029','SD031','SD032','SD033','SD038','SD038','SD044','SD044','SD050','SD050','SD051','SD051','SD052','SD052','SD047','SD090','SD090','SD090','SD091','SD091','SD091','SD092','SD092','SD092','SD097','SD097','SD097','SD084','SD084','SD054'] },
  ghost: { name: 'รัตติกาลผี', ids: ['SD024','SD020','SD037','SD037','SD039','SD039','SD040','SD040','SD041','SD041','SD049','SD049','SD053','SD053','SD057','SD057','SD058','SD058','SD066','SD066','SD073','SD073','SD078','SD078','SD080','SD080','SD088','SD088','SD094','SD096'] },
  himmapan: { name: 'หิมพานต์', ids: ['SD034','SD030','SD030','SD054','SD054','SD063','SD063','SD063','SD064','SD064','SD076','SD076','SD076','SD082','SD082','SD082','SD093','SD093','SD093','SD055','SD055','SD056','SD056','SD100','SD100','SD100','SD068','SD068','SD081','SD081'] },
  lanka: { name: 'ลงกา', ids: ['SD035','SD023','SD028','SD028','SD070','SD070','SD070','SD071','SD071','SD071','SD074','SD074','SD074','SD075','SD075','SD075','SD043','SD043','SD039','SD039','SD079','SD079','SD080','SD080','SD085','SD085','SD098','SD098','SD091','SD097'] },
};
const KW_VAL = { 'ทวารบาล': 1, 'กำบัง': 1, 'คงกระพัน': 1.5, 'อมตะ': 2, 'เหาะเหิน': 1, 'ดูดชีพ': 1, 'ลิ้มเลือด': 0.5, 'ฟื้นฟู': 1 };

function create(E) {
  function score(st, pid) {
    if (st.over) return st.over.winner === pid ? 1e5 : st.over.winner === -1 ? 0 : -1e5;
    const me = st.players[pid], op = st.players[1 - pid];
    let s = 0;
    s += (Math.min(me.fate, 30) - op.fate) * 1.1;
    if (op.fate <= 10) s += (10 - op.fate) * 0.8;      // เร่งปิดเกม
    if (me.fate <= 10) s -= (10 - me.fate) * 0.8;
    const side = (P, sign) => { for (const u of P.units) if (u) { let v = E.unitValue(st, u); for (const k of E.kwOf(st, u)) v += KW_VAL[k] || 0;
      if (u.status.sleep || u.status.stun || u.status.noatk) v *= 0.7; s += sign * v; }
      for (const x of P.slots) if (x) s += sign * 2; };
    side(me, 1); side(op, -1);
    s += me.hand.length * 1.2 - op.hand.length * 0.6 + me.barami * 0.3;
    return s;
  }
  function picksFor(st, pid, hc, slot) { // คืนลิสต์ชุดการเลือก (แตกตามตัวเลือก choose)
    const out = []; const stack = [[]];
    let guard = 0;
    while (stack.length && guard++ < 24) {
      const pk = stack.pop(); const nd = E.need(st, pid, hc.uid, slot, pk);
      if (!nd) { out.push(pk); continue; }
      if (!nd.options.length) { out.push(pk); continue; }
      if (nd.kind === 'option') { for (const o of nd.options) stack.push(pk.concat([o])); continue; }
      if (nd.kind === 'crypt') { stack.push(pk.concat([nd.options.slice().sort((a, b) => (E.D(b.id).cost || 0) - (E.D(a.id).cost || 0))[0].idx])); continue; }
      if (nd.kind === 'discover') { stack.push(pk.concat([nd.options.slice().sort((a, b) => (E.D(b).cost || 0) - (E.D(a).cost || 0))[0]])); continue; }
      if (nd.kind === 'slotcard') { stack.push(pk.concat([nd.options[0]])); continue; }
      // ยูนิต: ลองตัวที่มีค่าที่สุด 3 ตัวแรก
      const val = id => { for (const p of st.players) for (const u of p.units) if (u && u.uid === id) return E.unitValue(st, u); return 0; };
      const sorted = nd.options.slice().sort((a, b) => val(b) - val(a));
      if (nd.count > 1) stack.push(pk.concat([sorted.slice(0, nd.count)]));
      else for (const o of sorted.slice(0, 3)) stack.push(pk.concat([o]));
    }
    return out.slice(0, 8);
  }
  function candidates(st, pid) {
    const L = E.legal(st, pid), P = st.players[pid], out = [];
    for (const cu of L.plays) {
      const hc = P.hand.find(c => c.uid === cu), d = E.D(hc.id);
      const slots = d.type === 'ยูนิต' ? [P.units.findIndex(x => !x)] : [null];
      for (const slot of slots) for (const picks of picksFor(st, pid, hc, slot)) out.push({ t: 'play', pid, card: cu, slot, picks });
    }
    for (const a of L.attacks) for (const t of a.targets) out.push({ t: 'attack', pid, unit: a.unit, target: t.uid ? { uid: t.uid } : t.player != null ? { player: t.player } : { slot: t.slot } });
    return out;
  }
  function threat(st, pid) { // ดาเมจสูงสุดคร่าว ๆ ที่อีกฝ่ายตีหน้าเราได้เทิร์นหน้า
    const op = st.players[1 - pid], me = st.players[pid];
    const guards = me.units.some(u => u && E.has(st, u, 'ทวารบาล'));
    let dmg = 0; for (const u of op.units) if (u && !u.status.stun) { if (!guards || E.has(st, u, 'เหาะเหิน')) dmg += E.atkOf(st, u); }
    return dmg;
  }
  function greedy(st, pid, level) {
    const base = score(st, pid);
    let best = null, bestS = -Infinity;
    for (const a of candidates(st, pid)) {
      const s2 = E.clone(st); const r = E.apply(s2, a); if (!r.ok) continue;
      let s = score(s2, pid);
      if (level === 'easy') s += (Math.random() - 0.5) * 6;
      if (s > bestS) { bestS = s; best = a; }
    }
    const need = level === 'easy' ? 0.8 : 0.05;
    return best && bestS > base + need ? best : { t: 'end', pid };
  }
  function rollout(st, pid) { // เล่นต่อจนจบเทิร์นเรา แล้วให้อีกฝ่ายเล่น 1 เทิร์นแบบปกติ
    let n = 0;
    while (!st.over && st.cur === pid && n++ < 25) { const a = greedy(st, pid, 'normal'); if (!E.apply(st, a).ok) E.apply(st, { t: 'end', pid }); }
    n = 0;
    while (!st.over && st.cur !== pid && n++ < 25) { const a = greedy(st, st.cur, 'normal'); if (!E.apply(st, a).ok) E.apply(st, { t: 'end', pid: st.cur }); }
    return score(st, pid);
  }
  function decide(st, pid, level) {
    level = level || 'normal';
    if (level === 'easy' && Math.random() < 0.3) { const c = candidates(st, pid); return c.length && Math.random() < 0.6 ? c[Math.floor(Math.random() * c.length)] : { t: 'end', pid }; }
    if (level !== 'hard') return greedy(st, pid, level);
    let best = { t: 'end', pid }; const s0 = E.clone(st); E.apply(s0, best); let bestS = rollout(s0, pid);
    for (const a of candidates(st, pid)) {
      const s2 = E.clone(st); if (!E.apply(s2, a).ok) continue;
      const s = rollout(s2, pid);
      if (s > bestS + 0.01) { bestS = s; best = a; }
    }
    return best;
  }
  function mulliganPick(st, pid) { const P = st.players[pid]; return P.hand.filter(c => c.id !== 'TK_COIN' && (E.D(c.id).cost || 0) >= 6).map(c => c.uid); }
  return { decide, score, mulliganPick, candidates };
}
const api = { create, DECKS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SiamAI = api;
})(typeof self !== 'undefined' ? self : this);
