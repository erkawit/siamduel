"""ประกอบ index.html จาก src/: python tools/build_index.py"""
import json, os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
data = json.loads(rd('data/siam_duel_cards.json'))
KEEP = ['id','name_th','tribe','category','rarity','element','type','cost','atk','hp','keywords','ability_code','is_ruler','is_deity']
duel = {'cards': [{k: c.get(k) for k in KEEP} for c in data['cards']], 'tokens': data['tokens']}
html = rd('src/template.html')
parts = {
  '__DUELCSS__': rd('src/duel.css'),
  '__ENGINE__': rd('duel/engine.js'),
  '__AI__': rd('duel/ai.js'),
  '__DUELUI__': rd('src/duel_ui.js').replace('__DUELDATA__', json.dumps(duel, ensure_ascii=False, separators=(',', ':'))),
  '__TUTORIAL__': rd('src/tutorial.js'),
  '__QR__': rd('src/qr.js'),
  '__P2P__': rd('src/p2p.js'),
  '__CARDS__': rd('src/cards_min.json'),
}
for k, v in parts.items():
    assert html.count(k) == 1, k
    html = html.replace(k, v)
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(html)
print('index.html', len(html.encode()) // 1024, 'KB')

# ---------- คู่มือ wiki.html ----------
tpl = rd('src/template.html')
def between(a, b):
    i = tpl.index(a); j = tpl.index(b, i); return tpl[i:j]
ai = rd('duel/ai.js'); k = ai.index('const DECKS = {'); k2 = ai.index('};', k) + 1
decks_js = ai[k + len('const DECKS = '):k2]
wiki = rd('src/wiki.html')
wparts = {
  '__CARDCSS__': between('/* ---------- การ์ด ---------- */', '/* ---------- หน้าล็อกอิน ---------- */'),
  '__CARDJS__': between('/* ตำแหน่งช่องต่าง ๆ', '/* ---------- การ์ดสมมติ'),
  '__CARDS__': rd('src/cards_min.json'),
  '__FULLDATA__': json.dumps({'cards': [{k: c.get(k) for k in ['id','tribe','category','flavor_th']} for c in data['cards']], 'tokens': data['tokens']}, ensure_ascii=False, separators=(',', ':')),
  '__DECKS__': decks_js,
  '__RECTS__': rd('wiki/rects.json'),
}
for k, v in wparts.items():
    assert wiki.count(k) == 1, k
    wiki = wiki.replace(k, v)
open(os.path.join(R, 'wiki.html'), 'w', encoding='utf-8').write(wiki)
print('wiki.html', len(wiki.encode()) // 1024, 'KB')
