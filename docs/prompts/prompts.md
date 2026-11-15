# Prompt ภาพสำหรับหน้าเริ่มเกม — สยามินทร์ดุเอล

ใช้เครื่องมือเดียวกับที่ทำการ์ด (ChatGPT / Gemini / Midjourney) ทุก Prompt ห้ามมีตัวหนังสือในภาพ

---

## 1. ตัวละครผู้เล่น

### ขั้นที่ 1: ทำแผ่นอ้างอิงตัวละคร (ทำก่อน แล้วใช้เป็นภาพอ้างอิงของภาพอื่นทั้งหมด หน้าตาจะได้เหมือนกันทุกภาพ)

**ชาย — แผ่นอ้างอิง**
```
Character reference sheet of a strikingly handsome young Thai man in his mid-20s for a Thai dark fantasy card game, shown three times side by side: front view, three-quarter view, back view, full body, standing neutral pose. Warm tan skin, sharp jawline, high cheekbones, dark intense almond eyes, thick straight eyebrows, short black hair swept back with a slight undercut, confident calm expression. Outfit: dark-fantasy Thai warrior-noble attire, a fitted black silk jacket with a mandarin collar and fine gold Thai kanok embroidery, a deep crimson sash with gold trim around the waist, black chong kraben trousers, leather arm guards with brass studs, a sacred cord sai sin on the wrist, a small Thai amulet pendant, a Thai dha sword in a black lacquered scabbard at the hip, leather sandals. Plain neutral grey background, even studio lighting, high detail, semi-realistic painterly concept art. No text, no letters, no watermark.
```

**หญิง — แผ่นอ้างอิง**
```
Character reference sheet of a breathtakingly beautiful young Thai woman in her early 20s for a Thai dark fantasy card game, shown three times side by side: front view, three-quarter view, back view, full body, standing graceful neutral pose. Glowing warm golden-tan skin, delicate oval face, elegant almond eyes with long lashes, soft confident smile, long glossy black hair tied in a traditional half-up bun with gold hairpins and a small jasmine garland. Outfit: elegant dark-fantasy Thai noblewoman attire, a deep violet silk sabai draped over one shoulder with gold kanok embroidery, a fitted black inner top, a black and gold pha sin long skirt with traditional patterns, a gold waist belt, gold armlets and bracelets, a sacred cord on the wrist, holding a small folded talisman fan, modest and graceful. Plain neutral grey background, even studio lighting, high detail, semi-realistic painterly concept art. No text, no letters, no watermark.
```

### ขั้นที่ 2: ภาพที่ใช้ในเกม (แนบแผ่นอ้างอิงไปด้วย แล้วสั่ง "same character as the reference")

| ไฟล์ | Prompt (ต่อท้ายคำอธิบายตัวละครจากแผ่นอ้างอิง) |
| --- | --- |
| `male_full.png` / `female_full.png` | `Same character as the reference image. Full body heroic standing pose, slight three-quarter turn, looking at the viewer, standing on dark temple stone steps at night, moonlight rim light and warm lantern glow, gold dust in the air. Vertical 2:3, character centered with space above the head, plain dark background fading to black at the edges. No text.` |
| `male_bust.png` / `female_bust.png` | `Same character as the reference image. Portrait from the waist up for a dialogue box, facing slightly to the left, neutral friendly expression, soft lantern light, dark plain background. Vertical 4:5. No text.` |
| (ไม่บังคับ) `*_bust_happy.png` `*_bust_angry.png` `*_bust_surprised.png` `*_bust_sad.png` | ใช้ Prompt เดียวกับ bust แล้วเปลี่ยน `neutral friendly expression` เป็น `big warm smile` / `fierce determined angry expression` / `surprised wide-eyed expression` / `sad downcast expression` |
| (ไม่บังคับ) `*_duel.png` | `Same character as the reference image. Dynamic duel pose holding glowing playing cards fanned in one hand, magical gold sigils swirling around, dramatic low angle, dark background. Vertical 2:3. No text.` |

### NPC
| ไฟล์ | Prompt |
| --- | --- |
| `npc_shaman_bust.png` | `Portrait from the waist up of a wise elderly Thai village shaman for a Thai dark fantasy game dialogue box, thin white beard, kind but mysterious eyes, sak yant tattoos on the arms, wearing a faded white cotton shirt and a red cloth sash, many amulets and sacred cords around the neck and wrists, holding a palm-leaf manuscript, warm candlelight, incense smoke, dark plain background. Vertical 4:5. No text.` |

ทำเสร็จแล้วถ้าอยากให้ตัวละครลอยบนพื้นหลังเกมสวยขึ้น ให้ลบพื้นหลังด้วยเครื่องมือลบพื้นหลัง (เช่น remove.bg หรือใน Canva) แล้วบันทึกเป็น PNG พื้นใส

