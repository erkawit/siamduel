import json, os, sys
from PIL import Image, ImageOps
U, OUT = sys.argv[1], sys.argv[2]
d = json.load(open('siam_duel_cards.json', encoding='utf-8'))
win = json.load(open(f'{U}/transparent/art_windows.json', encoding='utf-8'))
TIERS = [("common","ธรรมดา","01_Ivory_Minimal.png"),("standard","ทั่วไป","09_Jade_Green_Consistent_Layout.png"),
 ("rare","หายาก","10_Sky_Blue_Consistent_Layout.png"),("epic","มหากาพย์","11_Royal_Purple_Consistent_Layout.png"),
 ("legend","ตำนาน","12_Blood_Red_Consistent_Layout.png"),("divine","พระเจ้า","13_Royal_Gold_Consistent_Layout.png"),
 ("creator","ผู้สรรสร้าง","14_Rainbow_Diamond_Consistent_Layout.png")]
for p in ['art','art/thumb','frames','frames/thumb','ui','ui/thumb']: os.makedirs(f'{OUT}/{p}', exist_ok=True)
def save(im, path, size, q=82):
    im = im.copy(); im.thumbnail(size, Image.LANCZOS); im.save(path, 'WEBP', quality=q, method=6)
man = {"card_size":[1024,1536], "tiers":{}, "cards":{}, "ui":{}}
for code, th, f in TIERS:
    im = Image.open(f'{U}/transparent/{f}').convert('RGBA')
    save(im, f'{OUT}/frames/{code}.webp', (768,1152), 88); save(im, f'{OUT}/frames/thumb/{code}.webp', (256,384), 88)
    r = win[f]; W, H = im.size
    man["tiers"][code] = {"name_th": th, "frame": f"frames/{code}.webp", "frame_thumb": f"frames/thumb/{code}.webp",
        "art_window_pct": {k: round(v, 3) for k, v in dict(left=100*r["x"]/W, top=100*r["y"]/H, width=100*r["w"]/W, height=100*r["h"]/H).items()}}
code_of = {th: c for c, th, _ in TIERS}
items = [(c["id"], c["rarity"], False) for c in d["cards"]] + [(t["id"], "ธรรมดา", True) for t in d["tokens"]]
for cid, tier, tok in items:
    im = ImageOps.exif_transpose(Image.open(f'{U}/art/{cid}.png')).convert('RGB')
    save(im, f'{OUT}/art/{cid}.webp', (768,768)); save(im, f'{OUT}/art/thumb/{cid}.webp', (320,320), 78)
    man["cards"][cid] = {"tier": code_of[tier], "art": f"art/{cid}.webp", "art_thumb": f"art/thumb/{cid}.webp", "token": tok}
UI = '/mnt/user-data/outputs/ui'
for n in os.listdir(UI):
    key = n[:-4].lower(); im = Image.open(f'{UI}/{n}').convert('RGBA')
    if key == 'card_back':
        save(im, f'{OUT}/ui/card_back.webp', (768,1152), 85); save(im, f'{OUT}/ui/thumb/card_back.webp', (256,384), 85)
        man["ui"][key] = {"full": "ui/card_back.webp", "thumb": "ui/thumb/card_back.webp"}
    else:
        save(im, f'{OUT}/ui/{key}.webp', (128,128), 90); man["ui"][key] = f"ui/{key}.webp"
json.dump(man, open(f'{OUT}/manifest.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(man["cards"]), "cards")
