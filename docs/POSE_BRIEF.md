# Brief ảnh tư thế nhân vật (đợt thử: 4 ninja)

> **Instructions for Codex (agent):**
> 1. For each ninja in the table below, create the 4 pose images listed in section B, using the ninja's **reference image** as the identity source (same face, hair, outfit, colors, accessories, art style). Prefer your image tool's *edit / reference image* mode: give it the reference PNG and ask for the new pose.
> 2. Every pose image: **PNG 1024×1536 (portrait), real transparent background (alpha), full body, no text, no effects, no shadow on the ground, no other characters.**
> 3. **Framing is strict** (the game aligns poses by these rules, see section A):
>    - The character **faces and attacks toward the RIGHT** side of the image.
>    - Feet (the foot carrying the weight) stand on the line at **96% of the image height** (y ≈ 1475 px). Nothing below that line except a few pixels of sandal.
>    - The body's center of gravity is at the **horizontal center** (x ≈ 512 px).
>    - Scale: if the character stood upright, head-to-feet would be **~80% of the image height** (≈ 1230 px). Keep this scale in every pose, even when crouching or lunging (a crouching pose is simply shorter).
> 4. Save to `art/poses/<hero_id>/<pose>.png` (e.g. `art/poses/naruto_sage/attack.png`). Lower-case ids exactly as in the table.
> 5. Run `python tools/check_assets.py --poses`. Every file must print `OK`. Then run `python tools/build_assets.py` to produce the game versions.
> 6. If the image tool refuses a character (copyright policy), skip it, and list it in the commit body with the refusal reason. Do not substitute a different-looking character.
> 7. Do **not** modify game source code. Commit with message `Thêm ảnh tư thế (đợt thử 4 ninja)`.

Mục tiêu: trong trận, nhân vật đổi sang ảnh tư thế đúng lúc (lao tới → ra đòn → về thế đứng; tụ chiêu; trúng đòn), thay vì chỉ dùng một ảnh đứng yên. Ninja nào chưa có ảnh tư thế thì game tự nghiêng/nhún ảnh gốc, nên có thể làm dần.

## A. Khung hình chuẩn

```
 1024 px
┌──────────┐ 0
│          │
│   đầu    │  ← khi đứng thẳng, đầu ở khoảng 16% chiều cao
│   /|\    │
│   / \  → │  mặt và đòn đánh hướng sang PHẢI
│__________│ 96% ← chân chạm vạch này (y ≈ 1475)
└──────────┘ 1536
      ↑ trọng tâm ở giữa (x ≈ 512)
```

Game đặt điểm (512, 1475) của mọi ảnh tư thế trùng với vị trí chân nhân vật, và dùng cùng một tỉ lệ phóng cho mọi tư thế. Nhờ vậy đổi tư thế không bị nhảy vị trí hay đổi kích thước.

## B. Bốn tư thế cần vẽ

| File | Dùng khi | Mô tả (prompt) |
|---|---|---|
| `dash.png` | đang lao tới mục tiêu | running ninja dash pose toward the right, body leaning strongly forward, one leg extended back, arms trailing behind (ninja run), hair and clothes blown backward by speed |
| `attack.png` | lúc đánh trúng | dynamic strike pose toward the right at the moment of impact, front arm fully extended forward (punch / palm strike / weapon slash depending on the character), back leg pushing off, intense expression |
| `cast.png` | tụ chiêu, bắn vật bay, đòn diện rộng | ninja casting a jutsu, standing firm in a wide stance facing right, both hands forming a hand seal in front of the chest or one hand thrust forward releasing chakra, focused expression |
| `hit.png` | bị đánh trúng, gục ngã | recoiling from a heavy hit coming from the right, upper body bent backward and to the left, one arm raised in defense, eyes squeezed, feet sliding back |

Thêm vào cuối mỗi prompt:
`same character as the reference image (identical face, hair, outfit, colors and art style), full body, anime cel-shaded game character art, transparent background, 1024x1536 portrait, feet on a line at 96% height, centered, no ground shadow, no text, no effects`

## C. Đợt thử: 4 ninja

| hero_id | Ninja | Ảnh tham chiếu | Ghi chú tư thế riêng |
|---|---|---|---|
| `naruto_sage` | Naruto (Tiên Nhân) | `game/public/heroes/Naruto_Sage_Mode.webp` | attack: đẩy Rasengan bằng tay phải về phía trước. cast: chắp ấn ảnh phân thân (hai ngón trỏ và giữa bắt chéo). Áo choàng Tiên Nhân đỏ có hoạ tiết lửa đen phải giữ nguyên. |
| `sasuke_ems` | Sasuke (Vĩnh Hằng Mangekyou) | `game/public/heroes/Sasuke_EMS.webp` | attack: chém kiếm Kusanagi ngang về bên phải. cast: tay trái đưa ra trước, tay phải giữ kiếm phía sau. Giữ dây thừng tím ở hông. |
| `gaara` | Gaara | `game/public/heroes/Gaara.webp` | Gaara gần như không di chuyển: dash là trượt nhẹ trên cát (đứng thẳng, nghiêng nhẹ). attack: một tay đưa ra điều khiển cát. cast: hai tay giơ ra trước. Bầu cát sau lưng phải giữ nguyên. |
| `sakura` | Sakura | `game/public/heroes/Sakura.webp` | attack: đấm thẳng bằng nắm đấm phải (găng tay đen). cast: hai tay úp vào nhau phát sáng y thuật xanh lục nhạt (chỉ là tay đặt đúng tư thế, không vẽ hiệu ứng). |

Ảnh gốc độ phân giải cao hơn nằm trong thư mục `Character/` nếu cần tham chiếu chi tiết.

## D. Bảng kiểm tra trước khi commit

- [ ] 16 file trong `art/poses/<hero_id>/{dash,attack,cast,hit}.png`.
- [ ] Mỗi file 1024×1536, nền trong suốt thật, nhân vật quay sang phải.
- [ ] Chân chạm vạch 96% và trọng tâm ở giữa ảnh.
- [ ] Cùng tỉ lệ với nhau: đặt 4 ảnh chồng lên nhau thì kích thước đầu gần bằng nhau.
- [ ] `python tools/check_assets.py --poses` in `OK` cho mọi file.
