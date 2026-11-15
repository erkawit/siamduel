"""ทำช่องสีเขียว #00FF00 ของโครงการ์ดให้โปร่งใส + บันทึกพิกัดช่องภาพ"""
import sys, json, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
rects = {}
for f in sorted(glob.glob(os.path.join(src, "*.png"))):
    a = np.array(Image.open(f).convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gness = g - np.maximum(r, b)
    core = (g > 180) & (gness > 120)
    lab, n = ndimage.label(core)
    sizes = ndimage.sum(core, lab, range(1, n + 1))
    win = lab == (np.argmax(sizes) + 1)              # ช่องภาพ = ก้อนเขียวที่ใหญ่สุด
    win = ndimage.binary_fill_holes(win)
    zone = ndimage.binary_dilation(win, iterations=6)  # เผื่อขอบ anti-alias
    alpha = np.ones_like(g)
    soft = 1 - np.clip((gness - 30) / (150 - 30), 0, 1)
    alpha[zone] = soft[zone]
    alpha[win] = np.minimum(alpha[win], 0)           # ด้านในโปร่งใสเต็ม
    gz = zone & (alpha > 0)                           # despill ขอบ
    g2 = g.copy(); g2[gz] = np.minimum(g[gz], np.maximum(r[gz], b[gz]))
    rgba = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype(np.uint8)
    name = os.path.basename(f)
    Image.fromarray(rgba, "RGBA").save(os.path.join(out, name), optimize=True)
    ys, xs = np.nonzero(win)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    rects[name] = {"x": x0, "y": y0, "w": x1 - x0 + 1, "h": y1 - y0 + 1,
                   "ratio": round((x1 - x0 + 1) / (y1 - y0 + 1), 3)}
    print(name, rects[name])
json.dump(rects, open(os.path.join(out, "art_windows.json"), "w"), indent=1)
