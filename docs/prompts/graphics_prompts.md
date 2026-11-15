# Prompt กราฟิกเกม — สยามมินทร์ดูเอล

ภาพที่ระบุ "พื้นเขียว" ให้สร้างบนพื้นเขียวล้วน แล้วใช้ `key_character.py` ลบพื้น (หรือเลือก Transparent background ถ้าเครื่องมือมี)
ภาพที่มีหลายชื่อไฟล์ ให้สร้างครั้งแรกตาม Prompt แล้วสร้างซ้ำโดยแนบภาพแรกเป็นภาพอ้างอิง เปลี่ยนเฉพาะส่วนที่วงเล็บบอก สไตล์จะได้เป็นชุดเดียวกัน
เก็บไฟล์ไว้ในโฟลเดอร์ `ui_art`


## หน้าดวล

### `duel_board_pc.png` — 16:9 (1920x1080)
```
Top-down view of an empty card game play mat for a Thai dark fantasy card duel: a large dark grey slate chalkboard surface with subtle chalk dust texture, framed by an ornate carved teak wood border with gilded Thai kanok patterns. On the slate, hand-drawn white-gold chalk outlines of the play zones: two horizontal rows of five rounded-rectangle card slots on the lower half and two rows mirrored on the upper half, plus two smaller slots per side for face-down traps, a chalk circle at the far left and far right of each side for deck and graveyard piles, and a thin decorative chalk line with a small moon emblem across the center. Symmetrical, flat even lighting, empty slots only, no cards. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `duel_board_mobile.png` — 9:16 (1080x1920)
```
Top-down view of an empty card game play mat, vertical portrait layout, dark grey slate chalkboard surface with chalk dust texture, ornate carved teak wood border with gilded Thai kanok patterns, white-gold chalk outlines of five card slots in one row on the upper half and five card slots in one row on the lower half, two small trap slots per side, a thin chalk center line with a small moon emblem, symmetrical, flat even lighting, empty, no cards. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `slot_glow_valid.png / slot_glow_invalid.png` — 2:3 (400x600) พื้นเขียว
```
A single rounded-rectangle card slot outline drawn in glowing chalk, soft golden glow (second version: soft crimson red glow), on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `hp_orb.png` — 1:1 (512) พื้นเขียว
```
A round glass orb game health gauge, filled with glowing crimson liquid life essence, framed by an ornate gold Thai ring with small naga heads, front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `arkom_gem_on.png / arkom_gem_off.png` — 1:1 (256) พื้นเขียว
```
A single small faceted magic gem for a mana gauge, glowing sapphire blue with a tiny Thai yantra symbol inside (second version: dark empty grey gem, no glow), set in a small gold setting, front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `barami_bead.png` — 1:1 (256) พื้นเขียว
```
A single glowing golden prayer bead with a soft warm halo, front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `rahu_moon_normal.png / rahu_moon_eclipse.png` — 1:1 (512) พื้นเขียว
```
A circular emblem of a full silver moon in an ornate gold Thai frame (second version: the moon being swallowed by the dark demon head of Rahu with a violet glowing corona), front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `btn_end_turn.png` — 3:1 (900x300) พื้นเขียว
```
An ornate horizontal game button plate made of deep crimson lacquer with a thick gold Thai kanok border and small lotus ornaments at both ends, empty center for a label, front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `victory.png / defeat.png` — 16:9
```
A grand victory banner scene: a golden Thai ceremonial banner with radiant light rays, floating gold leaf and fireworks over a night temple (second version: a defeat scene with a broken dark banner, falling ash, cold blue moonlight), empty space in the center for a title. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```


## ตู้สุ่ม

