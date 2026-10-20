# Brief ảnh tư thế nhân vật (20 ninja)

> **Instructions for Codex (agent):**
> 1. For each ninja in sections C (done) and **C2 (batch 2, still to draw)**, create the 4 pose images listed in section B, using the ninja's **reference image** as the identity source (same face, hair, outfit, colors, accessories, art style). Prefer your image tool's *edit / reference image* mode: give it the reference PNG and ask for the new pose.
> 2. Every pose image: **PNG 1024×1536 (portrait), real transparent background (alpha), full body, no text, no effects, no shadow on the ground, no other characters.**
> 3. **Framing is strict** (the game aligns poses by these rules, see section A):
>    - The character **faces and attacks toward the RIGHT** side of the image.
>    - Feet (the foot carrying the weight) stand on the line at **96% of the image height** (y ≈ 1475 px). Nothing below that line except a few pixels of sandal.
>    - The body's center of gravity is at the **horizontal center** (x ≈ 512 px).
>    - Scale: if the character stood upright, head-to-feet would be **~80% of the image height** (≈ 1230 px). Keep this scale in every pose, even when crouching or lunging (a crouching pose is simply shorter).
> 4. Save to `art/poses/<hero_id>/<pose>.png` (e.g. `art/poses/naruto_sage/attack.png`). Lower-case ids exactly as in the table.
> 5. Image tools usually draw the character too big and with feet at varying heights. Run `python tools/normalize_poses.py <hero_id>` to fix framing automatically (one shared scale per hero, feet on the 96% line, centered on the feet; originals are backed up in `art/poses_raw/`). If a hero still looks bigger/smaller than its reference in game, rerun with `--scale <hero_id>=0.95` (or 1.05).
> 5b. Run `python tools/check_assets.py --poses`. Every file must print `OK`. Then run `python tools/build_assets.py` to produce the game versions.
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

## C2. Đợt 2: 16 ninja còn lại

Cùng quy tắc khung hình (mục A) và 4 tư thế (mục B) như đợt thử. Ảnh tham chiếu nằm trong `game/public/heroes/`. Ghi chú bên dưới bám theo kỹ năng của từng ninja trong game, và liệt kê các chi tiết nhận diện **bắt buộc giữ nguyên**.

**Lưu ý chung:**
- Không vẽ hiệu ứng như sét, lửa, nước, côn trùng hay quạ, vì game tự thêm hiệu ứng spritesheet. Chỉ vẽ tay và tư thế đúng chỗ phát chiêu.
- Ảnh tham chiếu nào có sẵn hiệu ứng (ví dụ Kakashi có tia sét) thì bỏ hiệu ứng đi, chỉ lấy nhân vật.
- Vũ khí và vật mang theo (kiếm, quạt, cuộn giấy, chó Akamaru) phải nằm trọn trong khung, không bị cắt.

### Akatsuki và Hokage (5★ / 4★)

| hero_id | Ninja | Ảnh tham chiếu | Ghi chú tư thế | Giữ nguyên |
|---|---|---|---|---|
| `itachi` | Itachi | `Itachi.webp` | **attack:** tay phải ném phi tiêu về phía phải. **cast:** chắp ấn hoả độn trước miệng. **dash:** áo choàng tung về sau. | Áo choàng đen mây đỏ Akatsuki, mắt Sharingan đỏ, nếp nhăn dưới mắt, băng trán gạch ngang, nhẫn |
| `kakashi` | Kakashi | `Kakashi.webp` | **attack:** đâm tay phải về trước như Lôi Thiết (bàn tay mở, không vẽ sét). **cast:** tay trái kéo băng trán lộ mắt Sharingan, tay phải kết ấn. | Tóc bạc dựng, khẩu trang che nửa mặt, áo giáp jounin xanh lá, băng trán lệch che mắt trái |
| `minato` | Minato | `Minato.webp` | **dash:** lướt rất thấp, gần như song song mặt đất. **attack:** chém kunai ba mũi bằng tay phải. **cast:** ném kunai ba mũi về phía phải. | Áo choàng trắng viền ngọn lửa đỏ, tóc vàng nhọn, kunai ba mũi |
| `tsunade` | Tsunade | `Tsunade.webp` | **attack:** đấm thẳng nắm tay phải, chân trước đạp mạnh. **cast:** hai bàn tay úp về trước như truyền y thuật. **hit:** vẫn đứng vững, chỉ ngả nhẹ. | Áo khoác xanh lá chữ "đánh bạc" sau lưng, tóc vàng buộc hai đuôi thấp, dấu kim cương trên trán |
| `kisame` | Kisame | `Kisame.webp` | **attack:** vung kiếm Samehada quấn băng chém ngang về phải. **cast:** kiếm cắm xuống đất, tay kết ấn thuỷ độn. **dash:** kiếm vác trên vai. | Da xanh, mang cá trên má, răng nhọn, áo Akatsuki, kiếm Samehada quấn băng |
| `hinata` | Hinata | `Hinata.webp` | **attack:** đẩy lòng bàn tay phải về trước (Nhu Quyền), tay trái thu sau hông. **cast:** thế Bát Quái, hai tay dang ngang lòng bàn tay mở, chân trụ thấp. | Mắt Byakugan trắng, áo khoác tím nhạt và trắng, tóc đen dài |
| `madara` | Madara | `Madara.webp` | **attack:** vung quạt Gunbai to bằng tay phải. **cast:** một tay giơ thẳng lên trời gọi thiên thạch, tay kia chống hông. **hit:** tóc dài tung về trước. | Giáp đỏ samurai, tóc đen rất dài bù xù, quạt Gunbai |
| `pain` | Pain | `Pain.webp` | **attack:** một tay đưa thẳng ra trước, lòng bàn tay mở (Thần La Thiên Chinh). **cast:** hai tay dang ngang, đứng thẳng uy nghiêm. **dash:** bước đi bình thản, không chạy. | Tóc cam dựng, khuyên đen trên mặt, mắt Rinnegan tím hoa văn vòng, áo Akatsuki |

