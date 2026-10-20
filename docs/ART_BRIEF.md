# Brief tạo ảnh cho Codex / ChatGPT

> **Instructions for Codex (agent):**
> 1. Read this whole file. Every combat effect must be an **animated sprite sheet** (section B), not a single still image. Backgrounds (section A) are single images.
> 2. Sprite sheet layout is strict: **2048×2048 PNG, 4 columns × 4 rows = 16 frames, each frame 512×512, read left→right then top→bottom**. The effect must stay centered on the same anchor point in every frame (no drifting camera), and must fit inside each 512×512 cell with ~8% margin (never crosses into a neighbour cell).
> 2b. **Every effect sheet must have a TRANSPARENT background** (real alpha channel PNG). Ask the image tool explicitly for `transparent background`. Soft glows must fade out through alpha (semi-transparent pixels), not into a black or white fill. Do not paint a checkerboard pattern to imitate transparency.
>    - Fallback only if the tool returns an opaque image: regenerate on a flat solid chroma color (`#FF00FF` magenta; use `#00FF00` green for pink/purple effects), then run `python tools/pack_sheet.py --key <name> <generated.png>` to cut the background out.
>    - You do NOT need to choose blend modes; `blend` in `art/fx/manifest.json` is already set by the game team (glowing effects are drawn additively, dark/solid effects normally).
> 3. If your image tool cannot produce a clean, evenly spaced 4×4 grid, generate the **16 frames as separate 512×512 images** instead, save them to `art/frames/<name>/01.png … 16.png`, then run `python tools/pack_sheet.py <name>` to assemble `art/fx/<name>.png`. Never ship a sheet whose cells are misaligned.
> 4. After all sheets exist, run `python tools/check_assets.py`. It must print `OK` for every file. Fix any reported problem.
> 5. If an effect needs a different frame count or speed than the default, edit its entry in `art/fx/manifest.json` (`cols`, `rows`, `frames`, `fps`, `loop`). Do not change other fields.
> 6. Do **not** modify game source code (`game/src`, `server/src`). Only add images, frames and manifest values.
> 7. Commit with message `Thêm ảnh nền và spritesheet hiệu ứng` and list any asset you could not produce in the commit body.

Mục tiêu: thay hiệu ứng đòn đánh (hiện chỉ là chấm sáng vẽ bằng code) bằng **hoạt ảnh spritesheet mượt**, và thay nền chiến đấu bằng tranh vẽ chất lượng cao. Game tự nạp file nào có; file nào thiếu thì dùng hiệu ứng cũ, nên có thể làm dần.

## Quy ước chung

- **Phong cách:** anime 2D cel-shading kiểu game gacha (Epic Seven, Naruto Storm), màu rực, phát sáng mạnh, nét sạch.
- **Không nhân vật, không chữ, không logo, không watermark.**
- **Hiệu ứng (`art/fx/`):** spritesheet 2048×2048, lưới 4×4, **nền trong suốt** (PNG có alpha thật, yêu cầu `transparent background`). Quầng sáng mờ dần bằng độ trong suốt, không đổ nền đen hay trắng.
  - Game tự chọn cách hoà trộn theo `manifest.json`: hiệu ứng phát sáng (lửa, sét, chakra, ánh sáng, vệt chém) được *cộng màu* nên rực hơn; hiệu ứng tối hoặc đặc (lửa đen, quạ, bóng, đá, cát, khói, nước, kim loại) hoà trộn thường.
  - Dự phòng: nếu ảnh xuất ra không có alpha (nền đặc hoặc ô caro giả), vẽ lại trên phông màu đồng nhất `#FF00FF` (hiệu ứng hồng/tím dùng `#00FF00`) rồi chạy `python tools/pack_sheet.py --key <tên> <ảnh>` để tách nền.
- **Hình nền (`art/bg/`):** ảnh 1920×1080. Một phần ba dưới cùng là mặt đất trống, phẳng để đặt 10 nhân vật. Đường chân trời ở khoảng 40% chiều cao tính từ trên xuống.
- **Đặt đúng tên file như trong bảng.**

### Hai loại hoạt ảnh

