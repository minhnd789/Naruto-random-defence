# Ninja Đấu Trường: prototype chiến đấu (giai đoạn 1)

Prototype offline: chiến đấu theo thanh hành động (giống Epic Seven), 12 tướng, đội 5 người, có cut-in tuyệt kỹ.

## Chạy

```bash
npm install
npm run dev      # http://localhost:5180
npm run sim      # mô phỏng 2000 trận AI vs AI, in tỉ lệ thắng từng tướng
npm run build
```

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/engine/` | Engine chiến đấu viết bằng TypeScript thuần, không phụ thuộc giao diện. RNG có seed nên cùng seed và cùng lựa chọn sẽ cho cùng kết quả. Server sau này có thể dùng lại nguyên engine này để chống gian lận. |
| `src/engine/heroes.ts` | Dữ liệu tướng: chỉ số, hệ, kỹ năng. Muốn thêm tướng chỉ cần thêm dữ liệu vào đây. |
| `src/battle/` | Cảnh PixiJS (`BattleScene`), tween, hình nền vẽ bằng canvas, và `BattleController` nối engine với giao diện. |
| `src/ui/` | Giao diện React: chọn đội hình, HUD trận đấu, màn kết quả. |
| `public/heroes/` | Ảnh tướng đã cắt viền và thu nhỏ từ `../Character`. |

## Luật chiến đấu

- **Thanh hành động:** mỗi tướng nạp thanh theo Tốc độ, ai đầy 100% trước thì được đánh. Kỹ năng có thể đẩy thanh của đồng đội lên hoặc kéo thanh của địch xuống.
- **Khắc hệ:** Hỏa > Phong > Lôi > Thổ > Thủy > Hỏa, còn Âm và Dương khắc nhau.
  - Đánh vào hệ bị mình khắc: +30% sát thương và +15% tỉ lệ chí mạng.
  - Đánh vào hệ khắc mình: −15% sát thương và 15% khả năng trượt.
- **Hàng trước / hàng sau:** đòn đánh đơn phải nhắm hàng trước khi hàng trước còn người. Đòn diện rộng đánh trúng tất cả.
- **Bạo Nộ:** từ lượt 60 trở đi, sát thương tăng thêm 5% mỗi lượt để trận nào cũng kết thúc.
