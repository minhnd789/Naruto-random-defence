# Brief tạo ảnh cho Codex / ChatGPT

Mục tiêu: thay hiệu ứng đòn đánh (hiện chỉ là chấm sáng vẽ bằng code) và hình nền chiến đấu bằng ảnh chất lượng cao.
Game tự nạp các file dưới đây nếu có. Thiếu file nào thì game dùng hiệu ứng cũ cho file đó, nên có thể làm dần từng phần.

## Quy ước chung (áp dụng cho mọi ảnh)

- **Phong cách:** anime 2D tô màu cel-shading kiểu game mobile gacha (Epic Seven, Naruto Storm), nét sạch, màu rực, phát sáng mạnh.
- **Không có nhân vật, không có chữ, không có logo, không có watermark.**
- **Định dạng:** PNG.
- **Hiệu ứng (thư mục `game/public/fx/`):** nền **đen tuyền #000000**, hiệu ứng nằm giữa khung, chừa lề khoảng 8% mỗi cạnh. Game hoà trộn kiểu *additive* nên vùng đen sẽ thành trong suốt; không cần nền trong suốt.
- **Hình nền (thư mục `game/public/bg/`):** 1920×1080. Một phần ba dưới cùng là mặt đất trống, phẳng, sáng vừa phải để đặt 10 nhân vật đứng hai bên. Đường chân trời khoảng 40% chiều cao tính từ trên xuống.
- Đặt đúng **tên file** như bảng bên dưới.

---

## A. Hình nền chiến đấu: `game/public/bg/`

| File | Dùng cho | Prompt (tiếng Anh, dán thẳng vào trình tạo ảnh) |
|---|---|---|
| `bg_konoha.png` | Chương 1, Luyện tập | Anime game battle background, a hidden ninja village of wooden houses with red roofs and a giant water tower, carved stone cliff behind the village, warm sunset sky with orange and violet clouds, cherry petals in the air, wide flat dirt training ground in the foreground with subtle stone circle markings, cel-shaded, vibrant, 1920x1080, no characters, no text |
| `bg_forest.png` | Chương 2, Rừng Tử Thần | Anime game battle background, dark gigantic ancient forest with enormous tree trunks and twisted roots, mist, shafts of green light through the canopy, fireflies, mossy flat clearing in the foreground, mysterious and slightly dangerous, cel-shaded, 1920x1080, no characters, no text |
| `bg_rain.png` | Chương 3 | Anime game battle background, industrial ninja village in endless rain, tall dark metal towers with pipes, grey-blue palette with purple neon reflections, wet stone plaza with puddles in the foreground reflecting the sky, heavy rain streaks, cel-shaded, 1920x1080, no characters, no text |
| `bg_valley.png` | Chương 4 | Anime game battle background, epic canyon with a huge waterfall between two colossal stone warrior statues facing each other, river below, dramatic twilight sky with moon, broken rocky flat ground in the foreground, epic final battle mood, cel-shaded, 1920x1080, no characters, no text |
| `bg_desert.png` | Bí cảnh | Anime game battle background, desert ninja village of round sand-colored buildings behind a canyon wall, golden afternoon sun, swirling sand in the wind, flat cracked sand ground in the foreground, cel-shaded, 1920x1080, no characters, no text |
| `bg_arena.png` | Đấu trường thường | Anime game battle background, ancient stone colosseum interior at dusk, torches and hanging red banners with abstract swirl symbols, crowd stands in silhouette, flat sand arena floor in the foreground, cel-shaded, 1920x1080, no characters, no text |
| `bg_rta.png` | RTA | Anime game battle background, floating stone battle platform above clouds at night, giant full moon, purple and blue aurora, glowing runes around the platform edge, flat polished stone floor in the foreground, epic esports atmosphere, cel-shaded, 1920x1080, no characters, no text |

---

## B. Hiệu ứng kỹ năng: `game/public/fx/`

Mỗi file 1024×1024, **nền đen tuyền**, hiệu ứng ở giữa.
Thêm vào cuối mỗi prompt: `, anime game VFX, glowing, on pure black background, centered, no text, no characters`.

### Đòn đánh chung

| File | Prompt |
|---|---|
| `fx_slash.png` | a single bright white crescent sword slash arc with cyan glow edge, diagonal, motion blur |
| `fx_slash_x.png` | two crossing white slash arcs forming an X, sparks at the intersection |
| `fx_impact.png` | star-shaped hit spark explosion, white core, orange rays, small debris particles |
| `fx_shockwave.png` | flat expanding energy ring seen at a slight top-down angle, white and pale blue, dust at the edge |
| `fx_kunai.png` | a single ninja kunai knife flying horizontally to the right with a white motion trail |

### Theo hệ

