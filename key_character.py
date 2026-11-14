"""ลบพื้นเขียว #00FF00 รอบตัวละคร -> PNG พื้นใส
ใช้: python key_character.py <โฟลเดอร์ภาพพื้นเขียว> <โฟลเดอร์ผลลัพธ์>
"""
import sys, os, glob
import numpy as np
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
for f in sorted(glob.glob(os.path.join(src, "*.*"))):
    if not f.lower().endswith((".png", ".jpg", ".jpeg", ".webp")): continue
    a = np.array(Image.open(f).convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gness = g - np.maximum(r, b)
    bg = (gness > 90) & (g > 150)
    lab, _ = ndimage.label(bg)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge)) | (bg & (gness > 140))          # พื้นหลัง + ช่องว่างระหว่างแขน
    alpha = 1 - np.clip((gness - 25) / (110 - 25), 0, 1)
    alpha[bg] = 0
    near = ndimage.binary_dilation(bg, iterations=4) & ~bg
    g2 = np.where(near | (alpha < 1), np.minimum(g, np.maximum(r, b) * 1.05), g)  # ลดขอบเขียว
    rgba = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    im = Image.fromarray(rgba, "RGBA"); bbox = im.getbbox()
    if bbox: im = im.crop(bbox)                                     # ตัดขอบว่างออก
    name = os.path.splitext(os.path.basename(f))[0] + ".png"
    im.save(os.path.join(out, name), optimize=True); print("ok", name, im.size)
