/* ---------- หน้าดวลกระดานชนวน (ผู้เล่น = 0, AI = 1) ---------- */
const DUEL_DATA = __DUELDATA__;
const DE = SiamEngine.create(DUEL_DATA), DAI = SiamAI.create(DE);
DUEL_DATA.tokens.forEach(t => { if (!BY[t.id]) BY[t.id] = { id: t.id, name_th: t.name_th, rarity_code: 'common', type: t.type || 'ยูนิต', element: t.element || 'อากาศ', tribe: t.tribe || '',
  cost: t.cost || 0, atk: t.atk ?? null, hp: t.hp ?? null, keywords: t.keywords || [], text_th: t.note || (t.id === 'TK_COIN' ? 'ได้อาคม +1 เทิร์นนี้' : 'โทเคน: ตายแล้วหายไป ไม่ลงสุสาน') }; });
const SLOT_X = [9.4, 26.2, 42.8, 59.4, 76.0], TRAP_X = [35.4, 54.9];
const AI_LV = { easy: 'ง่าย', normal: 'ปกติ', hard: 'ยาก' };
const KW_SHORT = { 'ทวารบาล': 'ทวาร', 'กำบัง': 'กำบัง', 'คงกระพัน': 'คงกระพัน', 'อมตะ': 'อมตะ', 'เหาะเหิน': 'เหาะ', 'ฮึกเหิม': 'ฮึก', 'ดูดชีพ': 'ดูดชีพ', 'ลิ้มเลือด': 'ลิ้มเลือด', 'ฟื้นฟู': 'ฟื้นฟู' };
let DS = null, DSET = { deck: 'starter:ayutthaya', level: 'normal' }, dSel = null, dBusy = false, dLogOpen = false;