| File | Hệ | Prompt |
|---|---|---|
| `fx_fire_burst.png` | Hỏa | large fire explosion, orange and yellow flames, red embers, round shape |
| `fx_fireball.png` | Hỏa | a giant swirling fireball flying to the right, flame trail behind it |
| `fx_amaterasu.png` | Hỏa (Itachi) | black flames with dark purple and crimson edges, eerie, burning upward |
| `fx_wind_blades.png` | Phong | several crescent wind blades, pale green and white, swirling air streaks |
| `fx_rasengan.png` | Phong (Naruto) | a perfect sphere of swirling blue chakra, bright white core, spiral wind lines |
| `fx_rasenshuriken.png` | Phong (Naruto) | a giant spinning shuriken made of wind around a blue chakra core, four white blades, loud ringing feel |
| `fx_lightning.png` | Lôi | a vertical lightning bolt striking down, electric blue and white, branching arcs |
| `fx_chidori.png` | Lôi (Sasuke/Kakashi) | crackling ball of blue-white lightning with many chirping electric arcs bursting outward |
| `fx_sand_burst.png` | Thổ (Gaara) | a wave of golden sand erupting upward and swirling, grains and dust |
| `fx_sand_shield.png` | Thổ (Gaara) | a translucent dome of swirling golden sand, protective barrier |
| `fx_earth_spikes.png` | Thổ | sharp rock spikes bursting from the ground, flying stone fragments |
| `fx_water_shark.png` | Thủy (Kisame) | a giant shark made of water lunging to the right, splashes and foam |
| `fx_water_wave.png` | Thủy | a curling ocean wave of blue water, white foam crest |
| `fx_dark_orb.png` | Âm | a dark purple energy orb with black tendrils and swirling void particles |
| `fx_meteor.png` | Âm (Madara) | a huge flaming meteor falling diagonally from top-left, fire trail and smoke |
| `fx_light_burst.png` | Dương | a radiant golden light burst with soft rays and glowing particles, holy feeling |
| `fx_flash_step.png` | Dương (Minato) | a yellow lightning teleport flash with a three-pronged kunai silhouette and golden streaks |

### Kỹ năng đặc biệt

| File | Dùng cho | Prompt |
|---|---|---|
| `fx_susanoo_arrow.png` | Sasuke tuyệt kỹ | a giant purple energy arrow flying to the right, flaming violet aura and lightning sparks |
| `fx_kamui.png` | Kakashi tuyệt kỹ | a spiral space-time vortex, distorted black center, purple and grey swirling rings |
| `fx_tsukuyomi.png` | Itachi tuyệt kỹ | a blood red full moon with a black three-tomoe pattern spinning, red and black swirl background glow |
| `fx_shinra_tensei.png` | Pain | a massive spherical repulsion shockwave, white and pale violet, dust and debris pushed outward |
| `fx_crows.png` | Itachi | a swarm of black crows flying outward with dark feathers |
| `fx_shadow_bind.png` | Shikamaru | black shadow tendrils stretching across the ground like hands |
| `fx_twin_lions.png` | Hinata | two lion heads made of blue chakra, glowing |

### Hỗ trợ / trạng thái

| File | Prompt |
|---|---|
| `fx_heal.png` | a circle of glowing green healing light with rising leaves and sparkles |
| `fx_buff.png` | a rising pillar of golden-orange aura with upward arrows of light |
| `fx_debuff.png` | dark purple chains and downward smoke, cursed aura |
| `fx_stun.png` | a ring of small spinning yellow stars and swirls, cartoon dizzy effect |
| `fx_shield.png` | a hexagonal translucent cyan energy shield, honeycomb pattern |

---

## C. (Tuỳ chọn) Spritesheet hoạt hình

Nếu trình tạo ảnh làm được, mỗi hiệu ứng dưới đây là **lưới 4×4 = 16 khung**, ảnh 2048×2048 (mỗi khung 512×512), xếp từ trái sang phải, trên xuống dưới, nền đen tuyền, diễn biến từ lúc bắt đầu tới khi tan biến:

- `sheet_explosion.png`: vụ nổ lửa từ chấm sáng nhỏ, bùng to, rồi tan thành khói.
- `sheet_lightning.png`: tia sét đánh xuống rồi tắt dần.
- `sheet_slash.png`: vệt chém xuất hiện, quét qua, rồi mờ dần.

Không có spritesheet cũng không sao: game sẽ tự tạo chuyển động cho ảnh đơn (phóng to, xoay, mờ dần).

---

## Sau khi có ảnh

1. Chép file vào đúng thư mục `game/public/fx/` và `game/public/bg/`.
2. Báo lại để Claude nối từng hiệu ứng vào từng kỹ năng và tinh chỉnh chuyển động.
