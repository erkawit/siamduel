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
  '__CARDS__': rd('src/cards_min.json'),
}
for k, v in parts.items():
    assert html.count(k) == 1, k
    html = html.replace(k, v)
open(os.path.join(R, 'index.html'), 'w', encoding='utf-8').write(html)
print('index.html', len(html.encode()) // 1024, 'KB')
