"""ลบพื้นหลังดำรอบนอกการ์ด ให้โปร่งใส (คงแสงเรืองที่ขอบไว้แบบไล่ความโปร่งใส)"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
def key(src, dst):
    im = Image.open(src).convert('RGBA'); a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3], a[..., 3]
    mx = rgb.max(axis=2)
    dark = mx < 120                                  # พื้นดำ + แสงเรืองจางๆ
    lab, _ = ndimage.label(dark)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    outer = np.isin(lab, list(border))               # เฉพาะส่วนที่ต่อกับขอบภาพ = นอกตัวการ์ด
    outer = ndimage.binary_dilation(outer, iterations=2) & (mx < 160)
    new_a = np.clip((mx - 10) / 110, 0, 1)           # ดำสนิท = ใส, แสงเรือง = โปร่งแสง
    k = np.where(outer, new_a, 1.0)
    out_rgb = np.where(outer[..., None], np.clip(rgb / np.maximum(k[..., None], 1e-3), 0, 255), rgb)
    alpha = np.minimum(al, k * 255)
    Image.fromarray(np.dstack([out_rgb, alpha]).astype(np.uint8), 'RGBA').save(dst, optimize=True)
    return (alpha == 0).mean()
if __name__ == '__main__':
    print(sys.argv[1], round(key(sys.argv[1], sys.argv[2]), 3))