| Loại | Ý nghĩa | Diễn biến 16 khung |
|---|---|---|
| **once** (phát một lần) | nổ, chém, trúng đòn, hiện chiêu | Khung 1–3: tia sáng nhỏ xuất hiện. Khung 4–7: bùng to nhanh. Khung 8–10: đạt đỉnh, sáng nhất. Khung 11–16: tan dần thành hạt/khói và mờ hẳn, **khung 16 gần như trong suốt hoàn toàn**. |
| **loop** (lặp lại) | vật thể đang bay, quả cầu đang xoay, hiệu ứng trạng thái | Cả 16 khung giữ nguyên kích thước và độ sáng, chỉ xoay/nhấp nháy/cuộn đều. **Khung 16 nối mượt về khung 1** (không giật khi lặp). |

Prompt mẫu để dán vào trình tạo ảnh (thay `<MÔ TẢ>` và `<DIỄN BIẾN>`):

```
Anime game VFX sprite sheet with a transparent background, 2048x2048 PNG,
4x4 grid of 16 evenly spaced 512x512 frames, read left to right then top to bottom,
same centered anchor point in every frame, no camera movement, nothing crosses into neighbouring cells.
Effect: <MÔ TẢ>. Animation: <DIỄN BIẾN>.
Glow fades out through transparency. Cel-shaded, vibrant, high contrast, no text, no characters, no grid lines.
```

---

## A. Hình nền chiến đấu: `art/bg/` (ảnh đơn)

| File | Dùng cho | Prompt |
|---|---|---|
| `bg_konoha.png` | Chương 1, Luyện tập | Anime game battle background, a hidden ninja village of wooden houses with red roofs and a giant water tower, carved stone cliff behind the village, warm sunset sky with orange and violet clouds, cherry petals in the air, wide flat dirt training ground in the foreground with subtle stone circle markings, cel-shaded, vibrant, 1920x1080, no characters, no text |
| `bg_forest.png` | Chương 2 | Anime game battle background, dark gigantic ancient forest with enormous tree trunks and twisted roots, mist, shafts of green light through the canopy, fireflies, mossy flat clearing in the foreground, cel-shaded, 1920x1080, no characters, no text |
| `bg_rain.png` | Chương 3 | Anime game battle background, industrial ninja village in endless rain, tall dark metal towers with pipes, grey-blue palette with purple neon reflections, wet stone plaza with puddles in the foreground, heavy rain streaks, cel-shaded, 1920x1080, no characters, no text |
| `bg_valley.png` | Chương 4 | Anime game battle background, epic canyon with a huge waterfall between two colossal stone warrior statues facing each other, river below, dramatic twilight sky with moon, broken flat rocky ground in the foreground, cel-shaded, 1920x1080, no characters, no text |
| `bg_desert.png` | Bí cảnh | Anime game battle background, desert ninja village of round sand-colored buildings behind a canyon wall, golden afternoon sun, swirling sand in the wind, flat cracked sand ground in the foreground, cel-shaded, 1920x1080, no characters, no text |
| `bg_arena.png` | Đấu trường | Anime game battle background, ancient stone colosseum interior at dusk, torches and hanging red banners with abstract swirl symbols, crowd stands in silhouette, flat sand arena floor in the foreground, cel-shaded, 1920x1080, no characters, no text |
| `bg_rta.png` | RTA | Anime game battle background, floating stone battle platform above clouds at night, giant full moon, purple and blue aurora, glowing runes around the platform edge, flat polished stone floor in the foreground, cel-shaded, 1920x1080, no characters, no text |

---

## B. Spritesheet hiệu ứng: `art/fx/`

Tất cả: 2048×2048, lưới 4×4, nền đen. Cột **Loại** cho biết dùng diễn biến *once* hay *loop* ở trên.

### B1. Hành động chung (mọi ninja đều dùng)

