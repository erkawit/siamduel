/* ---------- ดวลกับเพื่อน (P2P) ----------
   สร้างห้อง → ได้รหัสห้อง ลิงก์ และ QR · ตั้งรหัสผ่านได้ · เพื่อนเข้าด้วยลิงก์/QR/รหัสห้อง
   การเชื่อมต่อ: WebRTC DataChannel ตรงระหว่างเครื่อง (P2P) ใช้ Supabase Realtime เป็นช่องแลกสัญญาณเท่านั้น
   ถ้าเครือข่ายต่อตรงไม่ได้ (NAT/ไฟร์วอลล์) จะส่งต่อผ่าน Realtime แบบเข้ารหัส AES-GCM ด้วยกุญแจจากรหัสห้อง+รหัสผ่าน
   การเล่น: เอนจินเดียวกันทั้งสองเครื่อง (seed เดียวกัน) เจ้าของห้องเป็นผู้เรียงลำดับการกระทำ แล้วส่งให้อีกฝ่ายเล่นตาม
   ตรวจสถานะตรงกันด้วยค่า hash ทุกการกระทำ · ดวลกับเพื่อนไม่มีรางวัลและไม่เสียโกลด์/การ์ด */
var P2P = (() => {
  const VER = 'p2p1:' + DUEL_DATA.cards.length;            // เวอร์ชันโปรโตคอล + จำนวนการ์ด (เครื่องที่ใช้ไฟล์เกมต่างรุ่นจะเข้าห้องไม่ได้)
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // ตัวอักษรล้วน (เกมแปลงตัวเลขเป็นเลขไทยทั้งหน้า จึงไม่ใช้ตัวเลขในรหัสห้อง)
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }, { urls: 'stun:global.stun.twilio.com:3478' }];
  const P2P_TIMEOUT = 9000, SAVE_KEY = 'siam-p2p-host';
  const myId = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) ;
  let R = null;     // ห้องปัจจุบัน
  let urlHandled = false;

  /* ---------- ตัวช่วย ---------- */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = u8 => btoa(String.fromCharCode(...u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function sha(s) { const h = await crypto.subtle.digest('SHA-256', enc.encode(s)); return b64(new Uint8Array(h)); }
  async function deriveKey(code, pw) {
    const base = await crypto.subtle.importKey('raw', enc.encode(code + '|' + (pw || '')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('siamduel-room'), iterations: 60000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => ALPHA[b % ALPHA.length]).join('');
  const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6);
  const link = code => location.origin + location.pathname + '?room=' + code;
  function hashState(st) { const s = JSON.stringify(st); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; }
  const modal = () => ({ m: document.getElementById('modal'), b: document.getElementById('modalBox') });
  const closeModal = () => modal().m.classList.remove('on');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- ช่องสัญญาณ (Supabase Realtime) ---------- */
  function openChannel(code, onMsg, onPresence) {
    return new Promise((res, rej) => {
      const ch = sb.channel('duel-room-' + code, { config: { broadcast: { self: false }, presence: { key: myId } } });
      ch.on('broadcast', { event: 'm' }, ({ payload }) => { if (payload && (!payload.to || payload.to === myId)) onMsg(payload); });
      ch.on('presence', { event: 'leave' }, ({ key }) => onPresence && onPresence('leave', key));
      ch.on('presence', { event: 'join' }, ({ key }) => onPresence && onPresence('join', key));
      let done = false;
      ch.subscribe(st => { if (st === 'SUBSCRIBED' && !done) { done = true; ch.track({ at: Date.now() }); res(ch); }
        else if ((st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') && !done) { done = true; rej(new Error('เชื่อมต่อเซิร์ฟเวอร์สัญญาณไม่ได้')); } });
    });
  }
  const sig = (payload) => R && R.ch && R.ch.send({ type: 'broadcast', event: 'm', payload: Object.assign({ from: myId }, payload) });

  /* ---------- ส่ง/รับข้อความเกม (DataChannel หรือ relay เข้ารหัส) ---------- */
  async function send(msg) {
    if (!R || !R.link) return;
    const s = JSON.stringify(msg);
    if (R.link === 'p2p' && R.dc && R.dc.readyState === 'open') return R.dc.send(s);
    if (R.link === 'relay') { const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, R.key, enc.encode(s));
      sig({ k: 'r', to: R.peer, iv: b64(iv), ct: b64(new Uint8Array(ct)) }); }
  }
  async function fromRelay(p) {
    try { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, R.key, unb64(p.ct)); if (!R.link) linkUp('relay'); onGame(JSON.parse(dec.decode(pt))); }
    catch (e) { console.warn('relay decrypt', e); }
  }

  /* ---------- WebRTC ---------- */
  function setupPC(initiator) {
    const pc = new RTCPeerConnection({ iceServers: ICE }); R.pc = pc;
    pc.onicecandidate = e => { if (e.candidate) sig({ k: 'ice', to: R.peer, c: e.candidate.toJSON() }); };
    const wire = dc => { R.dc = dc; dc.onopen = () => linkUp('p2p'); dc.onmessage = e => { try { onGame(JSON.parse(e.data)); } catch (x) { console.warn(x); } };
      dc.onclose = () => { if (R && R.link === 'p2p') linkDown(); }; };
    if (initiator) wire(pc.createDataChannel('duel', { ordered: true })); else pc.ondatachannel = e => wire(e.channel);
    pc.onconnectionstatechange = () => { if (['failed', 'disconnected'].includes(pc.connectionState) && R && R.link === 'p2p') linkDown(); };
    clearTimeout(R.fallback); R.fallback = setTimeout(() => { if (R && !R.link) { sig({ k: 'relay', to: R.peer }); linkUp('relay'); } }, P2P_TIMEOUT);
    return pc;
  }
  function closePC() { if (!R) return; clearTimeout(R.fallback); try { R.dc && R.dc.close(); } catch (e) {} try { R.pc && R.pc.close(); } catch (e) {} R.pc = R.dc = null; R.pendingIce = []; }
  async function addIce(c) { if (!R.pc || !R.pc.remoteDescription) { R.pendingIce.push(c); return; } try { await R.pc.addIceCandidate(c); } catch (e) {} }  /* ข้อความ Realtime อาจมาไม่เรียงลำดับ */
  async function flushIce() { for (const c of R.pendingIce.splice(0)) try { await R.pc.addIceCandidate(c); } catch (e) {} }

  function linkUp(kind) {
    if (!R || R.link) return; R.link = kind; clearTimeout(R.fallback);
    status(kind === 'p2p' ? 'เชื่อมต่อตรงระหว่างเครื่องแล้ว (P2P)' : 'เชื่อมต่อแล้ว (ส่งต่อผ่านเซิร์ฟเวอร์แบบเข้ารหัส)');
    if (DS && DS.mode === 'p2p') { DS.oppOnline = true; DS.linkKind = kind; if (document.getElementById('duel').classList.contains('on')) renderDuel(); }
    if (R.host) hostLinked(); else if (!R.start) { clearTimeout(R.startT); R.startT = setTimeout(() => R && !R.start && send({ k: 'needsync' }), 2500); watchStart(); }
  }
  function linkDown() {
    if (!R) return; R.link = null; closePC();
    if (DS && DS.mode === 'p2p' && !DS.left) { DS.oppOnline = false; toast('การเชื่อมต่อกับคู่ดวลหลุด กำลังรอให้กลับมา…', 4000); if (document.getElementById('duel').classList.contains('on')) renderDuel(); }
    if (!R.host && R.joined && !R.leaving) setTimeout(() => R && !R.link && !R.leaving && guestHello(), 1500);
  }

  /* ---------- ข้อความสัญญาณ ---------- */
  async function onSig(p) {
    if (!R) return;
    if (p.k === 'r') { if (p.from === R.peer) fromRelay(p); return; }
    if (R.host) {
      if (p.k === 'hello') return sig({ k: 'info', to: p.from, v: VER, needPw: !!R.pwHash, host: R.name });
      if (p.k === 'join') {
        const reject = reason => sig({ k: 'reject', to: p.from, reason });
        if (p.v !== VER) return reject('เวอร์ชันเกมไม่ตรงกัน ให้ทั้งสองฝ่ายรีเฟรชหน้าเกม');
        if (R.pwHash && p.proof !== R.pwHash) return reject('รหัสผ่านห้องไม่ถูกต้อง');
        if (R.start && R.guest && R.guest.uid !== p.uid) return reject('ห้องนี้มีผู้เล่นครบสองคนแล้ว');
        const errs = DE.deckErrors(p.deck || []); if (errs.length) return reject('เด็คของผู้เข้าร่วมไม่ผ่านกติกา: ' + errs[0]);
        closePC();
        R.peer = p.from; R.link = null; R.guest = { uid: p.uid, name: String(p.name || 'ผู้ท้าดวล').slice(0, 24), gender: p.gender === 'female' ? 'female' : 'male', deck: p.deck };
        sig({ k: 'accept', to: p.from, host: R.name });
        status(`${esc(R.guest.name)} ขอเข้าห้อง กำลังเชื่อมต่อ…`);
        const pc = setupPC(true); const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        return sig({ k: 'offer', to: R.peer, sdp: pc.localDescription.toJSON() });
      }
      if (p.from !== R.peer) return;
      if (p.k === 'answer' && R.pc) { await R.pc.setRemoteDescription(p.sdp); return flushIce(); }
      if (p.k === 'ice') return addIce(p.c);
      if (p.k === 'relay') return linkUp('relay');
      if (p.k === 'bye') return guestLeft();
    } else {
      if (p.k === 'info') { clearInterval(R.helloT); if (R.gotInfo) return; R.gotInfo = true;
        if (p.v !== VER) return fail('เวอร์ชันเกมไม่ตรงกับเจ้าของห้อง ให้ทั้งสองฝ่ายรีเฟรชหน้าเกม');
        R.hostName = p.host; R.peer = p.from;
        if (p.needPw && R.pw == null) return askPassword(); return guestJoin(); }
      if (p.from !== R.peer) return;
      if (p.k === 'reject') { if (/รหัสผ่าน/.test(p.reason)) { R.pw = null; R.gotInfo = false; status(p.reason); return askPassword(p.reason); } return fail(p.reason); }
      if (p.k === 'accept') { R.joined = true; status('เจ้าของห้องรับแล้ว กำลังเชื่อมต่อ…'); return; }
      if (p.k === 'offer') { const keep = R.pendingIce.slice(); closePC(); R.pendingIce = keep; R.link = null; R.joined = true; const pc = setupPC(false); await pc.setRemoteDescription(p.sdp); await flushIce();
        const ans = await pc.createAnswer(); await pc.setLocalDescription(ans); return sig({ k: 'answer', to: R.peer, sdp: pc.localDescription.toJSON() }); }
      if (p.k === 'ice') return addIce(p.c);
      if (p.k === 'relay') return linkUp('relay');
      if (p.k === 'bye') return hostLeft();
    }
  }
  function onPresence(ev, key) { if (!R || key !== R.peer) return; if (ev === 'leave' && R.dc && R.dc.readyState === 'open') return; /* ช่องสัญญาณกระตุก แต่ต่อตรงยังอยู่ */ if (ev === 'leave') { if (R.host) guestLeft(true); else linkDown(); } }

  /* ---------- ข้อความเกม ---------- */
  function onGame(m) {
    if (!R) return;
    if (R.host) {
      if (m.k === 'req') return hostApply(m.a, true);
      if (m.k === 'needsync') return R.start ? send({ k: 'sync', start: R.start, actions: R.actions }) : (R.guest && hostLinked());
      if (m.k === 'rematch') { R.rematch = (R.rematch || 0) | 2; return rematchCheck(); }
      if (m.k === 'leave') return guestLeft();
    } else {
      if (m.k === 'start' || m.k === 'sync') return guestStart(m.start, m.actions || []);
      if (m.k === 'act') return guestAct(m);
      if (m.k === 'err') { DS && (DS.waiting = false); toast(m.msg, 3500); return renderDuel(); }
      if (m.k === 'rematch') { toast('คู่ดวลขอดวลอีกครั้ง กด "ดวลอีกครั้ง" เพื่อเริ่ม', 4000); return; }
      if (m.k === 'leave') return hostLeft();
    }
  }

  /* ---------- เจ้าของห้อง ---------- */
  async function createRoom(deckIds, pw) {
    if (!sb) return toast('ดวลกับเพื่อนต้องเชื่อมเซิร์ฟเวอร์ (ปิดโหมดออฟไลน์ก่อน)');
    await leave(true);
    const code = newCode(), u = me();
    R = { host: true, code, pw: pw || '', pwHash: pw ? await sha(code + '|' + pw) : null, key: await deriveKey(code, pw), name: u.name || u.username || 'เจ้าของห้อง',
      uid: u.id, gender: u.gender || 'male', deck: deckIds, actions: [], pendingIce: [], link: null };
    roomModal();
    try { R.ch = await openChannel(code, onSig, onPresence); status('รอเพื่อนเข้าห้อง…'); }
    catch (e) { status(e.message); }
    save();
  }
  function hostLinked() {
    if (!R.start) { // เริ่มเกมใหม่
      R.start = { seed: crypto.getRandomValues(new Uint32Array(1))[0], names: [R.name, R.guest.name], decks: [R.deck, R.guest.deck], genders: [R.gender, R.guest.gender] };
      R.actions = []; save();
      send({ k: 'start', start: R.start, actions: [] }); closeModal(); beginGame(0, R.start, []);
    } else { send({ k: 'sync', start: R.start, actions: R.actions }); if (DS) { DS.oppOnline = true; renderDuel(); } toast('คู่ดวลกลับเข้าห้องแล้ว'); }
  }
  function hostApply(a, fromGuest) {
    if (!DS || DS.mode !== 'p2p' || !a) return { ok: false, err: 'ยังไม่เริ่มเกม' };
    if (fromGuest && a.pid !== 1) return { ok: false };
    const anim = fromGuest && a.t === 'attack';
    const run = () => {
      const r = DE.apply(DS.st, a);
      if (!r.ok) { if (fromGuest) send({ k: 'err', msg: r.err || 'ทำแบบนี้ไม่ได้' }); return r; }
      R.actions.push(a); save();
      send({ k: 'act', seq: R.actions.length, a, h: hashState(DS.st) });
      if (fromGuest) afterAction();
      return r;
    };
    if (anim) { lunge(a.unit, 1, run); return { ok: true, pending: true }; }
    return run();
  }
  function guestLeft(soft) {
    if (!R) return; R.link = null; closePC();
    if (DS && DS.mode === 'p2p' && !DS.st.over) { DS.oppOnline = false; toast(soft ? 'คู่ดวลหลุดการเชื่อมต่อ รอให้กลับมาด้วยลิงก์เดิม…' : 'คู่ดวลออกจากห้องแล้ว', 4500); renderDuel(); }
    else if (!DS || DS.mode !== 'p2p') { R.peer = null; R.guest = null; status('รอเพื่อนเข้าห้อง…'); }
  }
  function save() { try { if (R && R.host) sessionStorage.setItem(SAVE_KEY, JSON.stringify({ code: R.code, pw: R.pw, deck: R.deck, start: R.start, actions: R.actions, guest: R.guest })); } catch (e) {} }

  /* ---------- ผู้เข้าร่วม ---------- */
  async function joinRoom(code, deckIds) {
    if (!sb) return toast('ดวลกับเพื่อนต้องเชื่อมเซิร์ฟเวอร์ (ปิดโหมดออฟไลน์ก่อน)');
    code = cleanCode(code); if (code.length !== 6) return toast('รหัสห้องต้องมี ๖ ตัว');
    await leave(true);
    const u = me();
    R = { host: false, code, deck: deckIds, pw: null, uid: u.id, name: u.name || u.username || 'ผู้ท้าดวล', gender: u.gender || 'male', pendingIce: [], link: null };
    joinModal();
    try { R.ch = await openChannel(code, onSig, onPresence); } catch (e) { return fail(e.message); }
    guestHello();
  }
  function guestHello() {
    if (!R) return; R.gotInfo = false; clearInterval(R.helloT); let n = 0; status('กำลังค้นหาห้อง ' + R.code + '…');
    const go = () => { if (!R || R.gotInfo) return clearInterval(R && R.helloT); if (++n > 8 && !R.start) { clearInterval(R.helloT); return fail('ไม่พบห้องนี้ หรือเจ้าของห้องปิดเกมไปแล้ว'); } sig({ k: 'hello', uid: R.uid }); };
    go(); R.helloT = setInterval(go, 1500);
  }
  function watchStart() {
    clearTimeout(R.startT); R.tries = (R.tries || 0) + 1;
    R.startT = setTimeout(() => {
      if (!R || R.host || R.start || R.leaving) return;
      if (R.link) { send({ k: 'needsync' }); if (R.tries < 6) return watchStart(); }
      if (R.tries >= 6) return fail('เชื่อมต่อกับเจ้าของห้องไม่สำเร็จ ให้เจ้าของห้องเปิดหน้าเกมค้างไว้ (อย่าสลับไปแอปอื่น) แล้วลองเข้าห้องใหม่');
      status('ยังเชื่อมต่อไม่ได้ กำลังลองใหม่ครั้งที่ ' + TH(R.tries) + '…'); closePC(); R.link = null; guestHello();
    }, R.link ? 3000 : 14000);
  }
  async function guestJoin() {
    status('กำลังขอเข้าห้อง…'); watchStart(); R.key = await deriveKey(R.code, R.pw || '');
    sig({ k: 'join', to: R.peer, v: VER, uid: R.uid, name: R.name, gender: R.gender, deck: R.deck, proof: R.pw ? await sha(R.code + '|' + R.pw) : null });
  }
  async function guestStart(start, actions) {
    R.start = start; clearTimeout(R.startT);
    closeModal(); beginGame(1, start, actions);
  }
  function guestAct(m) {
    if (!DS || DS.mode !== 'p2p') return;
    const n = DS.actions.length + 1;
    if (m.seq < n) return;                                 // ซ้ำ
    if (m.seq > n) return send({ k: 'needsync' });          // ตกหล่น ขอสถานะใหม่ทั้งหมด
    const apply = () => {
      const r = DE.apply(DS.st, m.a); DS.actions.push(m.a); DS.waiting = false;
      if (!r.ok || (m.h && hashState(DS.st) !== m.h)) { console.warn('desync', r); return send({ k: 'needsync' }); }
      afterAction();
    };
    if (m.a.t === 'attack' && m.a.pid === OP) lunge(m.a.unit, 1, apply); else apply();
  }
  function hostLeft() { if (!R) return; R.link = null; closePC();
    if (DS && DS.mode === 'p2p' && !DS.st.over) { DS.oppOnline = false; toast('เจ้าของห้องออกจากห้อง การดวลสิ้นสุด', 5000); renderDuel(); }
    else fail('เจ้าของห้องปิดห้องแล้ว'); }

  /* ---------- เริ่มเกม/เล่น ---------- */
  function beginGame(side, start, actions) {
    TUT = null; setSide(side);
    const st = DE.newGame({ seed: start.seed, names: start.names, decks: start.decks });
    for (const a of actions) DE.apply(st, a);
    DS = { mode: 'p2p', st, level: 'normal', aiDeck: '', mull: new Set(), actions: actions.slice(), oppGender: start.genders[1 - side], oppOnline: true, linkKind: R.link, waiting: false, lastCur: null };
    if (R.host) R.actions = DS.actions;
    dSel = null; dBusy = false; dPrevMap = {};
    show('duel'); document.getElementById('dOver').classList.remove('on');
    renderDuel(); banner(side === 0 ? 'เพื่อนเข้าห้องแล้ว เริ่มดวล!' : 'เข้าห้องแล้ว เริ่มดวล!');
    if (st.over) return duelOver();
    if (st.phase === 'mulligan' && !st.players[ME].mulled) showMulligan(); else p2pAfter();
  }
  function act(a) {
    if (!R || !DS) return { ok: false, err: 'ไม่ได้อยู่ในห้องดวล' };
    if (R.host) return hostApply(a, false);
    if (!R.link) { toast('ยังไม่ได้เชื่อมต่อกับเจ้าของห้อง'); return { ok: false, pending: true }; }
    if (DS.waiting) return { ok: false, pending: true };
    DS.waiting = true; send({ k: 'req', a }); return { ok: true, pending: true };
  }
  function after() {
    const st = DS.st;
    if (st.phase === 'mulligan') { if (st.players[ME].mulled && !st.players[OP].mulled) prompt('รอคู่ดวลเปลี่ยนไพ่เริ่มเกม…'); return; }
    if (st.phase === 'main' && st.cur !== DS.lastCur) { DS.lastCur = st.cur; banner(st.cur === ME ? 'เทิร์นของคุณ' : 'เทิร์นคู่ดวล'); }
  }
  function over() {
    const st = DS.st, o = document.getElementById('dOver'), w = st.over.winner;
    dBusy = false; prompt('');
    const title = w === ME ? 'ชนะ!' : w === OP ? 'พ่ายแพ้' : 'เสมอ';
    const why = st.over.reason === 'concede' ? (w === ME ? 'คู่ดวลยอมแพ้' : 'ยอมแพ้') : st.over.reason === 'turns' ? `ครบ ${TH(40)} เทิร์น ตัดสินด้วยดวงชะตา` : 'ดวงชะตาของฝ่ายหนึ่งหมดลง';
    o.innerHTML = `<h2>${title}</h2><p>${why} · ${TH(st.turn)} เทิร์น</p><p style="font-size:13px;color:var(--muted)">ดวลกับเพื่อน · ห้อง ${R ? R.code : ''} · ไม่มีรางวัลและไม่เสียโกลด์/การ์ด</p>
      <div class="row"><button class="btn" id="oAgain">ดวลอีกครั้ง</button><button class="btn ghost" id="oHome">ออกจากห้อง</button></div>`;
    o.classList.add('on');
    o.querySelector('#oAgain').onclick = () => {
      if (!R || !R.link) return toast('คู่ดวลไม่ได้อยู่ในห้องแล้ว');
      if (R.host) { R.rematch = (R.rematch || 0) | 1; send({ k: 'rematch' }); rematchCheck(); }
      else send({ k: 'rematch' });
      o.querySelector('#oAgain').disabled = true; o.querySelector('#oAgain').textContent = 'รอคู่ดวล…';
    };
    o.querySelector('#oHome').onclick = () => { o.classList.remove('on'); leave(); show('home'); };
  }
  function rematchCheck() { if ((R.rematch & 3) !== 3) { if (R.rematch & 2) toast('คู่ดวลขอดวลอีกครั้ง กด "ดวลอีกครั้ง" เพื่อเริ่ม', 4000); return; }
    R.rematch = 0; R.start = null; hostLinked(); }

  async function leave(quiet) {
    if (!R) return; const r = R; r.leaving = true;
    try { if (r.link) await send({ k: 'leave' }); sig({ k: 'bye', to: r.peer }); } catch (e) {}
    clearInterval(r.helloT); clearTimeout(r.startT); closePC();
    try { r.ch && sb.removeChannel(r.ch); } catch (e) {}
    if (r.host) try { sessionStorage.removeItem(SAVE_KEY); } catch (e) {}
    if (DS && DS.mode === 'p2p') DS.left = true;
    R = null; if (!quiet) toast('ออกจากห้องดวลแล้ว');
  }
  function fail(msg) { status(msg, true); const b = modal().b, x = b.querySelector('#rmBack'); if (x) x.textContent = 'ปิด';
    if (R && !R.host) { const r = R; R = null; clearInterval(r.helloT); try { r.ch && sb.removeChannel(r.ch); } catch (e) {} } }

  /* ---------- หน้าจอ ---------- */
  function status(t, bad) { const e = document.getElementById('rmStatus'); if (e) { e.innerHTML = t; e.classList.toggle('bad', !!bad); } }
  function okDecks() { return duelDecks().filter(d => d.ok); }
  function lobby(prefill) {
    if (!sb) return toast('ดวลกับเพื่อนต้องเชื่อมเซิร์ฟเวอร์ (ปิดโหมดออฟไลน์ก่อน)');
    const { m, b } = modal(); m.classList.remove('ev');
    const decks = okDecks(); if (!decks.some(d => d.key === DSET.deck)) DSET.deck = (decks.find(d => d.key.startsWith('my:')) || decks[0]).key;
    const draw = () => {
      b.innerHTML = `<div class="dsetup p2p"><h3>ดวลกับเพื่อน</h3>
        <p class="note">เล่นสด ๒ คนผ่านลิงก์หรือ QR · เชื่อมต่อตรงระหว่างเครื่อง · <b>ไม่มีรางวัล ไม่เสียโกลด์หรือการ์ด</b></p>
        <h4>เลือกเด็คที่จะใช้</h4><div class="opts">${decks.map(d => `<button class="opt ${d.key === DSET.deck ? 'on' : ''}" data-deck="${d.key}">${d.name}<small>${d.sub}</small></button>`).join('')}</div>
        <div class="p2pgrid">
          <div class="p2pbox"><h4>สร้างห้อง</h4><label for="rmPw">รหัสผ่านห้อง (ไม่บังคับ)</label>
            <input id="rmPw" type="password" maxlength="32" autocomplete="new-password" placeholder="เว้นว่าง = ใครมีลิงก์ก็เข้าได้">
            <button class="btn" id="rmCreate">สร้างห้อง</button></div>
          <div class="p2pbox"><h4>เข้าห้องของเพื่อน</h4><label for="rmCode">รหัสห้อง (ตัวอักษรอังกฤษ ๖ ตัว)</label>
            <input id="rmCode" maxlength="7" autocapitalize="characters" spellcheck="false" placeholder="เช่น KHQRMX" value="${esc(prefill || '')}">
            <button class="btn" id="rmJoin">เข้าห้อง</button></div>
        </div>
        <p class="note">สแกน QR หรือเปิดลิงก์ที่เพื่อนส่งมา เกมจะพามาที่หน้านี้พร้อมรหัสห้องให้เอง</p>
        <div style="display:flex;justify-content:space-between;gap:10px;margin-top:12px"><button class="btn ghost" id="rmAI">ดวลกับ AI แทน</button><button class="btn ghost" id="rmX">ปิด</button></div></div>`;
      b.querySelectorAll('[data-deck]').forEach(x => x.onclick = () => { DSET.deck = x.dataset.deck; const pw = b.querySelector('#rmPw').value, c = b.querySelector('#rmCode').value; draw(); b.querySelector('#rmPw').value = pw; b.querySelector('#rmCode').value = c; });
      const ids = () => decks.find(d => d.key === DSET.deck).ids;
      b.querySelector('#rmCreate').onclick = () => createRoom(ids(), b.querySelector('#rmPw').value.trim());
      b.querySelector('#rmJoin').onclick = () => joinRoom(b.querySelector('#rmCode').value, ids());
      b.querySelector('#rmCode').onkeydown = e => { if (e.key === 'Enter') b.querySelector('#rmJoin').click(); };
      b.querySelector('#rmX').onclick = closeModal;
      b.querySelector('#rmAI').onclick = () => openDuelSetup();
      if (prefill) b.querySelector('#rmJoin').focus();
    };
    draw(); m.classList.add('on');
  }
  function roomModal() {
    const { m, b } = modal(), url = link(R.code);
    let qr = ''; try { qr = QRLite.svg(url); } catch (e) { qr = '<p>สร้าง QR ไม่ได้</p>'; }
    b.innerHTML = `<div class="dsetup p2p"><h3>ห้องดวลของคุณ</h3>
      <div class="room"><div class="qr" aria-label="QR สำหรับเข้าห้อง">${qr}</div>
        <div class="rinfo"><div class="lbl">รหัสห้อง</div><div class="code">${R.code.split('').join(' ')}</div>
          <div class="lbl">ลิงก์เข้าห้อง</div><div class="lnk"><input id="rmUrl" readonly value="${esc(url)}"><button class="btn ghost" id="rmCopy">คัดลอก</button></div>
          ${navigator.share ? '<button class="btn ghost" id="rmShare">แชร์ลิงก์…</button>' : ''}
          <div class="lbl">รหัสผ่าน</div><div>${R.pw ? '🔒 ตั้งรหัสผ่านแล้ว · บอกเพื่อนแยกจากลิงก์ (ลิงก์และ QR ไม่มีรหัสผ่าน)' : 'ไม่มีรหัสผ่าน · ใครมีลิงก์ก็เข้าได้'}</div></div></div>
      <div class="rstatus" id="rmStatus">กำลังเปิดห้อง…</div>
      <p class="note">เปิดหน้านี้ค้างไว้จนกว่าเพื่อนจะเข้ามา · ห้องอยู่ได้ตราบที่หน้าเกมของคุณยังเปิดอยู่</p>
      <div style="display:flex;justify-content:flex-end;gap:10px"><button class="btn ghost" id="rmBack">ปิดห้อง</button></div></div>`;
    b.querySelector('#rmCopy').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch (e) { const i = b.querySelector('#rmUrl'); i.select(); document.execCommand('copy'); toast('คัดลอกลิงก์แล้ว'); } };
    const sh = b.querySelector('#rmShare'); if (sh) sh.onclick = () => navigator.share({ title: 'ดวลกับฉันที่สยามมินทร์ดูเอล', text: `มาดวลกัน! ห้อง ${R.code}${R.pw ? ' (ถามรหัสผ่านจากฉัน)' : ''}`, url }).catch(() => {});
    b.querySelector('#rmBack').onclick = () => { leave(); closeModal(); };
    m.classList.add('on');
  }
  function joinModal() {
    const { m, b } = modal();
    b.innerHTML = `<div class="dsetup p2p"><h3>เข้าห้องดวล ${R.code}</h3><div class="rstatus" id="rmStatus">กำลังเชื่อมต่อ…</div><div id="rmPwBox"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:12px"><button class="btn ghost" id="rmBack">ยกเลิก</button></div></div>`;
    b.querySelector('#rmBack').onclick = () => { if (R) leave(true); closeModal(); };
    m.classList.add('on');
  }
  function askPassword(err) {
    const box = document.getElementById('rmPwBox'); if (!box) return;
    status(err ? err : `ห้องของ ${esc(R.hostName || 'เพื่อน')} ตั้งรหัสผ่านไว้`, !!err);
    box.innerHTML = `<label for="rmPw2">รหัสผ่านห้อง</label><input id="rmPw2" type="password" maxlength="32" autocomplete="off"><button class="btn" id="rmPwGo">เข้าห้อง</button>`;
    const i = box.querySelector('#rmPw2'); i.focus();
    const go = () => { if (!R) return; R.pw = i.value; box.innerHTML = ''; R.gotInfo = true; guestJoin(); };
    box.querySelector('#rmPwGo').onclick = go; i.onkeydown = e => { if (e.key === 'Enter') go(); };
  }

  /* ---------- เปิดจากลิงก์ ?room=CODE / กลับเข้าห้องที่ค้าง ---------- */
  function checkUrl() {
    if (urlHandled || !me()) return; urlHandled = true;
    const q = new URLSearchParams(location.search), code = cleanCode(q.get('room'));
    if (code) { q.delete('room'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); setTimeout(() => lobby(code), 300); return; }
    let s = null; try { s = JSON.parse(sessionStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
    if (s && s.start && sb) setTimeout(() => resumeHost(s), 300);
  }
  async function resumeHost(s) {
    const u = me(); if (!u) return;
    R = { host: true, code: s.code, pw: s.pw || '', pwHash: s.pw ? await sha(s.code + '|' + s.pw) : null, key: await deriveKey(s.code, s.pw), name: u.name || u.username,
      uid: u.id, gender: u.gender || 'male', deck: s.deck, actions: s.actions || [], start: s.start, guest: s.guest, pendingIce: [], link: null };
    try { R.ch = await openChannel(s.code, onSig, onPresence); } catch (e) { return; }
    beginGame(0, s.start, R.actions); DS.oppOnline = false; renderDuel();
    toast(`กลับเข้าห้องดวล ${s.code} แล้ว รอคู่ดวลเชื่อมต่อใหม่…`, 4500);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && R && !R.host && !R.link && !R.leaving && R.peer) guestHello();
  });
  return { lobby, act, after, over, leave, checkUrl, get room() { return R; } };
})();
function p2pAfter() { P2P.after(); }
function p2pOver() { P2P.over(); }
