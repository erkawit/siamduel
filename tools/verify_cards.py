"""ตรวจการ์ดที่ประกอบแล้วทั้งหมด + ทำภาพรวมการ์ดในหน้าเดียว
ใช้: python verify_cards.py transparent cards_final siam_duel_cards.json
"""
import sys, os, json
from PIL import Image, ImageChops
import numpy as np

frames_dir, final_dir, cards_json = sys.argv[1:4]
rects = json.load(open(os.path.join(frames_dir, "art_windows.json"), encoding="utf-8"))
cards = json.load(open(cards_json, encoding="utf-8"))["cards"]
FRAME_OF_TIER = {"ธรรมดา": "01_Ivory_Minimal.png", "ทั่วไป": "09_Jade_Green_Consistent_Layout.png",
    "หายาก": "10_Sky_Blue_Consistent_Layout.png", "มหากาพย์": "11_Royal_Purple_Consistent_Layout.png",
    "ตำนาน": "12_Blood_Red_Consistent_Layout.png", "พระเจ้า": "13_Royal_Gold_Consistent_Layout.png",
    "ผู้สรรสร้าง": "14_Rainbow_Diamond_Consistent_Layout.png"}

problems, thumbs = [], []
for fname in sorted(set(FRAME_OF_TIER.values())):
    fr = Image.open(os.path.join(frames_dir, fname))
    if fr.mode != "RGBA" or fr.getchannel("A").getextrema()[0] > 0:
        problems.append(f"โครง {fname}: ยังเป็นสีเขียว ไม่มีช่องโปร่งใส")
    else:
        r = rects[fname]
        a = np.array(fr.getchannel("A"))
        ys, xs = np.nonzero(a[r["y"]:r["y"]+r["h"], r["x"]:r["x"]+r["w"]] == 0)
        if len(xs) and (xs.min() > 3 or ys.min() > 3 or xs.max() < r["w"]-4 or ys.max() < r["h"]-4):
            problems.append(f"โครง {fname}: พิกัดใน art_windows.json ไม่ตรงกับช่องจริง")

for c in cards:
    path = os.path.join(final_dir, f'{c["id"]}_{c["rarity"]}.png')
    if not os.path.exists(path):
        problems.append(f'{c["id"]} ({c["name_th"]}): ไม่มีการ์ดใน {final_dir}'); continue
    im = Image.open(path).convert("RGBA")
    r = rects[FRAME_OF_TIER[c["rarity"]]]
    win = np.array(im.crop((r["x"], r["y"], r["x"]+r["w"], r["y"]+r["h"]))).astype(int)
    R, G, B, A = win[..., 0], win[..., 1], win[..., 2], win[..., 3]
    green = ((G > 200) & (R < 80) & (B < 80)).mean()
    hole = (A < 250).mean()
    if green > 0.05:
        problems.append(f'{c["id"]} ({c["name_th"]}): ช่องภาพยังเป็นสีเขียว {green:.0%}')
    if hole > 0.01:
        problems.append(f'{c["id"]} ({c["name_th"]}): ช่องภาพมีรูโปร่งใส {hole:.0%}')
    thumbs.append(im.resize((200, 300)))

if thumbs:
    cols = 10
    sheet = Image.new("RGBA", (200 * cols, 300 * ((len(thumbs) + cols - 1) // cols)), (20, 20, 20, 255))
    for i, t in enumerate(thumbs):
        sheet.alpha_composite(t, ((i % cols) * 200, (i // cols) * 300))
    sheet.convert("RGB").save("contact_sheet.jpg", quality=88)
    print(f"ทำภาพรวมการ์ด {len(thumbs)} ใบไว้ที่ contact_sheet.jpg")

if problems:
    print(f"พบปัญหา {len(problems)} จุด:")
    for p in problems: print("  -", p)
else:
    print("ผ่านทั้งหมด: การ์ดครบ ไม่มีช่องเขียว ไม่มีรูโปร่งใส พิกัดโครงถูกต้อง")