| File | Loại | Mô tả | Diễn biến riêng |
|---|---|---|---|
| `fx_slash.png` | once | bright white crescent sword slash with cyan glow edge, diagonal from top-left to bottom-right | the arc sweeps across in frames 1–6, leaves a glowing trail, trail thins and fades 7–16 |
| `fx_slash_x.png` | once | two crossing white slash arcs forming an X, sparks at the intersection | first slash 1–4, second slash 5–8, sparks burst 8–11, fade 12–16 |
| `fx_impact.png` | once | star-shaped hit spark, white core, orange rays, debris | tiny flash 1–2, star rays shoot out 3–6, rays shrink, debris flies outward and fades 7–16 |
| `fx_punch_impact.png` | once | heavy punch impact, circular shock rings, cracked air, dust | compression 1–3, ring bursts outward 4–9, dust settles and fades 10–16 |
| `fx_dash_trail.png` | once | horizontal speed-line dash trail with afterimage streaks, moving to the right | streaks stretch right 1–6, hold 7–9, thin out 10–16 |
| `fx_shockwave.png` | once | flat expanding energy ring seen from slight top-down angle, white and pale blue, dust at the edge | ring expands from center to the cell edge, fades as it grows |
| `fx_kunai.png` | loop | a ninja kunai flying to the right, spinning slightly, white motion trail | trail flickers, kunai wobbles; seamless loop |
| `fx_cast_circle.png` | once | glowing chakra seal circle on the ground (ellipse, top-down), runes rotating | circle draws itself 1–5, glows and rotates 6–11, fades 12–16 |
| `fx_death_smoke.png` | once | puff of white ninja smoke with a few leaves | puff bursts 1–5, billows 6–11, dissipates 12–16 |

### B2. Theo hệ

| File | Hệ | Loại | Mô tả | Diễn biến riêng |
|---|---|---|---|---|
| `fx_fireball.png` | Hỏa | loop | giant swirling fireball flying to the right, flame trail behind | flames churn and flicker, trail wavers; seamless loop |
| `fx_fire_burst.png` | Hỏa | once | large round fire explosion, orange-yellow flames, red embers | standard once explosion, ends in rising smoke and embers |
| `fx_amaterasu.png` | Hỏa | once | black flames with dark purple and crimson edges burning upward | black fire ignites 1–4, rages 5–11, shrinks to embers 12–16 |
| `fx_wind_blades.png` | Phong | once | several crescent wind blades, pale green and white, air streaks | blades spawn and fly outward in a fan, dissolving into streaks |
| `fx_rasengan.png` | Phong | loop | perfect sphere of swirling blue chakra, bright white core, spiral wind lines | spiral lines rotate one full turn over 16 frames; seamless |
| `fx_rasenshuriken.png` | Phong | loop | giant spinning wind shuriken around a blue chakra core, four white blades | blades rotate 90° over 16 frames (appears continuous); seamless |
| `fx_wind_explosion.png` | Phong | once | huge dome of wind with thousands of tiny white needles, blue-white | sphere expands violently 1–8, needles scatter 9–13, fade 14–16 |
| `fx_lightning.png` | Lôi | once | vertical lightning bolt striking down, electric blue and white, branching arcs | bolt strikes top→bottom 1–3, bright flash 4–6, flickers 7–11, fades 12–16 |
| `fx_chidori.png` | Lôi | loop | crackling ball of blue-white lightning with chirping arcs bursting outward | arcs jump randomly each frame around a steady core; seamless |
| `fx_sand_burst.png` | Thổ | once | golden sand erupting upward and swirling, grains and dust | sand erupts 1–6, swirls 7–11, grains fall and fade 12–16 |
| `fx_sand_coffin.png` | Thổ | once | sand wraps into a tight cocoon then implodes with a burst of sand | sand spirals in 1–7, cocoon squeezes 8–10, bursts 11–13, fades 14–16 |
| `fx_earth_spikes.png` | Thổ | once | sharp rock spikes bursting from the ground, flying stone fragments | spikes thrust up 1–5, hold 6–9, crumble into debris 10–16 |
| `fx_water_shark.png` | Thủy | loop | giant shark made of water lunging to the right, splashes and foam | body ripples, tail swishes, foam churns; seamless |
| `fx_water_splash.png` | Thủy | once | big water splash with droplets and foam ring | splash rises 1–6, droplets arc out 7–12, ripple fades 13–16 |
| `fx_dark_orb.png` | Âm | loop | dark purple orb with black tendrils and swirling void particles | tendrils writhe, particles orbit; seamless |
| `fx_dark_burst.png` | Âm | once | explosion of dark purple energy and black shards | standard once explosion in purple/black |
| `fx_meteor.png` | Âm | loop | huge flaming meteor falling diagonally from top-left, fire trail and smoke | flames and trail churn; seamless (the game moves it across the screen) |
| `fx_meteor_impact.png` | Âm | once | massive meteor ground impact, fire dome, rocks and smoke | flash 1–2, fire dome 3–8, rocks fly 9–12, smoke 13–16 |
| `fx_light_burst.png` | Dương | once | radiant golden light burst with soft rays and glowing particles | rays bloom 1–7, peak 8–9, particles drift up and fade 10–16 |
| `fx_flash_step.png` | Dương | once | yellow lightning teleport flash with golden streaks | bright yellow flash appears 1–3, streaks shoot outward 4–9, fade 10–16 |

