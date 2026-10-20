# Brief ảnh trang bị (44 icon)

> **Instructions for Codex (agent):**
> 1. Create one icon image for **every row** in sections C and D (44 images). The file name is the `id` column: `art/gear/<id>.png` (e.g. `art/gear/artifact_bashosen.png`).
> 2. Every image: **PNG 1024×1024, real transparent background (alpha), one single object, centered, filling 75–85 % of the canvas, nothing touching the edges.** No frame, no card, no background color, no glow box, no text, no letters, no watermark, no character / hand holding it. The game draws the rarity-colored frame itself.
> 3. **Consistent style across all 44 icons** (section A). Draw `weapon_kunai` first, then pass it as a **style reference image** for every other icon, so line weight, lighting and rendering match.
> 4. Use the prompt in the table + the common suffix in section A. The prompts describe the object only. Do **not** add franchise or character names to the prompts (image tools often refuse them, and they are not needed).
> 5. Run `python tools/check_assets.py --gear`. Every file must print `OK` (it also lists missing files and files with a wrong name). Then run `python tools/build_assets.py`. It crops, centers and saves `game/public/gear/<id>.webp` + `manifest.json`.
> 6. If the image tool refuses an item, try once more with simpler wording. If it still refuses, skip it and list it in the commit body. The game shows a kanji icon for missing images.
> 7. Do **not** modify game source code. Commit `art/gear/` and `game/public/gear/` with message `Thêm icon trang bị`.

Mục tiêu: mỗi món đồ rơi ra có tên và hình riêng thay cho chữ Hán. Một mẫu đồ có thể rơi ra ở nhiều phẩm chất. Khung màu (xám / xanh lá / xanh dương / vàng / đỏ / cầu vồng) do game vẽ, nên **ảnh không được tô màu theo phẩm chất**. Tuy vậy, mẫu chỉ rơi ở phẩm chất cao (cột "Phẩm") nên trông xịn hơn: nhiều chi tiết hơn, vật liệu quý, có ánh chakra.

## A. Phong cách chung

- Icon vật phẩm kiểu game gacha anime: tô màu bán hiện thực (painted cel-shading), nét viền tối mảnh, khối rõ.
- Góc nhìn 3/4 hơi chéo, vật dài (kiếm, quạt, gậy) đặt chéo từ góc dưới-trái lên góc trên-phải.
- Ánh sáng chính từ trên-trái, có viền sáng (rim light) ấm ở mép phải để nổi trên nền tối.
- Hình khối phải **đọc được ở 48 px**: dáng đặc trưng, không nhiều chi tiết vụn.
- Đồ thường (phẩm 0–2): vải, da, sắt cũ, hơi trầy xước, màu trầm.
- Đồ cao cấp (phẩm 3–5): kim loại sáng, viền vàng, hoa văn khắc, có thể có **ánh chakra mờ bám sát vật** (không phải quầng sáng vuông).
- Pháp khí bậc Lục Đạo (D3): huyền bí, cổ xưa, có ánh sáng thần bí nhẹ, cảm giác bảo vật thần thoại.

**Hậu tố chung, thêm vào cuối mỗi prompt:**
`single game item icon, anime gacha RPG style, painted cel-shading with clean dark outline, 3/4 view, lit from top-left with warm rim light, centered, fills 80% of the canvas, transparent background, 1024x1024, no frame, no text, no hands, no character`

## B. Kiểm tra nhanh trước khi lưu

- Nền trong suốt thật. Không chấp nhận ô caro xám-trắng vẽ vào ảnh; `check_assets.py` sẽ báo lỗi.
- Một vật duy nhất, không bị cắt mép.
- Đúng tên file (chữ thường, đúng id).

## C. Trang bị thường (31 icon)

