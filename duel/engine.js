/* สยามมินทร์ดูเอล — เอนจินดวล (กติกา docs/rules.md R1–R14)
   ใช้ได้ทั้งในเบราว์เซอร์และ Node: SiamEngine.create(defs) → { newGame, act, legal, need, view, ... }
   state เป็น JSON ล้วน (clone ได้ด้วย JSON) สุ่มด้วย seeded RNG เท่านั้น (R14.1) */
(function (root) {
'use strict';
const RARITY = ['ธรรมดา', 'ทั่วไป', 'หายาก', 'มหากาพย์', 'ตำนาน', 'พระเจ้า', 'ผู้สรรสร้าง'];
const BEATS = { 'น้ำ': 'ไฟ', 'ไฟ': 'ดิน', 'ดิน': 'ลม', 'ลม': 'น้ำ' };
const MAX_FATE = 30, HAND_MAX = 5, MAX_AKHOM = 10, MAX_BARAMI = 3, TURN_LIMIT = 40;
const HARMFUL = new Set(['damage', 'destroy', 'seal', 'sleep', 'disable_attack', 'steal', 'poison', 'fight', 'swap_stats']);
class Need { constructor(spec) { this.spec = spec; } }
const arr = v => v == null ? [] : Array.isArray(v) ? v : [v];
const clone = o => JSON.parse(JSON.stringify(o));

function create(DEFS_IN) {
  const DEF = {};
  for (const c of DEFS_IN.cards) DEF[c.id] = Object.assign({ token: false }, c);
  for (const t of DEFS_IN.tokens) DEF[t.id] = Object.assign({ type: 'ยูนิต', cost: 0, category: t.tribe || 'โทเคน', rarity: 'ธรรมดา', keywords: [], ability_code: [], token: true }, t, { token: true });
  const D = id => DEF[id];
  const rules = d => (d && d.ability_code) || [];
  const specials = (d, name) => rules(d).filter(r => r.special === name);
  const hasSpecial = (d, name) => specials(d, name).length > 0;

  /* ---------- RNG (mulberry32) ---------- */
  function rnd(st) { let t = (st.rng = (st.rng + 0x6D2B79F5) >>> 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const rint = (st, n) => Math.floor(rnd(st) * n);
  function shuffle(st, a) { for (let i = a.length - 1; i > 0; i--) { const j = rint(st, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const uid = st => 'u' + (++st.nextUid);

  /* ---------- log/fx ---------- */
  const log = (st, text, kind) => { st.log.push({ t: st.turn, text, kind: kind || '' }); if (st.log.length > 300) st.log.shift(); };
  const fx = (st, e) => st.fx.push(e);
  const nm = id => (D(id) || {}).name_th || id;

  /* ---------- ค้นหา ---------- */
  function allUnits(st, firstPid) {
    const out = [], order = firstPid == null ? [st.cur, 1 - st.cur] : [firstPid, 1 - firstPid];
    for (const p of order) st.players[p].units.forEach((u, i) => { if (u) out.push(u); });
    return out;
  }
  const findUnit = (st, id) => { for (const p of st.players) for (const u of p.units) if (u && u.uid === id) return u; return null; };
  const findSlot = (st, id) => { for (const p of st.players) for (const s of p.slots) if (s && s.uid === id) return s; return null; };
  const slotOf = (st, u) => st.players[u.owner].units.indexOf(u);
  const rahuNatural = T => T >= 3 && (T % 3 === 0 || (T - 1) % 3 === 0);
  const rahuActive = st => rahuNatural(st.turn) || st.turn <= st.rahuUntil;

  /* ---------- สถานะยูนิต ---------- */
  const sealed = u => (u.status.seal || 0) > 0 || !!u.status.stun;
  function baseKw(st, u) {
    if (sealed(u)) return [];
    const d = D(u.id); let k = d.keywords.slice();
    if (u.form != null) { const f = specials(d, 'dual_form')[0]; if (f) k = k.concat(f.forms[u.form].grant || []); }
    k = k.concat(u.kw);
    for (const t of u.tmp) if (t.kw) k = k.concat(t.kw);
    for (const e of u.equips) k = k.concat(e.grant || []);
    return k.filter(x => !u.lost.includes(x));
  }
  function auraMods(st, u, forHp) {   // [{atk,hp,grant,rule}] ที่มีผลกับยูนิต u (forHp: เฉพาะที่เพิ่ม HP กันวนซ้ำ)
    const out = [];
    for (const p of [0, 1]) {
      const P = st.players[p];
      P.units.forEach((src, i) => {
        if (!src || sealed(src)) return;
        for (const r of rules(D(src.id))) { if (!r.aura) continue; const a = r.aura; if (forHp && !a.hp) continue;
          if (!auraHits(st, src, a, u, p, i)) continue;
          if (a.if && !auraIf(st, src, a.if, u)) continue;
          out.push(a); }
        for (const e of src.equips) for (const r of rules(D(e.id))) { if (!r.aura || r.aura.target !== 'bearer' || src !== u || (forHp && !r.aura.hp)) continue;
          if (r.aura.if && r.aura.if.bearer_name && D(u.id).name_th !== r.aura.if.bearer_name) continue; out.push(r.aura); }
      });
      for (const s of P.slots) { if (!s || s.facedown) continue; const d = D(s.id);
        if (d.aura && p === u.owner && (d.aura.target === 'all_ally_units')) out.push(d.aura); }
    }
    return out;
  }
  function auraHits(st, src, a, u, p, i) {
    const t = a.target;
    if (t === 'self') { if (src !== u) return false; }
    else if (t === 'all_ally_units') { if (u.owner !== p) return false; }
    else if (t === 'other_ally_units') { if (u.owner !== p || u === src) return false; }
    else if (t === 'all_enemy_units') { if (u.owner === p) return false; }
    else if (t === 'adjacent_allies') { if (u.owner !== p) return false; const j = slotOf(st, u); if (Math.abs(j - i) !== 1) return false; }
    else return false;
    if (a.filter && !match(st, u, a.filter, src)) return false;
    return true;
  }
  function auraIf(st, src, c, u) {
    if (c.ally_name) { const ok = st.players[src.owner].units.some(x => x && x !== src && D(x.id).name_th === c.ally_name); if (!ok) return false; }
    if (c.equipped) { if (!src.equips.some(e => D(e.id).name_th === c.equipped)) return false; }
    if (c.self_hp_lte != null) { if (hpOf(st, src, true) > c.self_hp_lte) return false; }
    return true;
  }
  function rahuMod(st, u) {
    if (!rahuActive(st)) return 0; const d = D(u.id);
    if (d.category === 'ผู้ปกครอง') return 0;
    if (d.tribe === 'ผี') return 1;
    if (d.tribe === 'เทพ' && d.id !== 'SD016') return -1;
    return 0;
  }
  function baseStats(u) { const d = D(u.id); let a = d.atk || 0, h = d.hp || 0;
    if (u.form != null) { const f = specials(d, 'dual_form')[0]; if (f) { a = f.forms[u.form].atk; h = f.forms[u.form].hp; } }
    return [a, h]; }
  function maxHpOf(st, u) { let [, h] = baseStats(u); h += u.php; for (const t of u.tmp) h += t.hp || 0; for (const e of u.equips) h += e.hp || 0;
    for (const a of auraMods(st, u, true)) h += a.hp || 0; return h; }
  function hpOf(st, u) { return maxHpOf(st, u) - u.dmg; }
  function atkOf(st, u) { let [a] = baseStats(u); a += u.patk; for (const t of u.tmp) a += t.atk || 0; for (const e of u.equips) a += e.atk || 0;
    let x2 = false; for (const m of auraMods(st, u)) { a += m.atk || 0; if (m.rule === 'atk_x2') x2 = true; }
    a += rahuMod(st, u); if (x2) a *= 2; return Math.max(0, a); }
  function kwOf(st, u) { let k = baseKw(st, u); if (!sealed(u)) for (const m of auraMods(st, u)) k = k.concat(m.grant || []); return k; }
  const has = (st, u, k) => kwOf(st, u).includes(k);
  const poisonKw = (st, u) => { let n = 0; for (const k of kwOf(st, u)) { const m = /^พิษ (\d+)$/.exec(k); if (m) n = Math.max(n, +m[1]); } return n; };
  const ruleOn = (st, u, rule) => { if (sealed(u)) return false; if (u.equips.some(e => e.rule === rule)) return true; return auraMods(st, u).some(m => m.rule === rule); };
  const shrouded = (st, u) => has(st, u, 'กำบัง') && !u.shroudOff;
  const isRulerOrDeity = d => d.category === 'ผู้ปกครอง' || d.category === 'เทพเจ้า' || d.is_ruler || d.is_deity;
  const greatImmune = (u, srcDef) => { const d = D(u.id); return d.tribe === 'เทพ' && d.rarity === 'ผู้สรรสร้าง' && (!srcDef || srcDef.rarity !== 'ผู้สรรสร้าง'); };
  const costOfDef = d => d.cost || 0;

  function match(st, u, f, self) {
    const d = D(u.id);
    if (f.tribe && !arr(f.tribe).includes(d.tribe)) return false;
    if (f.element && !arr(f.element).includes(d.element)) return false;
    if (f.category && !arr(f.category).includes(d.category)) return false;
    if (f.not_category && arr(f.not_category).some(c => c === d.category || (c === 'เทพเจ้า' && d.is_deity) || (c === 'ผู้ปกครอง' && d.is_ruler))) return false;
    if (f.name && !arr(f.name).includes(d.name_th)) return false;
    if (f.name_contains && !d.name_th.includes(f.name_contains)) return false;
    if (f.cost_lte != null && costOfDef(d) > f.cost_lte) return false;
    if (f.cost_gte != null && costOfDef(d) < f.cost_gte) return false;
    if (f.cost_eq != null && costOfDef(d) !== f.cost_eq) return false;
    if (f.rarity && d.rarity !== f.rarity) return false;
    if (f.rarity_gte && RARITY.indexOf(d.rarity) < RARITY.indexOf(f.rarity_gte)) return false;
    if (f.hp_lte != null && u.status && hpOf(st, u) > f.hp_lte) return false;
    if (f.type && d.type !== f.type) return false;
    if (f.status) { const s = arr(f.status); if (!s.some(x => (x === 'asleep' && u.status.sleep > 0) || (x === 'sealed' && sealed(u)))) return false; }
    if (f.exclude_self && self && u === self) return false;
    return true;
  }
  const matchDef = (d, f) => match(null, { id: d.id, status: null }, Object.assign({}, f, { hp_lte: undefined, status: undefined }), null);

  /* ---------- สร้างยูนิต ---------- */
  function mkUnit(st, pid, id, extra) {
    const d = D(id);
    const u = { uid: uid(st), id, owner: pid, patk: 0, php: 0, dmg: 0, kw: [], lost: [], tmp: [], equips: [], status: {}, played: st.turn,
      attacks: 0, shroudOff: false, token: !!d.token, form: hasSpecial(d, 'dual_form') ? 0 : null, avatarUses: (specials(d, 'avatar')[0] || {}).uses || 0, once: {} };
    return Object.assign(u, extra || {});
  }
  function placeUnit(st, pid, u, slot) {
    const P = st.players[pid];
    if (slot == null || P.units[slot]) slot = P.units.findIndex(x => !x);
    if (slot < 0) return null;
    u.owner = pid; P.units[slot] = u; return u;
  }
  function onEnter(st, u) { // ราหูเริ่มทำงานกับยูนิตที่ลงระหว่างช่วงราหู
    if (rahuActive(st) && !sealed(u)) for (const r of rules(D(u.id))) if (r.on === 'rahu') run(st, r.do, ctxFor(st, u));
  }

  /* ---------- ctx และการเลือกเป้า ---------- */
  function ctxFor(st, u, extra) { return Object.assign({ pid: u.owner, self: u, src: D(u.id) }, extra || {}); }
  function pick(st, ctx, spec) {
    if (!spec.options.length) { if (ctx.plan && ctx.strict) throw new Need(spec); return null; }
    if (ctx.picks) { if (ctx.pi < ctx.picks.length) { const v = ctx.picks[ctx.pi++]; return v; } if (ctx.plan) throw new Need(spec); }
    return autoPick(st, ctx, spec);
  }
  function unitValue(st, u) { return atkOf(st, u) * 1.2 + Math.max(0, hpOf(st, u)) + costOfDef(D(u.id)) * 0.5; }
  function autoPick(st, ctx, spec) {
    const o = spec.options;
    if (spec.kind === 'option') return 0;
    if (spec.kind === 'discover') { return o.slice().sort((a, b) => costOfDef(D(b)) - costOfDef(D(a)))[0]; }
    if (spec.kind === 'crypt') { let best = 0; o.forEach((c, i) => { if (costOfDef(D(c.id)) > costOfDef(D(o[best].id))) best = i; }); return o[best].idx; }
    if (spec.kind === 'slotcard') return o[0];
    const val = id => { const u = findUnit(st, id); return u ? unitValue(st, u) : 0; };
    const sorted = o.slice().sort((a, b) => val(b) - val(a));
    if (spec.count > 1) return sorted.slice(0, spec.count);
    return sorted[0];
  }
  function canTargetByEnemy(st, u, ctx) { // เอฟเฟกต์ศัตรูเล็ง u ได้ไหม
    if (u.owner === ctx.pid) return true;
    if (shrouded(st, u)) return false;
    if (ctx.src && ctx.src.tribe === 'ผี' && has(st, u, 'untargetable_by_ghosts')) return false;
    return true;
  }
  function unitOptions(st, ctx, side, filter) {
    let list = [];
    if (side === 'enemy' || side === 'any') list = list.concat(st.players[1 - ctx.pid].units.filter(Boolean));
    if (side === 'ally' || side === 'any') list = list.concat(st.players[ctx.pid].units.filter(Boolean));
    return list.filter(u => (!filter || match(st, u, filter, ctx.self)) && canTargetByEnemy(st, u, ctx) && u !== ctx.selfExclude);
  }
  function chosen(st, ctx, side, filter, count, label, harmful) {
    const opts = unitOptions(st, ctx, side, filter).map(u => u.uid);
    const spec = { kind: count > 1 ? 'units' : 'unit', options: opts, count: count || 1, label, side, harmful };
    let v = pick(st, ctx, spec); if (v == null) return [];
    v = arr(v).filter(x => opts.includes(x));
    const us = v.map(x => findUnit(st, x)).filter(Boolean);
    if (ctx.isSpell && !ctx.plan) { const foe = us.find(u => u.owner !== ctx.pid);
      if (foe) { const F = st.players[foe.owner], g = F.units.find(x => x && !sealed(x) && hasSpecial(D(x.id), 'spell_shield'));
        if (g && !F.shieldUsed) { F.shieldUsed = true; ctx.countered = true; log(st, `${nm(g.id)} ปัดคาถาให้ทัพของตน!`, 'fx'); return []; } } }
    for (const u of us) firstTargeted(st, u, ctx);
    return us.map(u => findUnit(st, u.uid) || u);
  }
  function firstTargeted(st, u, ctx) {
    if (u.owner === ctx.pid || u.once.targeted) return; u.once.targeted = true;
    if (sealed(u)) return;
    const s = specials(D(u.id), 'transform_once')[0];
    if (s) { const P = st.players[u.owner], i = slotOf(st, u); const nu = mkUnit(st, u.owner, s.into); nu.played = u.played; nu.uid = u.uid; P.units[i] = nu; log(st, `${nm(u.id)} แปลงร่างเป็น ${nm(s.into)}!`, 'fx'); }
  }
  const LABEL = { chosen_enemy_unit: 'เลือกยูนิตศัตรู', chosen_ally_unit: 'เลือกยูนิตฝ่ายเรา', chosen_unit: 'เลือกยูนิต', chosen_enemy_units: 'เลือกยูนิตศัตรู' };
  function targets(st, spec, ctx, effName) {
    const t = typeof spec === 'string' ? spec : spec.target, f = spec.filter, harmful = HARMFUL.has(effName) || (effName === 'buff' && (spec.atk < 0 || spec.hp < 0));
    const P = st.players[ctx.pid], E = st.players[1 - ctx.pid];
    const flt = list => list.filter(u => u && (!f || match(st, u, f, ctx.self)));
    switch (t) {
      case 'self': return ctx.self && findUnit(st, ctx.self.uid) ? [findUnit(st, ctx.self.uid)] : [];
      case 'self_player': return [{ player: ctx.pid }];
      case 'enemy_player': return [{ player: 1 - ctx.pid }];
      case 'all_enemy_units': return flt(E.units);
      case 'all_ally_units': return flt(P.units);
      case 'all_units': return flt(allUnits(st));
      case 'other_ally_units': return flt(P.units).filter(u => u !== ctx.self);
      case 'adjacent_allies': { const i = ctx.self ? slotOf(st, ctx.self) : -9; return flt([P.units[i - 1], P.units[i + 1]]); }
      case 'random_enemy_unit': { const l = flt(E.units); return l.length ? [l[rint(st, l.length)]] : []; }
      case 'enemy_strongest': { const l = flt(E.units).sort((a, b) => atkOf(st, b) - atkOf(st, a) || costOfDef(D(b.id)) - costOfDef(D(a.id))); return l.slice(0, 1); }
      case 'enemy_lowest_cost': { const l = flt(E.units).sort((a, b) => costOfDef(D(a.id)) - costOfDef(D(b.id))); return l.slice(0, 1); }
      case 'chosen_enemy_unit': return chosen(st, ctx, 'enemy', f, 1, LABEL[t], harmful);
      case 'chosen_enemy_units': return chosen(st, ctx, 'enemy', f, spec.count || 1, LABEL[t], harmful);
      case 'chosen_ally_unit': return chosen(st, ctx, 'ally', f, 1, LABEL[t], harmful);
      case 'chosen_unit': return chosen(st, ctx, 'any', f, 1, LABEL[t], harmful);
      case 'attacker': return ctx.attacker && findUnit(st, ctx.attacker.uid) ? [findUnit(st, ctx.attacker.uid)] : [];
      case 'attack_target': return ctx.attack_target && findUnit(st, ctx.attack_target.uid) ? [findUnit(st, ctx.attack_target.uid)] : [];
      case 'event_unit': return ctx.event_unit && findUnit(st, ctx.event_unit.uid) ? [findUnit(st, ctx.event_unit.uid)] : [];
      case 'killer': return ctx.killer && findUnit(st, ctx.killer.uid) ? [findUnit(st, ctx.killer.uid)] : [];
      case 'bearer': return ctx.bearer ? [ctx.bearer] : [];
      case 'chosen_enemy_slot_card': {
        const opts = E.slots.filter(s => s && (!f || !f.type || D(s.id).type === f.type)).map(s => s.uid);
        const v = pick(st, ctx, { kind: 'slotcard', options: opts, count: 1, label: 'เลือกการ์ดในช่องกับดัก/ของขลังของศัตรู', side: 'enemy', harmful: true });
        return v == null ? [] : [findSlot(st, v)].filter(Boolean);
      }
    }
    return [];
  }

  /* ---------- ดาเมจ ---------- */
  function damageUnit(st, u, amount, source) { // source: {unit, isSpell, combat, pierce, pid}
    if (!u || amount <= 0 || !findUnit(st, u.uid)) return 0;
    if (ruleOn(st, u, 'damage_taken_minus_1')) amount -= 1;
    if (source && source.isSpell && ruleOn(st, u, 'spell_damage_taken_minus_1')) amount -= 1;
    if (amount <= 0) return 0;
    if (has(st, u, 'คงกระพัน') && !(source && source.pierce)) { u.lost.push('คงกระพัน'); log(st, `${nm(u.id)} คงกระพัน กันดาเมจไว้`, 'fx'); fx(st, { k: 'block', uid: u.uid }); return 0; }
    u.dmg += amount; if (source && source.pid != null) u.lastHitBy = source.pid; if (source && source.unit) u.lastHitUnit = source.unit.uid;
    fx(st, { k: 'dmg', uid: u.uid, n: amount }); return amount;
  }
  function damagePlayer(st, pid, amount) { if (amount <= 0) return 0; st.players[pid].fate -= amount; fx(st, { k: 'dmg', player: pid, n: amount }); return amount; }
  function healPlayer(st, pid, n) { const P = st.players[pid]; const b = P.fate; P.fate = Math.min(MAX_FATE, P.fate + n); if (P.fate > b) fx(st, { k: 'heal', player: pid, n: P.fate - b }); }
  function multVs(st, attacker, target) { if (!attacker || sealed(attacker)) return 1; let m = 1;
    for (const s of specials(D(attacker.id), 'damage_mult')) if (match(st, target, s.vs, attacker)) m *= s.mult; return m; }

  /* ---------- ทำเอฟเฟกต์ ---------- */
  function run(st, list, ctx) {
    for (const e of list || []) {
      if (st.over) return;
      if (ctx.countered) return;
      const k = Object.keys(e)[0], p = e[k] || {};
      if (++st.trigCount > 400) { if (!st.loopWarned) { st.loopWarned = true; log(st, 'เอฟเฟกต์วนซ้ำเกินกำหนด หยุดการทำงาน (R10.3)', 'warn'); } return; }
      EFFECT[k] ? EFFECT[k](st, p, ctx) : log(st, `ยังไม่รองรับเอฟเฟกต์ ${k}`, 'warn');
    }
  }
  function grantTo(u, kws, dur) { if (dur === 'perm') { u.kw.push(...kws); u.lost = u.lost.filter(x => !kws.includes(x)); } else u.tmp.push({ kw: kws, exp: dur || 'turn' }); }
  const EFFECT = {
    damage(st, p, ctx) {
      const ts = targets(st, p, ctx, 'damage');
      for (const t of ts) {
        if (t.player != null) { damagePlayer(st, t.player, p.amount); continue; }
        if (t.slotcard) continue;
        const amt = p.amount * multVs(st, ctx.self, t);
        damageUnit(st, t, amt, { isSpell: ctx.isSpell, pid: ctx.pid, unit: ctx.self });
        if (p.splash_others) for (const o of st.players[t.owner].units) if (o && o !== t) damageUnit(st, o, p.splash_others, { isSpell: ctx.isSpell, pid: ctx.pid });
      }
    },
    heal(st, p, ctx) { for (const t of targets(st, p, ctx, 'heal')) { if (t.player != null) { healPlayer(st, t.player, p.amount); continue; }
      const before = t.dmg; t.dmg = p.amount === 'full' ? 0 : Math.max(0, t.dmg - p.amount); if (before > t.dmg) fx(st, { k: 'heal', uid: t.uid, n: before - t.dmg }); } },
    buff(st, p, ctx) { for (const t of targets(st, p, ctx, 'buff')) { if (t.player != null) continue;
      if (p.duration === 'perm') { t.patk += p.atk || 0; t.php += p.hp || 0; } else t.tmp.push({ atk: p.atk || 0, hp: p.hp || 0, exp: p.duration || 'turn' });
      fx(st, { k: 'buff', uid: t.uid }); } },
    grant(st, p, ctx) { for (const t of targets(st, p, ctx, 'grant')) if (t.player == null) grantTo(t, p.keywords, p.duration); },
    summon(st, p, ctx) {
      const side = p.side === 'enemy' ? 1 - ctx.pid : ctx.pid, P = st.players[side];
      for (let i = 0; i < (p.count || 1); i++) {
        if (p.zone === 'slot') { const j = P.slots.findIndex(x => !x); if (j < 0) break; const d = D(p.token);
          P.slots[j] = { uid: uid(st), id: p.token, owner: side, facedown: false, placed: st.turn, dmg: 0 }; log(st, `${nm(p.token)} ปรากฏในช่องของขลัง`); continue; }
        const u = placeUnit(st, side, mkUnit(st, side, p.token), null); if (!u) break; u.played = st.turn; fx(st, { k: 'summon', uid: u.uid }); onEnter(st, u);
      }
    },
    destroy(st, p, ctx) { for (const t of targets(st, p, ctx, 'destroy')) {
      if (t.player != null) continue;
      if (t.owner != null && findSlot(st, t.uid)) { removeSlot(st, t); continue; }
      if (greatImmune(t, ctx.src)) { log(st, `${nm(t.id)} ไม่สะทกสะท้าน (กฎความยิ่งใหญ่)`, 'fx'); continue; }
      t.destroyed = true; if (p.purge) t.purge = true; t.lastHitBy = ctx.pid; fx(st, { k: 'destroy', uid: t.uid }); } },
    revive(st, p, ctx) {
      const side = ctx.pid, P = st.players[side];
      const n = p.count === 'all' ? 99 : (p.count || 1);
      // กับดักศัตรู enemy_revive
      const cctx = { countered: false };
      trapCheck(st, 1 - side, 'enemy_revive', { pid: 1 - side, reviver: side, cctx });
      if (cctx.countered) { log(st, 'การชุบชีวิตถูกยกเลิก', 'fx'); return; }
      let revived = 0;
      for (let i = 0; i < n; i++) {
        if (!P.units.some(x => !x)) break;
        const pool = [];
        const crypts = p.from === 'enemy_crypt' ? [1 - side] : p.from === 'any_crypt' ? [side, 1 - side] : [side];
        for (const cs of crypts) st.players[cs].crypt.forEach((c, idx) => { const d = D(c.id); if (d.type !== 'ยูนิต') return;
          if (p.filter && !matchDef(d, p.filter)) return; if (cs !== side && isRulerOrDeity(d)) return; pool.push({ side: cs, idx, id: c.id, key: cs + ':' + idx }); });
        if (!pool.length) break;
        let pickd;
        if (p.pick === 'strongest') pickd = pool.slice().sort((a, b) => costOfDef(D(b.id)) - costOfDef(D(a.id)))[0];
        else if (p.pick === 'random') pickd = pool[rint(st, pool.length)];
        else if (p.count === 'all') pickd = pool[0];
        else { const v = pick(st, ctx, { kind: 'crypt', options: pool.map(x => ({ idx: x.key, id: x.id })), count: 1, label: 'เลือกการ์ดจากสุสาน' }); pickd = pool.find(x => x.key === v) || pool[0]; }
        st.players[pickd.side].crypt.splice(pickd.idx, 1);
        const u = placeUnit(st, side, mkUnit(st, side, pickd.id), null); u.played = st.turn;
        if (p.hp === 1) u.dmg = maxHpOf(st, u) - 1;
        log(st, `${nm(pickd.id)} ถูกชุบชีวิต`, 'fx'); fx(st, { k: 'revive', uid: u.uid }); revived++;
        onEnter(st, u);
        if (p.then) run(st, p.then, Object.assign({}, ctx, { event_unit: u }));
      }
      if (revived) fireSide(st, side, 'ally_revived', { });
    },
    purge_crypt(st, p, ctx) { const side = p.side === 'enemy' ? 1 - ctx.pid : ctx.pid, P = st.players[side];
      const out = P.crypt.splice(Math.max(0, P.crypt.length - (p.count || 1))); P.purged.push(...out); if (out.length) log(st, `สุสานถูกส่งวิญญาณ ${out.length} ใบ`, 'fx'); },
    seal(st, p, ctx) { for (const t of targets(st, p, ctx, 'seal')) { if (t.player != null || greatImmune(t, ctx.src)) continue;
      const n = (p.turns_if_ghost && D(t.id).tribe === 'ผี') ? p.turns_if_ghost : (p.turns || 99); t.status.seal = Math.max(t.status.seal || 0, n); log(st, `${nm(t.id)} ถูกสายสิญจน์ ${n === 99 ? 'ถาวร' : n + ' เทิร์น'}`, 'fx'); } },
    sleep(st, p, ctx) { for (const t of targets(st, p, ctx, 'sleep')) { if (t.player != null) continue; t.status.sleep = Math.max(t.status.sleep || 0, p.turns || 1); fx(st, { k: 'sleep', uid: t.uid }); } },
    disable_attack(st, p, ctx) { for (const t of targets(st, p, ctx, 'disable_attack')) { if (t.player != null) continue; t.status.noatk = Math.max(t.status.noatk || 0, p.turns || 1); } },
    steal(st, p, ctx) {
      for (const t of targets(st, p, ctx, 'steal')) {
        if (t.player != null) continue;
        if (findSlot(st, t.uid)) { const E = st.players[t.owner], P = st.players[ctx.pid], j = P.slots.findIndex(x => !x); if (j < 0) continue;
          E.slots[E.slots.indexOf(t)] = null; t.owner = ctx.pid; P.slots[j] = t; log(st, `ขโมย ${nm(t.id)} มาไว้ฝั่งเรา`, 'fx'); continue; }
        if (!canSteal(st, t, ctx)) { log(st, `${nm(t.id)} ไม่ถูกเมตตามหานิยม`, 'fx'); continue; }
        const E = st.players[t.owner], j = st.players[ctx.pid].units.findIndex(x => !x); if (j < 0) continue;
        E.units[E.units.indexOf(t)] = null; t.owner = ctx.pid; t.played = st.turn; st.players[ctx.pid].units[j] = t; log(st, `${nm(t.id)} ถูกเมตตามหานิยม ย้ายมาอยู่ฝั่งเรา`, 'fx'); fx(st, { k: 'steal', uid: t.uid });
      }
    },
    draw(st, p, ctx) { for (let i = 0; i < (p.count || 1); i++) drawCard(st, ctx.pid); },
    discard(st, p, ctx) { const side = p.side === 'enemy' ? 1 - ctx.pid : ctx.pid, P = st.players[side];
      for (let i = 0; i < (p.count || 1) && P.hand.length; i++) { const j = p.random ? rint(st, P.hand.length) : P.hand.length - 1; const c = P.hand.splice(j, 1)[0]; P.crypt.push({ id: c.id }); log(st, `${side === ctx.pid ? 'เรา' : 'ศัตรู'}ทิ้ง ${nm(c.id)}`, 'fx'); } },
    reveal_hand(st, p, ctx) { const E = st.players[1 - ctx.pid]; if (!E.hand.length) return; const c = E.hand[rint(st, E.hand.length)]; c.revealed = true; log(st, `เปิดเผยไพ่ในมือศัตรู: ${nm(c.id)}`, 'fx'); },
    start_rahu(st, p) { const wasActive = rahuActive(st); st.rahuUntil = Math.max(st.rahuUntil, st.turn + (p.rounds || 1) * 2 - 1); log(st, '🌘 ราหูอมจันทร์!', 'rahu'); if (!wasActive) { st.rahuWas = true; rahuBegin(st); } },
    cleanse(st, p, ctx) { for (const t of targets(st, p, ctx, 'cleanse')) { if (t.player != null) continue;
      t.status.poison = null; t.status.seal = 0; t.status.sleep = 0; t.status.noatk = 0; if (t.status.stun && ctx.src && ctx.src.name_th === 'ยาสังกรณีตรีชวา') t.status.stun = false; fx(st, { k: 'heal', uid: t.uid, n: 0 }); } },
    choose(st, p, ctx) { const labels = p.options.map(optLabel);
      const v = pick(st, ctx, { kind: 'option', options: labels.map((_, i) => i), labels, count: 1, label: 'เลือกผลของการ์ด' });
      run(st, p.options[v == null ? 0 : v], ctx); },
    random_of(st, p, ctx) { run(st, p.options[rint(st, p.options.length)], ctx); },
    swap_stats(st, p, ctx) { for (const t of targets(st, p, ctx, 'swap_stats')) { if (t.player != null) continue; const a = atkOf(st, t), h = hpOf(st, t);
      t.patk += h - a; t.php += a - h + t.dmg; log(st, `${nm(t.id)} สลับพลัง เป็น ${h}/${a}`, 'fx'); } },
    consume_crypt(st, p, ctx) { const sides = p.side === 'any' ? [1 - ctx.pid, ctx.pid] : p.side === 'enemy' ? [1 - ctx.pid] : [ctx.pid];
      let n = 0; for (const s of sides) { const P = st.players[s]; while (n < (p.count || 1) && P.crypt.length) { P.purged.push(P.crypt.pop()); n++; } }
      if (n) { log(st, `${ctx.self ? nm(ctx.self.id) : ''} กลืนวิญญาณจากสุสาน`, 'fx'); run(st, p.then, ctx); } },
    discover(st, p, ctx) {
      const pool = Object.values(DEF).filter(d => !d.token && matchDef(d, p.pool));
      const choices = []; const bag = pool.slice(); while (choices.length < (p.choices || 3) && bag.length) choices.push(bag.splice(rint(st, bag.length), 1)[0].id);
      const v = pick(st, ctx, { kind: 'discover', options: choices, count: 1, label: 'เลือกการ์ด 1 ใบเข้ามือ' });
      if (v) addToHand(st, ctx.pid, { uid: uid(st), id: v, costSet: p.cost_set });
    },
    counter(st, p, ctx) { if (ctx.cctx) ctx.cctx.countered = true; },
    equip(st, p, ctx) { const ts = targets(st, p, ctx, 'equip'); for (const t of ts) { if (t.player != null) continue;
      t.equips.push({ id: ctx.cardId, atk: p.atk || 0, hp: p.hp || 0, grant: p.grant || [], rule: p.rule || null }); fx(st, { k: 'buff', uid: t.uid }); log(st, `${nm(ctx.cardId)} ติดกับ ${nm(t.id)}`); } },
    poison(st, p, ctx) { for (const t of targets(st, p, ctx, 'poison')) if (t.player == null) applyPoison(st, t, p.amount); },
    fight(st, p, ctx) { const ts = targets(st, p, ctx, 'fight').filter(t => t.player == null); if (ts.length < 2) return;
      const [a, b] = ts; const da = atkOf(st, a), db = atkOf(st, b); damageUnit(st, b, da, { unit: a, pid: a.owner }); damageUnit(st, a, db, { unit: b, pid: b.owner }); log(st, `${nm(a.id)} ปะทะ ${nm(b.id)}`, 'fx'); },
    gain_akhom(st, p, ctx) { st.players[ctx.pid].akhom += p.amount || 1; },
  };
  function optLabel(opt) {
    const e = opt[0], k = Object.keys(e)[0], p = e[k];
    const T = { buff: () => `+${p.atk || 0}/+${p.hp || 0}`, grant: () => `ได้ ${p.keywords.join(' ')}`, destroy: () => p.target === 'chosen_enemy_slot_card' ? 'ทำลายกับดัก/ของขลังศัตรู' : 'ทำลายยูนิต',
      revive: () => 'ชุบชีวิตจากสุสาน', cleanse: () => 'ล้างสถานะร้าย', seal: () => 'สายสิญจน์ศัตรู', heal: () => `ฟื้น HP ${p.amount}`, damage: () => `ดาเมจ ${p.amount}` };
    return (T[k] || (() => k))();
  }
  function applyPoison(st, u, x) { if (ruleOn(st, u, 'immune_poison')) return; const cur = u.status.poison; u.status.poison = { x: Math.max(x, cur ? cur.x : 0), n: 2 }; fx(st, { k: 'poison', uid: u.uid }); }
  function canSteal(st, t, ctx) {
    const d = D(t.id); if (isRulerOrDeity(d) || greatImmune(t, ctx.src)) return false;
    if (hasSpecial(d, 'immune_steal') && !sealed(t)) return false;
    for (const a of st.players[t.owner].units) if (a && !sealed(a) && specials(D(a.id), 'immune_steal').some(s => s.target === 'all_ally_units')) return false;
    return true;
  }
  function removeSlot(st, s) { const P = st.players[s.owner]; const i = P.slots.indexOf(s); if (i < 0) return; P.slots[i] = null; if (!D(s.id).token) P.crypt.push({ id: s.id }); log(st, `${nm(s.id)} ถูกทำลาย`, 'fx'); }

  /* ---------- ทริกเกอร์ ---------- */
  function evalIf(st, c, ctx, self) {
    if (!c) return true;
    const ev = ctx.event_unit;
    if (c.rahu_active != null && rahuActive(st) !== c.rahu_active) return false;
    if (c.tribe && !(ev && arr(c.tribe).includes(D(ev.id).tribe))) return false;
    if (c.ally_name && !st.players[self ? self.owner : ctx.pid].units.some(x => x && x !== self && D(x.id).name_th === c.ally_name)) return false;
    if (c.target_hp_lte != null) { const t = ctx.attack_target && findUnit(st, ctx.attack_target.uid); if (!t || hpOf(st, t) > c.target_hp_lte) return false; }
    if (c.target_element) { const t = ctx.attack_target; if (!t || D(t.id).element !== c.target_element) return false; }
    if (c.target_status) { const t = ctx.attack_target && findUnit(st, ctx.attack_target.uid); if (!t || !match(st, t, { status: c.target_status })) return false; }
    if (c.killed_by_enemy && !(self && self.lastHitBy != null && self.lastHitBy !== self.owner)) return false;
    if (c.attacker_tribe || c.attacker_cost_lte != null) {
      const a = ctx.attacker; if (!a) return false; const d = D(a.id);
      const okMain = (!c.attacker_tribe || d.tribe === c.attacker_tribe) && (c.attacker_cost_lte == null || costOfDef(d) <= c.attacker_cost_lte);
      const okAlt = c.or_attacker_name && d.name_th === c.or_attacker_name;
      if (!okMain && !okAlt) return false;
    }
    return true;
  }
  function fireUnit(st, u, on, extra) { // ทริกเกอร์ของยูนิต u เอง
    if (!u || sealed(u)) return;
    for (const r of rules(D(u.id))) {
      if (r.on !== on) continue;
      if (r.once) { if (u.once[on]) continue; }
      const ctx = ctxFor(st, u, extra);
      if (!evalIf(st, r.if, ctx, u)) continue;
      if (r.once) u.once[on] = true;
      run(st, r.do, ctx);
    }
  }
  function fireSide(st, pid, on, extra, exclude) {
    for (const u of st.players[pid].units.slice()) if (u && u !== exclude && findUnit(st, u.uid)) fireUnit(st, u, on, extra);
  }
  function trapCheck(st, pid, on, extra) { // กับดักคว่ำของ pid
    const P = st.players[pid];
    for (const s of P.slots.slice()) {
      if (!s || !s.facedown || s.placed === st.turn) continue;
      const d = D(s.id);
      for (const r of rules(d)) {
        if (r.on !== on) continue;
        const ctx = Object.assign({ pid, self: null, src: d }, extra);
        if (!evalIf(st, r.if, ctx, null)) continue;
        P.slots[P.slots.indexOf(s)] = null; P.crypt.push({ id: s.id });
        log(st, `กับดักทำงาน: ${nm(s.id)}!`, 'trap'); fx(st, { k: 'trap', id: s.id, pid });
        run(st, r.do, Object.assign(ctx, { cctx: extra.cctx }));
        return true;
      }
    }
    return false;
  }

  /* ---------- ความตาย (R10) ---------- */
  function checkDeaths(st) {
    for (let guard = 0; guard < 30; guard++) {
      const dead = [];
      for (const p of [st.cur, 1 - st.cur]) st.players[p].units.forEach(u => { if (u && (u.destroyed || hpOf(st, u) <= 0)) dead.push(u); });
      const deadSlots = [];
      for (const p of [st.cur, 1 - st.cur]) st.players[p].slots.forEach(s => { if (s && s.id === 'TK_HEARTBOX' && s.dmg >= (D(s.id).hp || 6)) deadSlots.push(s); });
      deadSlots.forEach(s => removeSlot(st, s));
      if (!dead.length) break;
      const died = [];
      for (const u of dead) {
        const P = st.players[u.owner], i = P.units.indexOf(u); if (i < 0) continue;
        const d = D(u.id);
        // อวตาร (ใช้ได้แม้ส่งวิญญาณ)
        if (!sealed(u) && u.avatarUses > 0) { u.avatarUses--; const b = specials(d, 'avatar')[0].buff; resetBack(u); u.patk += b.atk; u.php += b.hp; log(st, `${nm(u.id)} อวตาร! กลับมาพร้อม +${b.atk}/+${b.hp}`, 'fx'); fx(st, { k: 'revive', uid: u.uid }); continue; }
        // กล่องดวงใจ
        if (hasSpecial(d, 'heart_box') && P.slots.some(s => s && s.id === 'TK_HEARTBOX')) { resetBack(u); log(st, `${nm(u.id)} ไม่ตาย ตราบที่กล่องดวงใจยังอยู่`, 'fx'); fx(st, { k: 'revive', uid: u.uid }); continue; }
        // อมตะ
        if (!u.purge && !sealed(u) && has(st, u, 'อมตะ')) { const full = hasSpecial(d, 'undying_full'); resetBack(u); u.lost.push('อมตะ'); u.kw = u.kw.filter(k => k !== 'อมตะ');
          if (!full) u.dmg = maxHpOf(st, u) - 1; log(st, `${nm(u.id)} อมตะ ลุกขึ้นอีกครั้ง`, 'fx'); fx(st, { k: 'revive', uid: u.uid }); continue; }
        P.units[i] = null;
        for (const e of u.equips) P.crypt.push({ id: e.id });
        if (u.token) {} else if (u.purge) { P.purged.push({ id: u.id }); log(st, `${nm(u.id)} ถูกส่งวิญญาณ`, 'fx'); }
        else { P.crypt.push({ id: u.id }); log(st, `${nm(u.id)} ตาย`); }
        fx(st, { k: 'die', uid: u.uid, purge: !!u.purge });
        died.push(u);
      }
      for (const u of died) {
        if (!u.purge) fireUnitDead(st, u, 'death', { event_unit: u });
        fireSide(st, u.owner, 'ally_death', { event_unit: u });
        for (const p of [st.cur, 1 - st.cur]) fireSide(st, p, 'any_death', { event_unit: u });
        for (const p of [0, 1]) for (const s of st.players[p].slots) if (s && !s.facedown) { const sc = specials(D(s.id), 'soul_counter')[0];
          if (sc) { s.souls = (s.souls || 0) + 1; if (s.souls >= sc.threshold) { s.souls = 0; log(st, `${nm(s.id)} วิญญาณครบ ${sc.threshold}!`, 'fx'); run(st, sc.do, { pid: p, self: null, src: D(s.id) }); } } }
        if (u.lastHitUnit) { const k = findUnit(st, u.lastHitUnit); if (k && k.owner !== u.owner) { u.killedBy = k.uid; } }
      }
      checkWin(st); if (st.over) return;
    }
  }
  function resetBack(u) { u.dmg = 0; u.destroyed = false; u.purge = false; u.tmp = u.tmp.filter(t => (t.atk || 0) >= 0 && (t.hp || 0) >= 0); u.status = {}; }
  function fireUnitDead(st, u, on, extra) { // สิ้นใจ: ทำงานจากสุสาน (ctx.self ไม่อยู่บนสนาม)
    for (const r of rules(D(u.id))) { if (r.on !== on) continue; const ctx = { pid: u.owner, self: u, src: D(u.id), event_unit: u, selfExclude: u };
      if (!evalIf(st, r.if, ctx, u)) continue; run(st, r.do, ctx); }
  }
  function checkWin(st) {
    if (st.over) return;
    const a = st.players[0].fate <= 0, b = st.players[1].fate <= 0;
    if (a || b) { st.over = { winner: a && b ? -1 : a ? 1 : 0, reason: 'fate' }; log(st, a && b ? 'เสมอ!' : `${st.players[a ? 1 : 0].name} ชนะ!`, 'end'); }
  }

  /* ---------- จั่ว ---------- */
  function addToHand(st, pid, c) { const P = st.players[pid]; if (P.hand.length >= HAND_MAX) { P.crypt.push({ id: c.id }); log(st, `มือเต็ม ${pid === st.cur ? '' : ''}${nm(c.id)} ลงสุสาน (R4.4)`, 'warn'); return false; } P.hand.push(c); return true; }
  function drawCard(st, pid) {
    const P = st.players[pid];
    if (!P.deck.length) { P.emptyDraws++; damagePlayer(st, pid, P.emptyDraws); log(st, `${P.name} เด็คหมด เสียดวงชะตา ${P.emptyDraws}`, 'warn'); checkWin(st); return; }
    const id = P.deck.shift(); addToHand(st, pid, { uid: uid(st), id });
  }

  /* ---------- ราหู ---------- */
  function rahuBegin(st) { for (const u of allUnits(st)) fireUnit(st, u, 'rahu', {}); }
  function rahuEnd(st) { for (const p of st.players) for (const u of p.units) if (u) u.tmp = u.tmp.filter(t => t.exp !== 'rahu'); }

  /* ---------- เทิร์น ---------- */
  function startTurn(st) {
    const P = st.players[st.cur];
    st.trigCount = 0;
    P.akhomMax = Math.min(MAX_AKHOM, P.akhomMax + 1); P.akhom = P.akhomMax;
    const now = rahuActive(st);
    if (now && !st.rahuWas) { log(st, '🌘 ราหูอมจันทร์ ผีแกร่งขึ้น เทพอ่อนลง', 'rahu'); rahuBegin(st); }
    if (!now && st.rahuWas) { rahuEnd(st); log(st, '🌕 ราหูคลายจันทร์', 'rahu'); }
    st.rahuWas = now;
    if (P.turnsTaken > 0) drawCard(st, st.cur);
    P.turnsTaken++;
    if (st.over) return;
    for (const u of P.units) if (u) { u.attacks = 0; u.secondOnly = false; }
    P.shieldUsed = false;
    // ร่างคู่สลับ
    for (const u of P.units) if (u && u.form != null && !sealed(u) && P.turnsTaken > 1 && u.played < st.turn) u.form = 1 - u.form;
    fireSide(st, st.cur, 'turn_start', {});
    for (const s of P.slots.slice()) if (s && !s.facedown) for (const r of rules(D(s.id))) if (r.on === 'turn_start') run(st, r.do, { pid: st.cur, self: null, src: D(s.id) });
    // เล็งเป้า (lock_on)
    for (const u of P.units) if (u && !sealed(u)) { const s = specials(D(u.id), 'lock_on')[0]; if (!s) continue;
      const tgt = u.lock && findUnit(st, u.lock.uid);
      if (tgt && tgt.owner !== u.owner) { u.lock.n++; if (u.lock.n >= s.turns) { log(st, `${nm(u.id)} ยิงเป้า ${nm(tgt.id)} ส่งวิญญาณ!`, 'fx'); tgt.destroyed = true; tgt.purge = true; tgt.avatarUses = 0; tgt.lost.push('อมตะ', 'คงกระพัน'); u.lock = null; } }
      else { const opts = st.players[1 - u.owner].units.filter(x => x && !(D(x.id).tribe === s.exempt.tribe && D(x.id).rarity === s.exempt.rarity)).sort((a, b) => unitValue(st, b) - unitValue(st, a));
        u.lock = opts[0] ? { uid: opts[0].uid, n: 0 } : null; if (u.lock) log(st, `${nm(u.id)} เล็งเป้า ${nm(opts[0].id)}`, 'fx'); } }
    // พิษ ฟื้นฟู
    for (const u of P.units) if (u) {
      if (u.status.poison) { const ps = u.status.poison; damageUnit(st, u, ps.x, { pid: 1 - u.owner }); ps.n--; if (ps.n <= 0) u.status.poison = null; }
      if (has(st, u, 'ฟื้นฟู')) u.dmg = 0;
    }
    checkDeaths(st);
  }
  function endTurn(st) {
    const P = st.players[st.cur];
    fireSide(st, st.cur, 'turn_end', {});
    for (const p of st.players) for (const u of p.units) if (u) u.tmp = u.tmp.filter(t => t.exp !== 'turn');
    P.barami = Math.min(MAX_BARAMI, P.barami + Math.max(0, P.akhom)); P.akhom = 0;
    for (const u of P.units) if (u) for (const k of ['sleep', 'seal', 'noatk']) if (u.status[k] > 0 && u.status[k] < 99) u.status[k]--;
    checkDeaths(st); if (st.over) return;
    if (st.turn >= TURN_LIMIT) { const a = st.players[0].fate, b = st.players[1].fate; st.over = { winner: a === b ? -1 : a > b ? 0 : 1, reason: 'turns' }; log(st, `ครบ ${TURN_LIMIT} เทิร์น`, 'end'); return; }
    st.turn++; st.cur = 1 - st.cur;
    startTurn(st);
  }

  /* ---------- ต้นทุน ---------- */
  function costOf(st, pid, hc) {
    const d = D(hc.id); if (hc.costSet != null) return hc.costSet;
    let c = d.cost || 0;
    for (const s of specials(d, 'cost_mod')) if (s.if && s.if.self_fate_lte != null && st.players[pid].fate <= s.if.self_fate_lte) c += s.amount;
    return Math.max(0, c);
  }
  const usesBarami = d => d.type !== 'ยูนิต';
  function canPay(st, pid, hc) { const P = st.players[pid], c = costOf(st, pid, hc); return (usesBarami(D(hc.id)) ? P.akhom + P.barami : P.akhom) >= c; }
  function pay(st, pid, hc) { const P = st.players[pid]; let c = costOf(st, pid, hc);
    if (usesBarami(D(hc.id))) { const b = Math.min(P.barami, c); P.barami -= b; c -= b; } P.akhom -= c; }
  const isEquip = d => d.type === 'ของขลัง' && rules(d).some(r => r.do && r.do.some(e => e.equip));

  /* ---------- action ---------- */
  function apply(st, a) {
    st.fx = []; st.trigCount = 0;
    if (st.over) return err('เกมจบแล้ว');
    if (a.t === 'mulligan') return mulligan(st, a);
    if (st.phase !== 'main') return err('ยังอยู่ช่วงเปลี่ยนไพ่');
    if (a.t === 'concede') { st.over = { winner: 1 - a.pid, reason: 'concede' }; log(st, `${st.players[a.pid].name} ยอมแพ้`, 'end'); return ok(); }
    if (a.pid !== st.cur) return err('ยังไม่ใช่เทิร์นของคุณ');
    if (a.t === 'end') { log(st, `${st.players[st.cur].name} จบเทิร์น`, 'turn'); endTurn(st); return ok(); }
    if (a.t === 'play') return play(st, a);
    if (a.t === 'attack') return attack(st, a);
    return err('ไม่รู้จักคำสั่ง');
  }
  const ok = () => ({ ok: true }), err = m => ({ ok: false, err: m });
  function mulligan(st, a) {
    if (st.phase !== 'mulligan') return err('เลยช่วงเปลี่ยนไพ่แล้ว');
    const P = st.players[a.pid]; if (P.mulled) return err('เปลี่ยนไพ่ไปแล้ว');
    const back = P.hand.filter(c => (a.uids || []).includes(c.uid) && c.id !== 'TK_COIN');
    P.hand = P.hand.filter(c => !back.includes(c));
    for (const c of back) P.deck.push(c.id); shuffle(st, P.deck);
    const coin = P.hand.filter(c => c.id === 'TK_COIN'); P.hand = P.hand.filter(c => c.id !== 'TK_COIN');
    for (let i = 0; i < back.length; i++) P.hand.push({ uid: uid(st), id: P.deck.shift() });
    P.hand.push(...coin);
    P.mulled = true; if (back.length) log(st, `${P.name} เปลี่ยนไพ่ ${back.length} ใบ`);
    if (st.players.every(p => p.mulled)) { st.phase = 'main'; log(st, `เริ่มดวล! ${st.players[st.cur].name} เริ่มก่อน`, 'turn'); startTurn(st); }
    return ok();
  }
  function play(st, a) {
    const P = st.players[a.pid], hi = P.hand.findIndex(c => c.uid === a.card); if (hi < 0) return err('ไม่มีการ์ดใบนี้ในมือ');
    const hc = P.hand[hi], d = D(hc.id);
    if (!canPay(st, a.pid, hc)) return err(usesBarami(d) ? 'อาคมและบารมีไม่พอ' : 'อาคมไม่พอ');
    const onceRule = rules(d).find(r => r.once_per_game); if (onceRule && P.used[d.id]) return err('การ์ดนี้ใช้ได้ครั้งเดียวต่อเกม');
    if (d.type === 'ยูนิต') { if (a.slot == null || a.slot < 0 || a.slot > 4 || P.units[a.slot]) { if (!P.units.some(x => !x)) return err('สนามเต็ม'); return err('เลือกช่องยูนิตที่ว่าง'); } }
    if (d.type === 'กับดัก' || (d.type === 'ของขลัง' && !isEquip(d))) { if (!P.slots.some(x => !x)) return err('ช่องกับดัก/ของขลังเต็ม'); }
    if (isEquip(d) && !P.units.some(Boolean)) return err('ต้องมียูนิตฝ่ายเราให้ติดของขลัง');
    if (d.type === 'คาถา' || isEquip(d)) { const nd = need(st, a.pid, hc.uid, a.slot, a.picks || [], true); if (nd && nd.options.length === 0) return err('ไม่มีเป้าหมายที่ถูกต้อง'); }
    pay(st, a.pid, hc); P.hand.splice(hi, 1); if (onceRule) P.used[d.id] = true;
    const ctx = { pid: a.pid, src: d, picks: a.picks || [], pi: 0, cardId: d.id };
    if (d.type === 'ยูนิต') {
      const u = placeUnit(st, a.pid, mkUnit(st, a.pid, d.id), a.slot); ctx.self = u; ctx.selfExclude = u;
      log(st, `${P.name} ลง ${nm(d.id)}`, 'play'); fx(st, { k: 'summon', uid: u.uid });
      onEnter(st, u);
      for (const r of rules(d)) if (r.on === 'play' && evalIf(st, r.if, ctx, u)) run(st, r.do, ctx);
      for (const s of specials(d, 'discard_hand_buff')) { const n = P.hand.length; while (P.hand.length) P.crypt.push({ id: P.hand.pop().id });
        for (const x of P.units) if (x) { x.patk += n * s.per_card.atk; x.php += n * s.per_card.hp; grantTo(x, s.grant || [], 'perm'); } log(st, `ทิ้งไพ่ ${n} ใบ ทัพทั้งหมด +${n}/+${n}`, 'fx'); }
      for (const s of specials(d, 'stun')) { const t = targets(st, s.target, ctx, 'seal')[0]; if (t) { t.status.stun = true; log(st, `${nm(t.id)} ถูกหอกโมกขศักดิ์ ขยับไม่ได้`, 'fx'); } }
      for (const s of specials(d, 'misdirect')) { const t = targets(st, s.target, ctx, 'seal')[0]; if (t) { t.status.misdirect = true; log(st, `${nm(t.id)} ถูกผีโขมดหลอก`, 'fx'); } }
      for (const s of specials(d, 'duel')) { const t = targets(st, s.target, ctx, 'destroy')[0]; if (t && findUnit(st, u.uid)) hattayuddha(st, u, t, s); }
      for (const opp of [1 - a.pid]) fireSide(st, opp, 'enemy_play', { event_unit: u });
    } else if (d.type === 'คาถา') {
      log(st, `${P.name} ใช้คาถา ${nm(d.id)}`, 'play'); fx(st, { k: 'spell', id: d.id, pid: a.pid });
      ctx.isSpell = true;
      const cctx = { countered: false }; trapCheck(st, 1 - a.pid, 'enemy_spell', { cctx });
      if (!cctx.countered) { ctx.shieldCheck = true; for (const r of rules(d)) if (r.on === 'play') run(st, r.do, ctx); }
      if (!d.token) P.crypt.push({ id: d.id });
    } else if (d.type === 'กับดัก') {
      const j = P.slots.findIndex(x => !x); P.slots[j] = { uid: uid(st), id: d.id, owner: a.pid, facedown: true, placed: st.turn, dmg: 0 };
      log(st, `${P.name} วางกับดักคว่ำไว้`, 'play');
    } else if (d.type === 'ของขลัง') {
      if (isEquip(d)) { log(st, `${P.name} ใช้ของขลัง ${nm(d.id)}`, 'play'); for (const r of rules(d)) if (r.on === 'play') run(st, r.do, ctx); }
      else { const j = P.slots.findIndex(x => !x); P.slots[j] = { uid: uid(st), id: d.id, owner: a.pid, facedown: false, placed: st.turn, dmg: 0, souls: 0 }; log(st, `${P.name} ตั้ง ${nm(d.id)}`, 'play'); }
    }
    checkDeaths(st); return ok();
  }
  function hattayuddha(st, me, foe, s) {
    log(st, `ยุทธหัตถี! ${nm(me.id)} ปะทะ ${nm(foe.id)}`, 'fx');
    for (let i = 0; i < 30; i++) {
      const a = atkOf(st, me), b = atkOf(st, foe); if (a <= 0 && b <= 0) break;
      damageUnit(st, foe, a, { unit: me, pid: me.owner }); damageUnit(st, me, b, { unit: foe, pid: foe.owner });
      const md = hpOf(st, me) <= 0, fd = hpOf(st, foe) <= 0;
      if (md || fd) { if (fd) { foe.purge = true; foe.destroyed = true; } if (md) { me.purge = true; me.destroyed = true; }
        if (fd && !md) { me.patk += s.winner_buff.atk; me.php += s.winner_buff.hp; } break; }
    }
  }

  function attackOptions(st, pid, u) { // เป้าที่ u โจมตีได้ [{uid}|{player}|{slot}]
    const E = st.players[1 - pid], fly = has(st, u, 'เหาะเหิน');
    const guards = E.units.filter(x => x && has(st, x, 'ทวารบาล') && !sealed(x) && !shrouded(st, x));
    const ghost = D(u.id).tribe === 'ผี';
    let list = E.units.filter(x => x && !shrouded(st, x) && !(ghost && has(st, x, 'untargetable_by_ghosts')));
    if (u.secondOnly) list = list.filter(x => costOfDef(D(x.id)) < costOfDef(D(u.id)));
    const out = [];
    const mustGuard = guards.length && !fly;
    for (const x of list) if (!mustGuard || guards.includes(x)) out.push({ uid: x.uid });
    if (!mustGuard && !u.secondOnly) {
      const blocked = ghost && E.units.some(x => x && !sealed(x) && hasSpecial(D(x.id), 'ghosts_cannot_hit_player'));
      if (!blocked) out.push({ player: 1 - pid });
      for (const s of E.slots) if (s && s.id === 'TK_HEARTBOX') out.push({ slot: s.uid });
    }
    return out;
  }
  function attacksPerTurn(st, u) { let n = 1; if (has(st, u, 'โจมตี 2 ครั้ง')) n = 2; if (!sealed(u)) for (const s of specials(D(u.id), 'extra_attack')) n = Math.max(n, s.attacks_per_turn); return n; }
  function canAttack(st, u) {
    if (!u || u.owner !== st.cur) return 'ไม่ใช่ยูนิตของคุณ';
    if (u.status.stun) return 'ยูนิตนี้ถูกหอกโมกขศักดิ์ ขยับไม่ได้';
    if (u.status.sleep > 0) return 'ยูนิตนี้หลับอยู่';
    if (u.status.noatk > 0) return 'ยูนิตนี้ถูกห้ามโจมตี';
    if (atkOf(st, u) <= 0) return 'ATK เป็น 0 โจมตีไม่ได้';
    if (u.played === st.turn && !has(st, u, 'ฮึกเหิม')) return 'ยูนิตเพิ่งลงต้องรอเทิร์นหน้า (ยกเว้นฮึกเหิม)';
    if (u.attacks >= attacksPerTurn(st, u)) return 'ยูนิตนี้โจมตีครบแล้วในเทิร์นนี้';
    return null;
  }
  function attack(st, a) {
    let u = findUnit(st, a.unit); const why = canAttack(st, u); if (why) return err(why);
    a = Object.assign({}, a, { target: Object.assign({}, a.target) });
    const opts = attackOptions(st, a.pid, u);
    const tKey = a.target; const okT = opts.some(o => (o.uid && o.uid === tKey.uid) || (o.player != null && o.player === tKey.player) || (o.slot && o.slot === tKey.slot));
    if (!okT) { const E = st.players[1 - a.pid]; if (E.units.some(x => x && has(st, x, 'ทวารบาล')) && !has(st, u, 'เหาะเหิน')) return err('ต้องโจมตียูนิตทวารบาลก่อน (ยกเว้นเหาะเหิน)'); return err('เลือกเป้านี้ไม่ได้'); }
    u.attacks++; { const ea = sealed(u) ? null : specials(D(u.id), 'extra_attack')[0]; u.secondOnly = !!(ea && ea.only_vs && u.attacks === 1); }
    u.shroudOff = true;
    let target = tKey.uid ? findUnit(st, tKey.uid) : null;
    if (target) { firstTargeted(st, target, { pid: a.pid }); target = findUnit(st, tKey.uid); }
    // ผีโขมด: เปลี่ยนเป้าสุ่ม
    if (u.status.misdirect) { u.status.misdirect = false; const pool = allUnits(st).filter(x => x !== u); if (pool.length) { target = pool[rint(st, pool.length)]; log(st, `${nm(u.id)} ถูกหลอก ตีผิดเป้าไปที่ ${nm(target.id)}`, 'fx'); tKey.player = undefined; tKey.slot = undefined; } }
    // ปกป้องผู้ปกครอง
    if (target && target.owner !== u.owner && D(target.id).category === 'ผู้ปกครอง') {
      const g = st.players[target.owner].units.find(x => x && x !== target && !sealed(x) && hasSpecial(D(x.id), 'protect_ruler'));
      if (g) { log(st, `${nm(g.id)} เข้าขวางแทน ${nm(target.id)}`, 'fx'); target = g; }
    }
    const tname = target ? nm(target.id) : tKey.player != null ? 'ดวงชะตา' : 'กล่องดวงใจ';
    log(st, `${nm(u.id)} โจมตี ${tname}`, 'atk');
    fireUnit(st, u, 'attack', { attack_target: target });
    u = findUnit(st, a.unit); if (!u || st.over) { checkDeaths(st); return ok(); }
    if (target && !findUnit(st, target.uid)) { checkDeaths(st); return ok(); }
    const cctx = { countered: false }; trapCheck(st, 1 - a.pid, 'enemy_attack', { attacker: u, attack_target: target, cctx });
    u = findUnit(st, a.unit);
    if (cctx.countered || !u || u.destroyed) { log(st, 'การโจมตีถูกยกเลิก', 'fx'); checkDeaths(st); return ok(); }
    fx(st, { k: 'attack', from: u.uid, to: target ? target.uid : tKey.player != null ? 'p' + tKey.player : tKey.slot });
    const life = has(st, u, 'ดูดชีพ'), pois = poisonKw(st, u), pierce = ruleOn(st, u, 'pierce_barrier');
    if (target && target.owner !== undefined && findUnit(st, target.uid)) {
      const ea = D(u.id).element, eb = D(target.id).element;
      let da = atkOf(st, u), db = atkOf(st, target);
      if (BEATS[ea] === eb) da = Math.floor(da * 1.5);
      if (BEATS[eb] === ea) db = Math.floor(db * 1.5);
      da *= multVs(st, u, target); db *= multVs(st, target, u);
      const hpB = hpOf(st, target);
      const dealtA = damageUnit(st, target, da, { unit: u, pid: u.owner, pierce, combat: true });
      const dealtB = target.owner !== u.owner ? damageUnit(st, u, db, { unit: target, pid: target.owner, combat: true, pierce: ruleOn(st, target, 'pierce_barrier') }) : 0;
      if (life && dealtA) healPlayer(st, u.owner, dealtA);
      if (has(st, target, 'ดูดชีพ') && dealtB) healPlayer(st, target.owner, dealtB);
      if (pois && dealtA) applyPoison(st, target, pois);
      const tp = poisonKw(st, target); if (tp && dealtB) applyPoison(st, u, tp);
      if (hasSpecial(D(u.id), 'trample') && !sealed(u) && dealtA > hpB && hpB > 0) { damagePlayer(st, target.owner, dealtA - hpB); log(st, `ดาเมจทะลุ ${dealtA - hpB}`, 'fx'); }
      const tDies = hpOf(st, target) <= 0, uDies = hpOf(st, u) <= 0;
      fireUnit(st, u, 'after_hit', { attack_target: target });
      if (findUnit(st, target.uid)) fireUnit(st, target, 'attacked', { attacker: u });
      if (tDies && findUnit(st, u.uid) && has(st, u, 'ลิ้มเลือด')) { u.patk++; u.php++; }
      if (uDies && findUnit(st, target.uid) && has(st, target, 'ลิ้มเลือด')) { target.patk++; target.php++; }
      checkDeaths(st);
      if (tDies && !findUnit(st, target.uid) && findUnit(st, u.uid)) fireUnit(st, u, 'kill', { event_unit: target });
    } else if (tKey.player != null) {
      const n = damagePlayer(st, tKey.player, atkOf(st, u)); if (life) healPlayer(st, u.owner, n);
      fireUnit(st, u, 'after_hit', {});
    } else if (tKey.slot) { const s = findSlot(st, tKey.slot); if (s) { s.dmg += atkOf(st, u); fx(st, { k: 'dmg', slot: s.uid, n: atkOf(st, u) }); } }
    checkDeaths(st); checkWin(st); return ok();
  }

  /* ---------- วางแผนการเลือก (UI/AI) ---------- */
  function need(st, pid, cardUid, slot, picks, strict) { // คืน spec ของสิ่งที่ต้องเลือกถัดไป หรือ null ถ้าครบ
    const s2 = clone(st); s2.log = []; const P = s2.players[pid], hc = P.hand.find(c => c.uid === cardUid); if (!hc) return null;
    const d = D(hc.id);
    if (d.type === 'ยูนิต' && (slot == null || P.units[slot])) { slot = P.units.findIndex(x => !x); if (slot < 0) return null; }
    P.akhom = 99; P.barami = 3;
    const ctx = { pid, src: d, picks: picks.slice(), pi: 0, plan: true, strict: !!strict, cardId: d.id };
    try {
      P.hand = P.hand.filter(c => c !== hc);
      if (d.type === 'ยูนิต') { const u = placeUnit(s2, pid, mkUnit(s2, pid, d.id), slot); ctx.self = u; ctx.selfExclude = u;
        for (const r of rules(d)) if (r.on === 'play' && evalIf(s2, r.if, ctx, u)) run(s2, r.do, ctx);
        for (const sp of rules(d).filter(r => ['stun', 'misdirect', 'duel'].includes(r.special))) targets(s2, sp.target, ctx, 'seal'); }
      else if (d.type === 'คาถา' || isEquip(d)) { ctx.isSpell = d.type === 'คาถา'; for (const r of rules(d)) if (r.on === 'play') run(s2, r.do, ctx); }
    } catch (e) { if (e instanceof Need) return e.spec; throw e; }
    return null;
  }
  function legal(st, pid) { // action ที่ทำได้ (ยังไม่รวมการเลือกเป้าของเอฟเฟกต์)
    const P = st.players[pid], out = { plays: [], attacks: [] };
    if (st.over || st.phase !== 'main' || st.cur !== pid) return out;
    for (const hc of P.hand) { const d = D(hc.id); if (!canPay(st, pid, hc)) continue;
      if (rules(d).some(r => r.once_per_game) && P.used[d.id]) continue;
      if (d.type === 'ยูนิต' && !P.units.some(x => !x)) continue;
      if ((d.type === 'กับดัก' || (d.type === 'ของขลัง' && !isEquip(d))) && !P.slots.some(x => !x)) continue;
      if (isEquip(d) && !P.units.some(Boolean)) continue;
      if (d.type === 'คาถา' || isEquip(d)) { const nd = need(st, pid, hc.uid, null, [], true); if (nd && !nd.options.length) continue; }
      out.plays.push(hc.uid); }
    for (const u of P.units) if (u && !canAttack(st, u)) out.attacks.push({ unit: u.uid, targets: attackOptions(st, pid, u) });
    return out;
  }

  /* ---------- เกมใหม่ ---------- */
  function newGame(opt) {
    const st = { v: 1, seed: opt.seed >>> 0, rng: opt.seed >>> 0, nextUid: 0, turn: 1, cur: 0, phase: 'mulligan', rahuUntil: 0, rahuWas: false,
      over: null, log: [], fx: [], trigCount: 0, players: [] };
    st.cur = rint(st, 2);
    for (let p = 0; p < 2; p++) {
      st.players.push({ name: opt.names[p], fate: MAX_FATE, deck: shuffle(st, opt.decks[p].slice()), hand: [], units: [null, null, null, null, null], slots: [null, null],
        crypt: [], purged: [], akhom: 0, akhomMax: 0, barami: 0, emptyDraws: 0, turnsTaken: 0, used: {}, mulled: false, shieldUsed: false });
    }
    for (const p of [st.cur, 1 - st.cur]) { const n = p === st.cur ? 3 : 4; for (let i = 0; i < n; i++) drawCard(st, p); }
    st.players[1 - st.cur].hand.push({ uid: uid(st), id: 'TK_COIN' });
    log(st, `${st.players[st.cur].name} ได้เริ่มก่อน · ${st.players[1 - st.cur].name} ได้เบี้ยหอยเสี่ยงทาย`, 'turn');
    return st;
  }
  function deckErrors(ids) {
    const errs = []; if (ids.length !== 30) errs.push(`เด็คต้องมี 30 ใบ (ตอนนี้ ${ids.length})`);
    const cnt = {}; ids.forEach(i => cnt[i] = (cnt[i] || 0) + 1);
    const lim = { 'ธรรมดา': 3, 'ทั่วไป': 3, 'หายาก': 2, 'มหากาพย์': 2, 'ตำนาน': 1, 'พระเจ้า': 1, 'ผู้สรรสร้าง': 1 };
    for (const id in cnt) { const d = D(id); if (!d) { errs.push('การ์ดไม่รู้จัก ' + id); continue; } if (cnt[id] > lim[d.rarity]) errs.push(`${d.name_th} ใส่ได้ไม่เกิน ${lim[d.rarity]} ใบ`); }
    const hi = ids.filter(i => ['ตำนาน', 'พระเจ้า', 'ผู้สรรสร้าง'].includes(D(i).rarity)).length; if (hi > 3) errs.push('ตำนาน+พระเจ้า+ผู้สรรสร้าง รวมไม่เกิน 3 ใบ');
    if (ids.filter(i => D(i).rarity === 'ผู้สรรสร้าง').length > 1) errs.push('ผู้สรรสร้างได้ 1 ใบต่อเด็ค');
    if (ids.filter(i => ['เทพเจ้า', 'ผู้ปกครอง'].includes(D(i).category)).length > 3) errs.push('เทพเจ้า+ผู้ปกครอง รวมไม่เกิน 3 ใบ');
    return errs;
  }
  function view(st, pid) { // R14.3 ซ่อนข้อมูลลับของอีกฝ่าย
    const v = clone(st); const E = v.players[1 - pid];
    E.hand = E.hand.map(c => c.revealed ? c : { uid: c.uid, id: null }); E.deck = E.deck.length; v.players[pid].deck = v.players[pid].deck.length;
    E.slots = E.slots.map(s => s && s.facedown ? { uid: s.uid, facedown: true, owner: s.owner } : s); v.rng = 0; return v;
  }

  return { newGame, apply, need, legal, view, deckErrors, D, atkOf, hpOf, maxHpOf, kwOf, has, sealed, rahuActive, costOf, canPay, canAttack, attackOptions, attacksPerTurn,
    unitValue, isEquip, clone, shrouded, specials, RARITY, BEATS };
}
const api = { create };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SiamEngine = api;
})(typeof self !== 'undefined' ? self : this);