function duelDecks() {
  const u = me(), out = [];
  (u && u.decks || []).forEach((d, i) => { const errs = DE.deckErrors(d.cards); out.push({ key: 'my:' + i, name: d.name, sub: errs.length ? errs[0] : `เด็คของคุณ · ${d.cards.length} ใบ`, ok: !errs.length, ids: d.cards }); });
  Object.entries(SiamAI.DECKS).forEach(([k, d]) => out.push({ key: 'starter:' + k, name: d.name, sub: 'เด็คสำเร็จรูป (ยืมเล่น)', ok: true, ids: d.ids }));
  return out;
}
function openDuelSetup() {
  const m = document.getElementById('modal'), b = document.getElementById('modalBox'); m.classList.remove('ev');
  const decks = duelDecks(); if (!decks.some(d => d.key === DSET.deck && d.ok)) DSET.deck = (decks.find(d => d.ok && d.key.startsWith('my:')) || decks.find(d => d.ok)).key;
  const draw = () => {
    b.innerHTML = `<div class="dsetup"><h3>ดวลกับหมอผีเฒ่า (AI)</h3>
      <h4>เลือกเด็ค</h4><div class="opts">${decks.map(d => `<button class="opt ${d.key === DSET.deck ? 'on' : ''}" data-deck="${d.key}" ${d.ok ? '' : 'disabled'}>${d.name}<small>${d.sub}</small></button>`).join('')}</div>
      <h4>ระดับฝีมือ</h4><div class="opts">${Object.entries(AI_LV).map(([k, t]) => `<button class="opt ${k === DSET.level ? 'on' : ''}" data-lv="${k}">${t}<small>${k === 'easy' ? 'เหมาะกับการหัดเล่น' : k === 'normal' ? 'เล่นตามสถานการณ์' : 'คิดล่วงหน้า 1 เทิร์น'}</small></button>`).join('')}</div>
      <p style="font-size:13px;color:var(--muted)">ยังไม่เคยเล่น? <a href="#" id="dsTut" style="color:var(--gold2)">เริ่มบทเรียนกับหมอผีเฒ่า</a> · เด็คที่จะใช้ได้ต้องครบ 30 ใบและผ่านกติกาจัดเด็ค ถ้าการ์ดยังไม่พอ เลือกเด็คสำเร็จรูปไปก่อนได้ · ช่วง CBT การดวลกับ AI ยังไม่มีรางวัล</p>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px"><button class="btn ghost" id="dsX">ยกเลิก</button><button class="btn" id="dsGo">เริ่มดวล</button></div></div>`;
    b.querySelectorAll('[data-deck]').forEach(x => x.onclick = () => { DSET.deck = x.dataset.deck; draw(); });
    b.querySelectorAll('[data-lv]').forEach(x => x.onclick = () => { DSET.level = x.dataset.lv; draw(); });
    b.querySelector('#dsX').onclick = () => m.classList.remove('on');
    b.querySelector('#dsTut').onclick = e => { e.preventDefault(); openTutorialList(); };
    b.querySelector('#dsGo').onclick = () => { m.classList.remove('on'); TUT = null; startDuel(decks.find(d => d.key === DSET.deck).ids); };
  };
  draw(); m.classList.add('on');
}
function startDuel(myIds) {
  const keys = Object.keys(SiamAI.DECKS), aiKey = keys[Math.floor(Math.random() * keys.length)];
  const u = me();
  DS = { st: DE.newGame({ seed: (Math.random() * 2 ** 32) >>> 0, names: [u.name || 'ผู้เล่น', 'หมอผีเฒ่า'], decks: [myIds, SiamAI.DECKS[aiKey].ids] }), level: DSET.level, aiDeck: SiamAI.DECKS[aiKey].name, mull: new Set() };
  dSel = null; dBusy = false;
  DE.apply(DS.st, { t: 'mulligan', pid: 1, uids: DAI.mulliganPick(DS.st, 1) });
  show('duel'); document.getElementById('dOver').classList.remove('on');
  renderDuel(); showMulligan();
}
function showMulligan() {
  const m = document.getElementById('modal'), b = document.getElementById('modalBox'), P = DS.st.players[0];
  const first = DS.st.cur === 0;
  const draw = () => {
    b.innerHTML = `<h3>เปลี่ยนไพ่เริ่มเกม</h3><p>${first ? 'คุณได้เริ่มก่อน' : 'คู่ดวลเริ่มก่อน คุณได้ <b>เบี้ยหอยเสี่ยงทาย</b> (อาคม +1 หนึ่งครั้ง)'} · แตะการ์ดที่ไม่อยากได้เพื่อเปลี่ยน ทำได้ครั้งเดียว</p><div class="mull" id="mullBox"></div>
      <div style="display:flex;justify-content:flex-end"><button class="btn" id="mOkM">${DS.mull.size ? `เปลี่ยน ${DS.mull.size} ใบแล้วเริ่ม` : 'เก็บทั้งหมด เริ่มดวล'}</button></div>`;
    const box = b.querySelector('#mullBox');
    P.hand.forEach(c => { const el = handCardEl(c, { w: Math.min(130, (innerWidth - 80) / 5) }); if (DS.mull.has(c.uid)) el.classList.add('x');
      el.onclick = () => { if (c.id === 'TK_COIN') return; DS.mull.has(c.uid) ? DS.mull.delete(c.uid) : DS.mull.add(c.uid); draw(); }; box.appendChild(el); });
    b.querySelector('#mOkM').onclick = () => { m.classList.remove('on'); DE.apply(DS.st, { t: 'mulligan', pid: 0, uids: [...DS.mull] }); afterAction(); };
  };
  draw(); m.classList.add('on');
}
function handCardEl(c, opt) {
  const base = BY[c.id], cost = DS && c.uid ? DE.costOf(DS.st, 0, c) : base.cost;
  const w = document.createElement('div'); w.className = 'hcard'; w.dataset.cid = c.id;
  w.appendChild(cardEl(Object.assign({}, base, { cost }), { w: opt.w }));
  if (opt.w >= 90) { const z = document.createElement('button'); z.className = 'zz'; z.type = 'button'; z.textContent = '⌕'; z.title = 'ดูขยาย'; z.onclick = e => { e.stopPropagation(); zoomCard({ id: c.id, at: 3 }); }; w.appendChild(z); }
  longPress(w, () => zoomCard({ id: c.id, at: 3 }));
  return w;
}
function longPress(el, fn) { let t = null, fired = false;
  el.addEventListener('pointerdown', () => { fired = false; clearTimeout(t); t = setTimeout(() => { fired = true; fn(); }, 520); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(k => el.addEventListener(k, () => clearTimeout(t)));
  el.addEventListener('click', e => { if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; } }, true);
  el.addEventListener('contextmenu', e => { e.preventDefault(); fn(); }); }
function dCurNeed() { if (!dSel || dSel.kind !== 'play') return null; return DE.need(DS.st, 0, dSel.card, dSel.slot, dSel.picks); }
function prompt(text) { const p = document.getElementById('dPrompt'); if (!text) { p.classList.remove('on'); return; }
  p.innerHTML = `<span>${text}</span><button id="dpX">ยกเลิก</button>`; p.classList.add('on'); p.querySelector('#dpX').onclick = () => { dSel = null; renderDuel(); }; }

function renderDuel() {
  const st = DS.st, B = document.getElementById('dBoard');
  B.innerHTML = `<div class="dmoon ${DE.rahuActive(st) ? 'on' : ''}"></div><div class="dturn"><span>เทิร์น ${TH(st.turn)}</span><span>${DE.rahuActive(st) ? '🌘 ราหูอมจันทร์' : ''}</span></div>`;
  const L = DE.legal(st, 0), ready = new Set(L.attacks.map(a => a.unit));
  const need = dCurNeed();
  // เป้าที่เลือกได้ตอนนี้
  let tgtUnits = new Set(), tgtPlayer = false, tgtSlots = new Set(), canSlots = new Set();
  if (dSel && dSel.kind === 'atk') { const a = L.attacks.find(x => x.unit === dSel.unit); if (a) a.targets.forEach(t => { if (t.uid) tgtUnits.add(t.uid); if (t.player != null) tgtPlayer = true; if (t.slot) tgtSlots.add(t.slot); }); }
  if (dSel && dSel.kind === 'play') {
    const d = DE.D(st.players[0].hand.find(c => c.uid === dSel.card).id);
    if (d.type === 'ยูนิต' && dSel.slot == null) st.players[0].units.forEach((u, i) => { if (!u) canSlots.add(i); });
    else if (need && (need.kind === 'unit' || need.kind === 'units')) need.options.forEach(x => tgtUnits.add(x));
    else if (need && need.kind === 'slotcard') need.options.forEach(x => tgtSlots.add(x));
  }
  for (const side of [1, 0]) {
    const P = st.players[side], top = side === 1 ? 24.9 : 60.0, ttop = side === 1 ? 12.8 : 77.5;
    P.units.forEach((u, i) => {
      const s = document.createElement('div'); s.className = 'dslot u'; s.style.left = SLOT_X[i] + '%'; s.style.top = top + '%'; s.dataset.side = side; s.dataset.i = i;
      if (side === 0 && canSlots.has(i)) { s.classList.add('can'); s.onclick = () => { dSel.slot = i; continuePlay(); }; }
      if (u) {
        const el = unitEl(u, side === 0 && ready.has(u.uid)); s.appendChild(el);
        if (tgtUnits.has(u.uid)) { s.classList.add('tgt'); el.onclick = e => { e.stopPropagation(); pickTarget(u.uid); }; }
        else el.onclick = () => clickUnit(u);
      }
      B.appendChild(s);
    });
    P.slots.forEach((c, i) => {
      const s = document.createElement('div'); s.className = 'dslot t'; s.style.left = TRAP_X[i] + '%'; s.style.top = ttop + '%';
      if (c) { const t = document.createElement('div'); t.className = 'dtrap';
        const showFace = !c.facedown || side === 0;
        if (showFace) { t.classList.add('up'); const ce = cardEl(BY[c.id], { w: 60 }); if (c.facedown) ce.style.filter = 'brightness(.6)'; t.appendChild(ce);
          if (c.id === 'TK_HEARTBOX') t.insertAdjacentHTML('beforeend', `<small>HP ${Math.max(0, (DE.D(c.id).hp || 6) - c.dmg)}</small>`);
          else if (c.facedown) t.insertAdjacentHTML('beforeend', '<small>คว่ำอยู่</small>');
          else if (c.souls != null && DE.specials(DE.D(c.id), 'soul_counter').length) t.insertAdjacentHTML('beforeend', `<small>วิญญาณ ${c.souls}/5</small>`); }
        s.appendChild(t);
        if (tgtSlots.has(c.uid)) { s.classList.add('tgt'); t.onclick = () => dSel.kind === 'atk' ? doAttack({ slot: c.uid }) : pickTarget(c.uid); }
        else t.onclick = () => { if (showFace) zoomCard({ id: c.id, at: 4 }); else toast('กับดักคว่ำของศัตรู ทำงานเองเมื่อเงื่อนไขเกิด'); };
      }
      B.appendChild(s);
    });
  }
  renderPBox(1, tgtPlayer); renderPBox(0, false); renderHand(L); renderLog(); renderMid(L);
  if (dSel && dSel.kind === 'atk') prompt('เลือกเป้าที่จะโจมตี');
  else if (dSel && dSel.kind === 'play') { const d = DE.D(st.players[0].hand.find(c => c.uid === dSel.card).id);
    prompt(d.type === 'ยูนิต' && dSel.slot == null ? `เลือกช่องวาง ${d.name_th}` : need ? need.label || 'เลือกเป้าหมาย' : ''); }
  else prompt('');
  tutPaint();
}
function unitEl(u, ready) {
  const st = DS.st, el = document.createElement('div'); el.className = 'dunit' + (ready ? ' ready' : '') + (dSel && dSel.unit === u.uid ? ' sel' : '');
  el.dataset.uid = u.uid; el.dataset.cid = u.id;
  if (u.status.sleep > 0 || u.status.stun || u.status.noatk > 0) el.classList.add('sleep');
  el.appendChild(cardEl(BY[u.id], { w: 90 }));
  const a = DE.atkOf(st, u), h = DE.hpOf(st, u), d = DE.D(u.id);
  const st2 = document.createElement('div'); st2.className = 'dstat';
  st2.innerHTML = `<b class="a ${a > (d.atk || 0) ? 'up' : a < (d.atk || 0) ? 'down' : ''}${a > 99 ? ' sm' : ''}">${TH(a)}</b><b class="h ${u.dmg > 0 ? 'down' : h > (d.hp || 0) ? 'up' : ''}${h > 99 ? ' sm' : ''}">${TH(h)}</b>`;
  el.appendChild(st2);
  const kws = DE.kwOf(st, u).filter((k, i, arr) => arr.indexOf(k) === i).map(k => (k === 'กำบัง' && u.shroudOff) ? null : (KW_SHORT[k] || (/^พิษ/.test(k) ? k : null))).filter(Boolean);
  const bad = []; if (u.status.sleep > 0) bad.push('หลับ'); if (DE.sealed(u)) bad.push(u.status.stun ? 'ต้องหอก' : 'สายสิญจน์'); if (u.status.poison) bad.push('ติดพิษ'); if (u.status.noatk > 0) bad.push('ห้ามตี');
  if (kws.length || bad.length) { const k = document.createElement('div'); k.className = 'dkw'; k.innerHTML = kws.slice(0, 3).map(x => `<i>${x}</i>`).join('') + bad.map(x => `<i class="bad">${x}</i>`).join(''); el.appendChild(k); }
  return el;
}
function renderPBox(side, tgt) {
  const st = DS.st, P = st.players[side], box = document.getElementById(side ? 'dOpp' : 'dMe');
  box.className = 'pbox' + (st.cur === side && st.phase === 'main' ? ' cur' : '') + (tgt ? ' tgt' : '');
  const res = `<span class="res">${Array.from({ length: Math.max(P.akhomMax, P.akhom) }, (_, i) => `<i class="${i < P.akhom ? 'on' : ''}"></i>`).join('')}&nbsp;${Array.from({ length: 3 }, (_, i) => `<u class="${i < P.barami ? 'on' : ''}"></u>`).join('')}</span>`;
  box.innerHTML = `<div class="pic"></div><div class="nm">${P.name}${side ? ` · ${AI_LV[DS.level]}` : ''}</div><div class="fate">${Math.max(0, P.fate)}<small>ดวงชะตา</small></div>${res}
    <div class="meta"><span>เด็ค ${P.deck.length}</span>${side ? `<span class="backs">${P.hand.map(() => '<span></span>').join('')}</span>` : ''}<button data-crypt="${side}">สุสาน ${P.crypt.length}</button>${side === 0 ? '<button class="logbtn" data-log="1">บันทึก</button>' : ''}</div>`;
  box.querySelector('.pic').appendChild(side ? charImg('npc_shaman', 'bust', 'หมอผีเฒ่า') : charImg(me().gender, 'bust_talk_right', P.name));
  box.querySelector('[data-crypt]').onclick = e => { e.stopPropagation(); showCrypt(side); };
  const lb = box.querySelector('[data-log]'); if (lb) lb.onclick = e => { e.stopPropagation(); dLogOpen = !dLogOpen; document.getElementById('dLog').classList.toggle('on', dLogOpen); };
  box.onclick = tgt ? () => doAttack({ player: 1 }) : null;
}
function renderHand(L) {
  const st = DS.st, P = st.players[0], H = document.getElementById('dHand');
  const mobile = matchMedia('(max-width:900px),(orientation:portrait)').matches;
  H.innerHTML = `<div class="ttl">ไพ่ในมือ <small>${P.hand.length} / 5 · แตะการ์ดเพื่อลง</small></div><div class="hgrid"></div>`;
  const g = H.querySelector('.hgrid'), playable = new Set(L.plays);
  const hh = H.getBoundingClientRect().height; const w = mobile ? Math.max(50, Math.min(96, (hh - 28) / 1.5)) : 118;
  P.hand.forEach(c => {
    const el = handCardEl(c, { w }); const can = playable.has(c.uid) && st.cur === 0 && !dBusy;
    el.classList.add(can ? 'play' : 'dim'); if (dSel && dSel.card === c.uid) el.classList.add('sel');
    el.onclick = () => {
      if (st.cur !== 0 || dBusy) return toast('รอเทิร์นของคุณ');
      if (!can) { if (TUT && !TCH[TUT.ch].full) { tutAllowCard(c); return; } const d = DE.D(c.id); const why = !DE.canPay(st, 0, c) ? (d.type === 'ยูนิต' ? 'อาคมไม่พอ' : 'อาคมและบารมีไม่พอ') : d.type === 'ยูนิต' ? 'สนามเต็ม' : 'ไม่มีเป้าหมายหรือช่องว่างที่ใช้ได้'; return toast(why); }
      if (dSel && dSel.card === c.uid) { dSel = null; return renderDuel(); }
      if (typeof tutAllowCard === 'function' && !tutAllowCard(c)) return;
      dSel = { kind: 'play', card: c.uid, slot: null, picks: [] };
      const d = DE.D(c.id); if (d.type !== 'ยูนิต') continuePlay(); else renderDuel();
    };
    g.appendChild(el);
  });
}
function renderMid(L) {
  const st = DS.st, M = document.getElementById('dMid'), mine = st.cur === 0 && !st.over;
  const anyMove = L.plays.length || L.attacks.length;
  M.innerHTML = `<button class="btn" id="dEnd" ${mine && !dBusy ? '' : 'disabled'}>${mine ? (anyMove ? 'จบเทิร์น' : 'จบเทิร์น ✓') : 'เทิร์นคู่ดวล…'}</button>
    ${TUT ? '' : `<div class="info">ลงการ์ด: แตะการ์ดในมือ แล้วแตะช่องหรือเป้า<br>โจมตี: แตะยูนิตที่<b>เรืองเขียว</b> แล้วแตะเป้า<br>ดูการ์ด: แตะยูนิตบนกระดาน · กดค้างหรือคลิกขวาที่การ์ดในมือ<br>อาคม ◆ ใช้ลงการ์ด · บารมี ● เก็บอาคมที่เหลือไว้ใช้กับคาถา/กับดัก/ของขลัง</div>`}
    <button class="btn ghost" id="dQuit" style="height:38px">ยอมแพ้</button>`;
  M.querySelector('#dEnd').onclick = () => { if (st.cur !== 0 || dBusy) return; if (!tutAllowEnd()) return; dSel = null; DE.apply(st, { t: 'end', pid: 0 }); tutOnAction({ t: 'end' }); afterAction(); };
  M.querySelector('#dQuit').onclick = () => { if (!confirmQuit()) return; };
}
function confirmQuit() {
  const m = document.getElementById('modal'), b = document.getElementById('modalBox');
  b.innerHTML = `<h3>ยอมแพ้?</h3><p>การดวลนี้จะนับเป็นแพ้</p><div style="display:flex;justify-content:flex-end;gap:10px"><button class="btn ghost" id="qN">เล่นต่อ</button><button class="btn" id="qY">ยอมแพ้</button></div>`;
  m.classList.add('on'); b.querySelector('#qN').onclick = () => m.classList.remove('on');
  b.querySelector('#qY').onclick = () => { m.classList.remove('on'); DE.apply(DS.st, { t: 'concede', pid: 0 }); afterAction(); };
}
function renderLog() { const g = document.getElementById('dLog'); g.innerHTML = DS.st.log.slice(-80).map(l => `<div class="${l.kind}">${l.text}</div>`).join(''); g.scrollTop = g.scrollHeight; }
function showCrypt(side) {
  const P = DS.st.players[side], m = document.getElementById('modal'), b = document.getElementById('modalBox');
  b.innerHTML = `<h3>สุสานของ${side ? 'คู่ดวล' : 'เรา'} (${P.crypt.length})</h3><div class="mull" id="cr"></div>${P.purged.length ? `<h4>เขตส่งวิญญาณ (${P.purged.length})</h4><div class="mull" id="pg"></div>` : ''}<div style="display:flex;justify-content:flex-end"><button class="btn" id="crX">ปิด</button></div>`;
  const put = (id, list) => { const box = b.querySelector(id); if (!box) return; if (!list.length) box.innerHTML = '<p style="color:var(--muted)">ว่าง</p>'; list.forEach(c => { const e = handCardEl({ id: c.id }, { w: 96 }); e.onclick = () => zoomCard({ id: c.id, at: 5 }); box.appendChild(e); }); };
  put('#cr', P.crypt.slice().reverse()); put('#pg', P.purged.slice().reverse());
  m.classList.add('on'); b.querySelector('#crX').onclick = () => m.classList.remove('on');
}
function clickUnit(u) {
  const st = DS.st;
  if (u.owner === 0 && st.cur === 0 && !dBusy && !(dSel && dSel.kind === 'play')) {
    if (!tutAllowAttacker(u)) return;
    const why = DE.canAttack(st, u);
    if (why && tutTry(u, why)) { toast(why); return; }
    if (!why) { dSel = dSel && dSel.unit === u.uid ? null : { kind: 'atk', unit: u.uid }; return renderDuel(); }
    if (dSel) { dSel = null; renderDuel(); }
    toast(why); return;
  }
  zoomCard({ id: u.id, at: 6 });
}
function pickTarget(id) {
  if (!dSel) return;
  if (dSel.kind === 'atk') return doAttack({ uid: id });
  const n = dCurNeed(); if (!n) return;
  if (n.kind === 'units') { dSel.multi = (dSel.multi || []).concat([id]); if (dSel.multi.length < Math.min(n.count, n.options.length)) { toast(`เลือกอีก ${Math.min(n.count, n.options.length) - dSel.multi.length} ตัว`); return; } dSel.picks.push(dSel.multi); dSel.multi = null; }
  else dSel.picks.push(id);
  continuePlay();
}
function continuePlay() {
  const st = DS.st; const n = dCurNeed();
  if (!n || !n.options.length) {
    const a = { t: 'play', pid: 0, card: dSel.card, slot: dSel.slot, picks: dSel.picks }; const r = DE.apply(st, a);
    dSel = null; if (!r.ok) toast(r.err); else tutOnAction(a); return afterAction();
  }
  if (n.kind === 'option' || n.kind === 'crypt' || n.kind === 'discover') return choiceModal(n);
  renderDuel();
}
function choiceModal(n) {
  const m = document.getElementById('modal'), b = document.getElementById('modalBox');
  b.innerHTML = `<h3>${n.label}</h3><div class="pickrow" id="pk"></div><div style="display:flex;justify-content:flex-end"><button class="btn ghost" id="pkX">ยกเลิก</button></div>`;
  const box = b.querySelector('#pk');
  if (n.kind === 'option') n.options.forEach(i => { const bt = document.createElement('button'); bt.className = 'opt'; bt.textContent = n.labels[i]; bt.onclick = () => { m.classList.remove('on'); dSel.picks.push(i); continuePlay(); }; box.appendChild(bt); });
  else n.options.forEach(o => { const id = n.kind === 'crypt' ? o.id : o, val = n.kind === 'crypt' ? o.idx : o; const e = handCardEl({ id }, { w: 120 }); e.onclick = () => { m.classList.remove('on'); dSel.picks.push(val); continuePlay(); }; box.appendChild(e); });
  b.querySelector('#pkX').onclick = () => { m.classList.remove('on'); dSel = null; renderDuel(); };
  m.classList.add('on');
}
function doAttack(target) {
  if (!tutAllowTarget(dSel.unit, target)) return;
  const st = DS.st, a = { t: 'attack', pid: 0, unit: dSel.unit, target }; dSel = null;
  lunge(a.unit, 0, () => { const r = DE.apply(st, a); if (!r.ok) toast(r.err); else tutOnAction(a); afterAction(); });
}
function lunge(uid, side, cb) { const el = document.querySelector(`#dBoard .dunit[data-uid="${uid}"]`); if (!el) return cb(); el.classList.add('lunge'); if (side === 1) el.classList.add('down'); setTimeout(cb, 300); }
function slotIndexMap() { const m = {}; DS.st.players.forEach((P, side) => P.units.forEach((u, i) => { if (u) m[u.uid] = { side, i }; })); return m; }
let dPrevMap = {};
function afterAction() {
  const st = DS.st, fxs = st.fx || [], prev = dPrevMap;
  renderDuel(); dPrevMap = slotIndexMap();
  for (const f of fxs) {
    if (f.k === 'dmg' || f.k === 'heal' || f.k === 'block') {
      const host = f.player != null ? document.getElementById(f.player ? 'dOpp' : 'dMe') : document.querySelector(`#dBoard .dunit[data-uid="${f.uid}"]`) || (prev[f.uid] && document.querySelector(`#dBoard .dslot.u[data-side="${prev[f.uid].side}"][data-i="${prev[f.uid].i}"]`));
      if (!host) continue; const s = document.createElement('span'); s.className = 'float ' + (f.k === 'dmg' ? 'dmg' : f.k === 'heal' ? 'heal' : 'blk');
      s.textContent = f.k === 'dmg' ? '-' + f.n : f.k === 'heal' ? (f.n ? '+' + f.n : '✓') : 'กันได้'; host.appendChild(s); setTimeout(() => s.remove(), 1200);
      if (f.k === 'dmg') { host.classList.remove('hit'); void host.offsetWidth; host.classList.add('hit'); }
    }
    if (f.k === 'die') { const p = prev[f.uid]; if (!p) continue; const s = document.querySelector(`#dBoard .dslot.u[data-side="${p.side}"][data-i="${p.i}"]`); if (!s) continue;
      const d = document.createElement('div'); d.className = 'poof' + (f.purge ? ' purge' : ''); d.textContent = f.purge ? 'ส่งวิญญาณ' : 'ตาย'; s.appendChild(d); setTimeout(() => d.remove(), 950); }
  }
  if (st.over) return duelOver();
  if (st.phase === 'main' && st.cur === 1) { if (!dBusy) { dBusy = true; renderDuel(); banner('เทิร์นคู่ดวล'); setTimeout(aiStep, 900); } }
}
function banner(t) { const b = document.getElementById('dBanner'); b.textContent = t; b.classList.add('on'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), 1100); }
function aiStep() {
  const st = DS.st;
  if (!document.getElementById('duel').classList.contains('on') || st.over) { dBusy = false; return; }
  if (st.cur !== 1) { dBusy = false; renderDuel(); banner('เทิร์นของคุณ'); return; }
  const a = (TUT && !TCH[TUT.ch].full) ? { t: 'end', pid: 1 } : DAI.decide(st, 1, DS.level);
  const go = () => { const r = DE.apply(st, a); if (!r.ok) DE.apply(st, { t: 'end', pid: 1 }); afterAction(); if (st.over) { dBusy = false; return; }
    if (st.cur === 1) setTimeout(aiStep, 700); else { dBusy = false; tutOppTurnDone(); renderDuel(); banner('เทิร์นของคุณ'); } };
  if (a.t === 'attack') lunge(a.unit, 1, go); else go();
}
function duelOver() {
  if (TUT && TCH[TUT.ch].full && DS.st.over.winner === 0 && !TUT.done) { dBusy = false; prompt(''); return tutComplete(); }
  const st = DS.st, o = document.getElementById('dOver'), w = st.over.winner;
  dBusy = false; prompt('');
  const title = w === 0 ? 'ชนะ!' : w === 1 ? 'พ่ายแพ้' : 'เสมอ';
  const why = st.over.reason === 'concede' ? 'ยอมแพ้' : st.over.reason === 'turns' ? `ครบ ${TH(40)} เทิร์น ตัดสินด้วยดวงชะตา` : 'ดวงชะตาของฝ่ายหนึ่งหมดลง';
  const line = w === 0 ? `"ฝีมือไม่เลวเลย ${st.players[0].name} เอ๋ย มาดวลกับข้าอีกเมื่อไรก็ได้"` : w === 1 ? '"ยังอ่อนนัก กลับไปจัดเด็คแล้วมาใหม่"' : '"ฝีมือสูสีนัก"';
  o.innerHTML = `<h2>${title}</h2><p>${why} · ${TH(st.turn)} เทิร์น<br>${line}</p><p style="font-size:13px;color:var(--muted)">คู่ดวลใช้เด็ค ${DS.aiDeck} · ระดับ${AI_LV[DS.level]}</p>
    <div class="row"><button class="btn" id="oAgain">ดวลอีกครั้ง</button><button class="btn ghost" id="oSet">เปลี่ยนเด็ค/ระดับ</button><button class="btn ghost" id="oHome">กลับหน้าแรก</button></div>`;
  o.classList.add('on');
  o.querySelector('#oAgain').onclick = () => { o.classList.remove('on'); startDuel(duelDecks().find(d => d.key === DSET.deck).ids); };
  o.querySelector('#oSet').onclick = () => { o.classList.remove('on'); TUT = null; openDuelSetup(); };
  o.querySelector('#oHome').onclick = () => { o.classList.remove('on'); TUT = null; show('home'); };
}
addEventListener('resize', () => { if (DS && document.getElementById('duel').classList.contains('on')) renderDuel(); });