| id | Tên trong game | Phẩm | Prompt (mô tả vật) |
|---|---|---|---|
| `weapon_kunai` | Kunai | 0–2 | a ninja kunai throwing knife, dark steel leaf-shaped blade, handle wrapped in worn beige cloth, metal ring at the pommel |
| `weapon_shuriken` | Phi Tiêu Bốn Cánh | 0–2 | a four-pointed ninja throwing star, dark steel with a hole in the center, slightly worn edges |
| `weapon_tanto` | Đoản Đao Ám Bộ | 1–4 | a short straight ninja tanto sword with a square guard, black wrapped grip, polished blade, black lacquered sheath beside it |
| `weapon_katana` | Trường Kiếm Lôi Quang | 3–5 | an elegant long katana with a pale silver blade crackling with thin blue lightning along the edge, ornate gold guard, dark blue wrapped grip |
| `weapon_fuma` | Phong Ma Thủ Lý Kiếm | 3–5 | a giant folding windmill shuriken with four large curved blades, polished steel with engraved patterns and gold rivets, center hub wrapped in red cloth |
| `helmet_hood` | Mũ Trùm Vải | 0–2 | a simple dark grey cloth ninja hood with face wrap, folded fabric, slightly frayed |
| `helmet_anbu` | Mặt Nạ Ám Bộ | 1–4 | a white porcelain animal mask shaped like a stylized fox face with red painted markings, eye holes, ninja special forces style |
| `helmet_samurai` | Mũ Giáp Thiết Quốc | 3–5 | an ornate samurai kabuto helmet, dark steel plates with gold crest horns, neck guard of lacquered plates, polished |
| `helmet_kage` | Nón Ảnh | 3–5 | a large conical leader's ceremonial hat of white cloth with a red front panel, hanging white veil at the back, worn by a village chief |
| `armor_mesh` | Áo Lưới Nhẫn Giả | 0–2 | a ninja chainmesh undershirt, dark fine metal mesh fabric shirt, folded slightly |
| `armor_vest` | Áo Giáp Trung Nhẫn | 0–3 | an olive green ninja flak vest with many scroll pouches on the chest, high collar, red swirl emblem on the back shoulder |
| `armor_cloak` | Áo Choàng Mây Đỏ | 3–5 | a long black high-collared cloak decorated with red clouds outlined in white, flowing hem |
| `armor_samurai` | Giáp Đỏ Chiến Quốc | 3–5 | an ancient red lacquered samurai chest armor of overlapping plates tied with dark cords, battle-worn but majestic, warring-states era |
| `pants_wrap` | Quần Quấn Ống | 0–2 | simple navy blue ninja trousers with white bandage wraps around the shins, folded |
| `pants_hakama` | Quần Hakama | 1–4 | wide pleated dark purple hakama trousers with a thick tied rope belt |
| `pants_armored` | Quần Giáp Đùi | 3–5 | dark ninja trousers with steel thigh guard plates and knee armor, gold rivets |
| `pants_sage` | Quần Tiên Nhân | 3–5 | loose mystic sage trousers in deep orange and black with a red flame pattern on the hem, fine fabric |
| `gloves_fingerless` | Găng Hở Ngón | 0–2 | a pair of black fingerless ninja gloves with a small metal plate on the back of the hand |
| `gloves_bracer` | Hộ Uyển Sắt | 1–4 | a pair of steel forearm guards strapped with leather buckles, slightly scratched |
| `gloves_claw` | Găng Vuốt Thép | 3–5 | an armored ninja gauntlet with three curved steel claws on the fingertips, dark metal with silver edges |
| `gloves_thunder` | Găng Giáp Lôi Điện | 3–5 | an ornate armored gauntlet of dark blue steel with gold trim, small blue lightning arcs crackling over the knuckles |
| `boots_sandal` | Dép Nhẫn Giả | 0–2 | a pair of blue open-toe ninja sandals with straps, simple and worn |
| `boots_wrap` | Giày Quấn Vải | 0–3 | a pair of ninja tabi boots with split toe, wrapped in grey cloth bandages up to the shin |
| `boots_armored` | Giày Giáp Sắt | 3–5 | a pair of armored ninja boots with steel shin guards and lacquered plates, dark red cords |
| `boots_wind` | Giày Phong Hành | 3–5 | a pair of light elegant ninja boots in white and pale green, with feather-like wind patterns and faint swirling wind around them |
| `headband_leaf` | Băng Đô Làng Lá | 0–4 | a ninja forehead protector: navy blue cloth band with a polished steel plate engraved with a stylized leaf symbol (a spiral with a pointed tip) |
| `headband_sand` | Băng Đô Làng Cát | 0–4 | a ninja forehead protector: dark red cloth band with a steel plate engraved with an hourglass-like symbol |
| `headband_mist` | Băng Đô Làng Sương Mù | 0–4 | a ninja forehead protector: dark blue cloth band with a steel plate engraved with four wavy vertical lines |
| `headband_cloud` | Băng Đô Làng Mây | 0–4 | a ninja forehead protector: black cloth band with a steel plate engraved with a stylized cloud symbol |
| `headband_stone` | Băng Đô Làng Đá | 0–4 | a ninja forehead protector: grey cloth band with a steel plate engraved with two vertical rectangles bracketed by lines (mountain symbol) |
| `headband_alliance` | Băng Đô Liên Quân Nhẫn Giả | 3–5 | a war-time ninja forehead protector: black cloth band with a shiny steel plate engraved with the single kanji 忍, a long black tail of cloth, heroic |