---

## 2. การ์ดตัวอย่างหน้าล็อกอิน (การ์ดสมมติ ไม่ใช่การ์ดจริง)

ภาพจัตุรัส 1:1 บันทึกในโฟลเดอร์ `login/` เกมจะใส่กรอบ ชื่อ และคำว่า "ตัวอย่าง" ทับให้เอง

| ไฟล์ | การ์ด | Prompt |
| --- | --- | --- |
| `demo1.png` | ท้าวพายุทมิฬ (ตำนาน) | `Thai dark fantasy trading card illustration of an original fictional storm lord, a towering warrior in black and silver Thai-style armor with a tall pointed crown, long black cape torn by wind, holding a spear crackling with lightning, swirling storm clouds and rain, mythic colossal scale, glowing eyes, crimson embers, low-angle hero shot. Dark Thai mural painting meets cinematic concept art, square 1:1, subject centered. No text, no logo, no frame.` |
| `demo2.png` | นางพญาเพลิงจันทร์ (ตำนาน) | `Thai dark fantasy trading card illustration of an original fictional fire-moon queen, an elegant regal woman in a crimson and gold Thai royal costume with a tall golden crown, long black hair flowing like smoke, a blood-red full moon behind her, ribbons of flame swirling around her raised hand, mythic and majestic. Dark Thai mural painting meets cinematic concept art, square 1:1, subject centered. No text, no logo, no frame.` |
| `demo3.png` | จอมเทพรุ่งอรุณ (พระเจ้า) | `Thai dark fantasy trading card illustration of an original fictional god of dawn, a serene radiant celestial being with golden skin and a tall multi-tiered golden crown, seated on a lotus above golden clouds, a giant sunrise halo behind, radiant golden divine light, floating gold leaf particles, serene and majestic, not resembling any real religious figure. Dark Thai mural painting meets cinematic concept art, square 1:1, subject centered. No text, no logo, no frame.` |

---

## 3. ภาพขยับสำหรับพื้นหลังหน้าล็อกอิน

หน้าล็อกอินทำการ์ดขยับให้แล้วด้วยโค้ด: ลอยขึ้นลง เอียงตามเมาส์หรือตามการเอียงมือถือ มีแสงสะท้อนและประกายระยิบระยับ ส่วนวิดีโอพื้นหลังเป็นตัวเลือกเสริม

**ขั้นตอนทำวิดีโอพื้นหลัง**
1. สร้างภาพนิ่งแนวนอน 16:9 ก่อน (Prompt ด้านล่าง) ใช้ตัวละครสมมติ ไม่ใช้ภาพการ์ดจริง
2. นำภาพเข้าเครื่องมือแปลงภาพเป็นวิดีโอ (image-to-video) เช่น Kling AI, Runway, Luma Dream Machine, Hailuo หรือ Google Veo
3. ใส่ Prompt การขยับ (ด้านล่าง) ความยาว 5–10 วินาที
4. ทำให้วนซ้ำแบบไม่สะดุด: ใน CapCut หรือโปรแกรมตัดต่อ ต่อคลิปกับคลิปเดียวกันที่เล่นย้อนกลับ หรือทำ crossfade ช่วงรอยต่อ
5. ส่งออก MP4 (H.264) 1920×1080 ไม่มีเสียง ขนาดไม่เกิน 8 MB แล้วบันทึกเป็น `login/bg.mp4`
6. เปิดหน้าเกมใหม่ วิดีโอจะเล่นวนเองอยู่หลังการ์ดตัวอย่าง

**ภาพนิ่งพื้นหลัง 16:9**
```
Wide cinematic Thai dark fantasy landscape for a game login screen: a colossal ancient Thai temple on a cliff at night, a huge glowing moon partially eclipsed, golden prasat spires, giant naga statues lining the stairs, drifting mist, floating lanterns and gold dust, deep violet and gold color palette, dark empty space in the center for UI. Horizontal 16:9. No text, no logo, no characters.
```

**Prompt การขยับ (ใส่ในเครื่องมือทำวิดีโอ)**
```
Subtle cinematic ambient motion, slow camera push-in, mist drifting slowly, lanterns floating upward, gold dust sparkling, moonlight shimmering, flags and cloth gently swaying, seamless loop, no new objects, no camera shake, no text.
```

ถ้าจะทำภาพเทพหรือสัตว์เทพขยับ ใช้วิธีเดียวกัน แต่ควรใช้ตัวละครสมมติเท่านั้น และตรวจทุกเฟรมว่าการขยับไม่ทำให้ภาพผิดรูป ใบหน้าเพี้ยน หรือดูไม่เหมาะสม