### `gacha_bg.png` — 16:9
```
Interior of a sacred Thai temple hall at night, symmetrical composition, in the center a magnificent golden busabok pavilion shrine with a tiered spire, inside it a giant closed golden lotus glowing softly, rows of candles and incense, gold pillars with kanok patterns, red velvet carpet leading to the shrine, mysterious violet mist, empty space at the bottom for buttons. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `gacha_lotus_closed.png / gacha_lotus_open.png` — 1:1 พื้นเขียว
```
A giant ornate golden lotus flower, closed bud glowing from within (second version: fully bloomed open with brilliant light bursting from the center and petals spread wide), front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `burst_common.png ... burst_divine.png (6 สี)` — 1:1 พื้นเขียว
```
A radial burst of light rays and sparkles for a gacha reveal effect, color: soft white (make versions in jade green, sky blue, royal purple, blood red with embers, and radiant gold with glitter), centered, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `event_shrine_bg.png` — 16:9
```
A celestial floating diamond pavilion shrine made of iridescent rainbow crystal with a tiered Thai spire, hovering among clouds and stars at night, prismatic rainbow light rays, a ring of floating lotus lanterns, aurora in the sky, majestic and sacred, empty space at the bottom for buttons. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `btn_pull1.png / btn_pull10.png` — 3:1 พื้นเขียว
```
An ornate horizontal game button plate, red and gold for single pull (second version: larger, purple and gold with a small glowing lotus emblem on the left for ten pulls), empty center for a label, front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```


## ห้องพัก

### `room_bg.png` — 16:9
```
Interior of a cozy traditional Thai teak wood house at night, warm lantern light, a low wooden table with a card mat on the right, a tall lacquered cabinet with gold patterns for storing cards, a small ornate safe chest, a standing mirror with gold frame, an open doorway to a moonlit garden on the left, empty floor space in the center for a character to stand, warm and inviting. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```


## ล็อบบี้

### `lobby_bg.png` — 16:9
```
A Thai dark fantasy town square at night beside a grand temple, lanterns strung across, market stalls, a stone stage arena in the distance, mist and fireflies, empty foreground space on the left for a character. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```


## กิลด์

### `guild_hall_bg.png` — 16:9
```
A grand Thai guild hall interior at night, high carved wooden ceiling, red and gold banners hanging, a long war table with a map, weapon racks with Thai swords, a training ring of sand in the background, torch light, empty center space. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `guild_training_bg.png` — 16:9
```
An outdoor Thai martial training courtyard at dusk inside temple walls, wooden training dummies, a sand ring, stone lion statues, banners, drifting dust in golden light, empty center space for card duel UI. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```


## ทั่วไป

### `loading_bg.png` — 9:16 และ 16:9
```
A mystical Thai dark fantasy key art without characters: a giant ornate golden card floating above a temple under an eclipsed moon, naga and garuda silhouettes in clouds, gold dust, deep violet sky, empty space at the bottom for a loading bar. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```


## ไอคอน

### `ic_duel, ic_gacha, ic_collection, ic_market, ic_guild, ic_mail, ic_settings, ic_room, ic_friends, ic_shop.png` — 1:1 (256) พื้นเขียว
```
A set-consistent round game menu icon medallion with a gold Thai kanok rim on black lacquer, centered emblem: crossed Thai swords (make versions for: a golden lotus shrine, a stack of cards, a balance scale, a war banner, a sealed letter, a gear wheel, a Thai house, two clasped hands, a treasure chest), bold clean silhouette readable at small size, front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```

### `cur_gold.png / cur_merit.png` — 1:1 (256) พื้นเขียว
```
A shiny ancient Thai gold coin with a square hole and kanok patterns (second version: a small glowing white-gold lotus symbolizing merit), front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```


## แชท/บทสนทนา

### `dialog_frame.png` — 5:1 พื้นเขียว
```
A long horizontal dialogue box frame of black lacquer with a thin gold Thai kanok border and small corner ornaments, empty dark translucent-looking center, front view, on a plain solid pure green #00FF00 background. Thai dark fantasy game UI art, ornate Thai kanok details, gold leaf, black lacquer, deep violet accents, cinematic lighting, ultra detailed. No text, no letters, no numbers, no logo, no watermark.
```