## D. Pháp khí (13 icon): bảo vật và thần khí

Ô hiếm nhất. Mỗi món có tên, chỉ số chính và mô tả riêng (đã có trong game). Hình phải đúng đặc điểm nhận diện dưới đây.

### D1. Dụng cụ nhẫn giả đặc biệt (phẩm thấp)

| id | Tên trong game | Phẩm | Prompt |
|---|---|---|---|
| `artifact_scroll` | Đại Quyển Trục Phong Ấn | 0–2 | a giant ninja summoning scroll partially unrolled, thick beige paper with black seal ink markings and a red binding cord, wooden end caps |
| `artifact_hiraishin` | Kunai Phi Lôi Thần | 0–3 | a special three-pronged kunai with a central blade and two curved side prongs, dark steel, handle wrapped in cloth with a paper tag covered in black seal script, faint yellow flash glow |
| `artifact_trench` | Song Đao Chakra | 0–3 | a pair of trench knives: short straight blades with knuckle-duster grips, steel with a faint pale blue wind chakra edge |

### D2. Vũ khí huyền thoại (phẩm giữa)

| id | Tên trong game | Phẩm | Prompt |
|---|---|---|---|
| `artifact_samehada` | Samehada | 2–4 | a huge greatsword without a sharp edge, its blade completely covered in dense blue-grey shark scales, partly wrapped in bandages, a small hilt with a skull-like pommel, alive-looking |
| `artifact_kubikiri` | Đại Đao Chém Đầu | 2–4 | a massive cleaver greatsword with a wide rectangular blade, a large round hole near the tip and a semicircular notch at the base of the spine, long wrapped handle |
| `artifact_kusanagi` | Kiếm Kusanagi | 2–5 | a slender straight-bladed sword with no guard, white grip and a white scabbard, the blade glowing with a faint thin purple-blue lightning |
| `artifact_kiba` | Song Kiếm Nanh Lôi | 2–4 | a pair of twin swords with short handles and serrated jagged blades shaped like lightning bolts, crackling with blue electricity |
| `artifact_gunbai` | Quạt Chiến Gunbai | 3–5 | a large Japanese war fan (gunbai) of red lacquered wood with black edges and three black tomoe comma marks, attached to a long chain with a sickle, ancient clan treasure |

### D3. Bảo bối Lục Đạo, thần khí Đại chiến Nhẫn giả lần thứ tư (phẩm cao)

| id | Tên trong game | Phẩm | Prompt |
|---|---|---|---|
| `artifact_shichiseiken` | Thất Tinh Kiếm | 4–5 | a mystical sword whose blade is made of pure flowing pale blue chakra light, attached to an ornate ancient bronze hilt with seven small inlaid stars, divine relic |
| `artifact_bashosen` | Quạt Ba Tiêu | 4–5 | a huge round palm-leaf fan of dark red lacquer with a gold rim and a long wooden handle, three black magatama marks on the leaf, tiny swirls of fire, wind and water around its edge, divine relic |
| `artifact_benihisago` | Hồng Hồ Lô | 4–5 | a large crimson red sake gourd with a golden stopper, tied with a thick braided rope, a faint mystic glow escaping from the mouth, divine relic |
| `artifact_kokinjo` | Kim Thằng | 4–5 | a long coiled golden rope glowing with soft golden light, its strands like woven sunlight, loosely knotted in a circle, divine relic |
| `artifact_kohaku` | Hổ Phách Tịnh Bình | 4–5 | an ancient purification jar made of translucent amber with a dark gold lid and base, gourd-like vase shape, warm golden light inside, divine relic |
| `artifact_shakujo` | Tích Trượng Lục Đạo | 4–5 | a long ancient monk's staff with an ornate metal top ring holding six smaller rings, dark wood shaft, faint black and white yin-yang aura, divine relic |
| `artifact_gudodama` | Cầu Đạo Ngọc | 5 | nine floating pitch-black orbs arranged in a ring, deep matte black with a faint purple rim light, one orb in front morphing into a black staff, ominous divine power |

## E. Gợi ý xử lý khi trình tạo ảnh làm sai

- **Nền trắng hoặc caro:** yêu cầu vẽ lại với "transparent background with real alpha channel, no checkerboard".
- **Vật bị cắt hoặc quá nhỏ:** vẽ lại. `build_assets.py` tự cắt sát và căn giữa, nên chỉ cần vật nằm trọn trong ảnh.
- **Nhiều vật thừa** (ví dụ thêm bàn tay, giá đỡ): vẽ lại với "single object only, nothing else".