### B3. Tuyệt kỹ đặc biệt

| File | Dùng cho | Loại | Mô tả | Diễn biến riêng |
|---|---|---|---|---|
| `fx_susanoo_arrow.png` | Sasuke | loop | giant purple energy arrow flying to the right, flaming violet aura, lightning sparks | aura flames flow backward, sparks crackle; seamless |
| `fx_kamui.png` | Kakashi | once | spiral space-time vortex, distorted black center, purple-grey rings | vortex opens 1–5, spins and pulls inward 6–12, collapses to a point 13–16 |
| `fx_tsukuyomi.png` | Itachi | once | blood red full moon with a black three-tomoe pattern spinning | moon fades in 1–4, tomoe spin 5–12, red flash and fade 13–16 |
| `fx_crows.png` | Itachi | once | swarm of black crows bursting outward with dark feathers | crows burst from center 1–6, fly outward 7–12, feathers drift and fade 13–16 |
| `fx_shinra_tensei.png` | Pain | once | massive spherical repulsion shockwave, white-violet, debris pushed outward | sphere expands 1–8, debris flies 9–13, dust ring fades 14–16 |
| `fx_shadow_bind.png` | Shikamaru | once | black shadow tendrils stretching across the ground like hands | tendrils creep outward 1–8, grip 9–12, retract and fade 13–16 |
| `fx_twin_lions.png` | Hinata | once | two lion heads of blue chakra roaring forward | lions form 1–5, lunge 6–10, burst into blue sparks 11–16 |
| `fx_sakura_punch.png` | Sakura/Tsunade | once | ground-shattering pink chakra punch impact, cracks and rock slabs flying | pink flash 1–2, crater cracks spread 3–8, slabs fly 9–13, dust 14–16 |
| `fx_eight_gates.png` | Rock Lee | loop | green-blue steam aura pillar of the opened gates | steam aura surges upward continuously; seamless |

### B4. Hỗ trợ và trạng thái

| File | Loại | Mô tả | Diễn biến riêng |
|---|---|---|---|
| `fx_heal.png` | once | circle of green healing light with rising leaves and sparkles | circle glows 1–5, leaves and sparkles rise 6–13, fade 14–16 |
| `fx_buff.png` | once | rising pillar of golden-orange aura with upward light arrows | pillar rises 1–6, arrows climb 7–12, fade 13–16 |
| `fx_debuff.png` | once | dark purple chains and downward smoke, cursed aura | chains wrap 1–7, tighten 8–11, smoke sinks and fades 12–16 |
| `fx_stun.png` | loop | ring of small spinning yellow stars and swirls (dizzy) | stars orbit one full turn over 16 frames; seamless |
| `fx_shield.png` | loop | hexagonal translucent cyan energy shield, honeycomb pattern | soft shimmer travels across hexagons; seamless |
| `fx_burn.png` | loop | small flickering flames on the ground | flames flicker; seamless |
| `fx_level_up.png` | once | golden upward light column with sparkles and rising rings (for upgrade screen) | standard once burst upward |

---

## C. Bảng kiểm tra trước khi commit

- [ ] 7 nền trong `art/bg/` đúng 1920×1080.
- [ ] Mọi file `fx_*.png` đúng 2048×2048, 16 khung căn giữa, không có đường kẻ lưới.
- [ ] Mọi hiệu ứng có nền trong suốt thật (alpha), không phải ô caro giả, không còn sót màu phông.
- [ ] Hiệu ứng *once*: khung 16 gần như trong suốt. Hiệu ứng *loop*: khung 16 nối mượt về khung 1.
- [ ] `python tools/check_assets.py` in `OK` cho mọi file.

Sau khi Codex commit, Claude sẽ nối từng spritesheet vào từng kỹ năng, chỉnh thời điểm và vị trí cho khớp với hoạt ảnh lao tới/đánh trúng.
