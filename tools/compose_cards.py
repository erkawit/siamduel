"""ประกอบภาพการ์ด: ภาพ SDxxx.png + โครงการ์ดตามระดับ -> การ์ดเต็มใบ
ใช้: python compose_cards.py <โฟลเดอร์โครงโปร่งใส> <โฟลเดอร์ภาพ> <siam_duel_cards.json> <โฟลเดอร์ผลลัพธ์> [ระดับ]
ใส่ [ระดับ] เพื่อประกอบเฉพาะระดับนั้น เช่น ธรรมดา
"""
import sys, json, os
from PIL import Image, ImageOps

FRAME_OF_TIER = {           # แก้ได้ถ้าอยากใช้โครงชุด Original
    "ธรรมดา": "01_Ivory_Minimal.png",
    "ทั่วไป": "09_Jade_Green_Consistent_Layout.png",
    "หายาก": "10_Sky_Blue_Consistent_Layout.png",
    "มหากาพย์": "11_Royal_Purple_Consistent_Layout.png",
    "ตำนาน": "12_Blood_Red_Consistent_Layout.png",
    "พระเจ้า": "13_Royal_Gold_Consistent_Layout.png",
    "ผู้สรรสร้าง": "14_Rainbow_Diamond_Consistent_Layout.png",
}
BLEED = 8          # ขยายภาพเกินช่องเล็กน้อย ซ่อนใต้ขอบกรอบ
TOP_BIAS = 0.3     # ครอปค่อนบน กันหัวตัวละครขาด (0=ชิดบน, 0.5=กลาง)

frames_dir, art_dir, cards_json, out_dir = sys.argv[1:5]
ONLY = sys.argv[5] if len(sys.argv) > 5 else None
os.makedirs(out_dir, exist_ok=True)
rects = json.load(open(os.path.join(frames_dir, "art_windows.json"), encoding="utf-8"))
_data = json.load(open(cards_json, encoding="utf-8"))
cards = _data["cards"] + [dict(t, rarity="ธรรมดา", is_token=True) for t in _data.get("tokens", [])]
done, missing = 0, []
for c in cards:
    if ONLY and (("โทเคน" if c.get("is_token") else c["rarity"]) != ONLY):
        continue
    art_path = next((os.path.join(art_dir, c["id"] + e) for e in (".png", ".jpg", ".jpeg", ".webp")
                     if os.path.exists(os.path.join(art_dir, c["id"] + e))), None)
    if not art_path:
        missing.append(c["id"]); continue
    fname = FRAME_OF_TIER[c["rarity"]]
    frame = Image.open(os.path.join(frames_dir, fname)).convert("RGBA")
    if frame.getchannel("A").getextrema()[0] > 0:
        sys.exit(f"หยุด: {fname} ในโฟลเดอร์ {frames_dir} ยังเป็นโครงสีเขียว ไม่มีช่องโปร่งใส "
                 "ให้ใช้ไฟล์ที่ทำช่องโปร่งใสแล้วแทน (ภาพในโฟลเดอร์ art ไม่ได้รับผลกระทบ)")
    r = rects[fname]
    w, h = r["w"] + 2 * BLEED, r["h"] + 2 * BLEED
    art = ImageOps.fit(Image.open(art_path).convert("RGBA"), (w, h),
                       Image.LANCZOS, centering=(0.5, TOP_BIAS))
    card = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    card.paste(art, (r["x"] - BLEED, r["y"] - BLEED))
    card.alpha_composite(frame)
    label = "โทเคน" if c.get("is_token") else c["rarity"]
    card.save(os.path.join(out_dir, f'{c["id"]}_{label}.png'), optimize=True)
    done += 1
print(f"ประกอบแล้ว {done} ใบ")
if missing:
    print(f"ยังไม่มีภาพ {len(missing)} ใบ:", " ".join(missing))
ids = {c["id"] for c in cards}
ok_ext = (".png", ".jpg", ".jpeg", ".webp")
stray = [f for f in sorted(os.listdir(art_dir))
         if os.path.splitext(f)[0] not in ids or not f.lower().endswith(ok_ext)]
if stray:
    print("ไฟล์ในโฟลเดอร์ art ที่ไม่ได้ใช้ เพราะชื่อหรือนามสกุลไม่ตรง (ต้องเป็น SDxxx.png หรือ .jpg):")
    for f in stray:
        print("   ", repr(f))