### Thế hệ trẻ (3★)

| hero_id | Ninja | Ảnh tham chiếu | Ghi chú tư thế | Giữ nguyên |
|---|---|---|---|---|
| `tenten` | Tenten | `Tenten.webp` | **attack:** ném ba kunai cùng lúc về phải. **cast:** mở cuộn giấy lớn triệu hồi vũ khí, cuộn giấy uốn quanh người. | Hai búi tóc, áo trắng cổ Trung Hoa, quần đỏ nâu, cuộn giấy lớn |
| `kiba` | Kiba | `Kiba.webp` | **attack:** cào móng tay về trước, khom người như sói. **cast:** khom thấp gần bốn chân, chuẩn bị xoay Nha Thông Nha. **dash:** chạy khom người như thú. | Vết đỏ hình răng nanh trên má, áo khoác xám có lông. Chó trắng Akamaru đi cùng, nằm trong khung |
| `shino` | Shino | `Shino.webp` | **attack:** một tay đưa ra trước, ngón tay xoè (gọi côn trùng, không vẽ côn trùng). **cast:** hai tay đưa ra trước, đứng thẳng. **hit:** gần như không biểu cảm. | Áo khoác cao cổ che nửa mặt, kính đen tròn, mũ trùm |
| `choji` | Choji | `Choji.webp` | **attack:** đấm nắm tay phải phình to (chỉ phóng to cánh tay, người giữ nguyên cỡ). **cast:** chắp ấn Bội Hoá, chân dạng rộng. **dash:** lăn người (cuộn tròn nghiêng). | Tóc nâu dựng, vòng xoáy đỏ trên má, giáp đỏ, khăn trắng |
| `shikamaru` | Shikamaru | `Shikamaru.webp` | **cast:** chắp ấn hình chuột ngang ngực (Ảnh Mô Phỏng). **attack:** ném kunai về phải. **dash:** chạy hai tay sau lưng kiểu ninja. | Tóc buộc đuôi nhọn trên đỉnh đầu, áo giáp chunin xanh lá, vẻ mặt uể oải |
| `lee` | Rock Lee | `Lee.webp` | **attack:** đá xoay ngang bằng chân phải (Mộc Diệp Toàn Phong), chân cao ngang đầu. **cast:** thế võ, một tay sau lưng một tay đưa trước lòng bàn tay ngửa. **dash:** chạy rất nhanh, người đổ về trước. | Tóc bát úp đen bóng, lông mày rậm, đồ bó xanh lá, áo giáp chunin, băng tay cam |
| `ino` | Ino | `Ino.webp` | **attack:** ném phi tiêu về phải. **cast:** hai tay tạo hình khung tròn hướng về phải (Tâm Chuyển Thân Thuật). | Tóc vàng dài buộc đuôi, mái che một mắt, áo tím |
| `temari` | Temari | `Temari.webp` | **attack:** vung quạt lớn đã mở chém ngang về phải. **cast:** dựng quạt mở to phía sau người. **dash:** quạt gập vác trên vai. | Bốn búi tóc vàng, quạt sắt lớn ba vòng tròn tím, áo tím đen |

## D. Bảng kiểm tra trước khi commit

> Kết quả đợt thử (4 ninja): nhân vật giữ đúng nhận diện ở mọi tư thế. Khung hình ban đầu lệch (to kín khung, chân từ 87% đến 99%); `tools/normalize_poses.py` đã tự căn lại, không cần vẽ lại.


- [ ] Mỗi ninja đủ 4 file `art/poses/<hero_id>/{dash,attack,cast,hit}.png` (đợt 2: 64 file cho 16 ninja).
- [ ] Mỗi file 1024×1536, nền trong suốt thật, nhân vật quay sang phải.
- [ ] Chân chạm vạch 96% và trọng tâm ở giữa ảnh.
- [ ] Cùng tỉ lệ với nhau: đặt 4 ảnh chồng lên nhau thì kích thước đầu gần bằng nhau.
- [ ] `python tools/check_assets.py --poses` in `OK` cho mọi file.
