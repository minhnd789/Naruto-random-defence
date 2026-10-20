# Ninja Đấu Trường

Webgame xếp đội hình kiểu Epic Seven: chiến đấu theo thanh hành động, gacha thường và gacha cao cấp.

| Thư mục | Nội dung |
|---|---|
| `game/` | Frontend: React + PixiJS. Chứa luôn engine chiến đấu dùng chung ở `game/src/engine`. |
| `server/` | Backend: Node, Fastify, PostgreSQL. Lo tài khoản, ví, kho ninja, gacha và đội hình. |
| `Character/` | Ảnh gốc của các nhân vật. |

## Chạy (2 terminal)

```bash
npm --prefix server install
npm --prefix server run dev
```

```bash
npm --prefix game install
npm --prefix game run dev
```

Sau đó mở http://localhost:5180. Vite tự chuyển các request `/api` sang server ở cổng 5181.

### Database

- **Mặc định: PGlite.** Đây là PostgreSQL biên dịch sang WASM, chạy ngay trong Node nên không cần cài gì. Dữ liệu lưu ở `server/data/pg`. Muốn reset thì xoá thư mục `server/data`.
- **PostgreSQL thật:** đặt biến `DATABASE_URL=postgres://user:pass@host:5432/db` trước khi chạy server. Server dùng cùng một bộ SQL và migration cho cả hai trường hợp.
- **Khoá ký JWT:** lấy từ biến `JWT_SECRET`. Nếu không có, server tự sinh và lưu vào `server/data/jwt-secret`.
- **Khi deploy production:** đặt `NODE_ENV=production` để tắt API dev `/api/dev/grant` (API này dùng để cộng Ngọc khi test).

### Kiểm thử

```bash
npm --prefix server test
npm --prefix game run sim
```

- `npm --prefix server test` chạy 16 test: gacha, bảo hiểm và các API.
- `npm --prefix game run sim` mô phỏng 2000 trận để kiểm tra cân bằng tướng.

## Gacha

| Banner | Tiền tệ | 5★ | 4★ | 3★ | Bảo hiểm |
|---|---|---|---|---|---|
| Triệu Hồi Thường | 1 Cuộn / lượt | 1% | 14% | 85% | Không |
| Triệu Hồi Cấm Thuật | 100 Ngọc / lượt | 1,25% (50% là Madara) | 13,75% | 85% | Lượt thứ 120 không có 5★ chắc chắn ra Madara |

- Mỗi lượt x10 chắc chắn có ít nhất một tướng 4★.
- Ra tướng 5★ bất kỳ thì bộ đếm bảo hiểm về 0.
- Kết quả quay được tính hoàn toàn trên server bằng RNG an toàn mật mã.
- Mỗi lần quay chạy trong một transaction có khoá dòng của người chơi, nên không thể quay âm tiền hay quay trùng lặp.
- Ra tướng đã có thì được cộng 1 "mảnh linh hồn". Mảnh sẽ dùng để nâng sao ở giai đoạn sau.

## Tiến trình ninja

| Hệ thống | Cách hoạt động |
|---|---|
| Cấp độ | Dùng Cuộn Kinh Nghiệm (+1.000 EXP/cuốn, 300 Xu/cuốn). Cấp tối đa = số sao × 10. Máu và công tăng 3%/cấp, thủ tăng chậm. |
| Nâng sao | Cần đạt cấp tối đa. Dùng mảnh linh hồn của ninja (từ tướng trùng) trước, phần thiếu bù bằng Linh Hồn Thạch. Mỗi sao +10% chỉ số, tối đa 6★. |
| Thức tỉnh | 3 bậc, yêu cầu Lv 15/25/35 và Ấn Chú cùng hệ (4/10/20). Mỗi bậc +6% chỉ số, +2 tốc độ. Bậc 3 thêm +5% chí mạng. |

Toàn bộ công thức nằm ở `game/src/engine/progression.ts`, dùng chung cho client và server.

## Vượt ải và bí cảnh

- **Vượt Ải:** 4 chương × 6 ải, ải cuối mỗi chương là trùm. Phải qua ải trước mới mở ải sau. Lần đầu qua ải thưởng Ngọc (trùm thưởng thêm sách và Linh Hồn Thạch).
- **Bí Cảnh:** mỗi bí cảnh có 5 bậc, phải qua bậc trước mới mở bậc sau.
  - Rừng Tử Thần: rơi Cuộn Kinh Nghiệm.
  - Đền Ấn Chú: chọn hệ, rơi Ấn Chú của hệ đó.
  - Đền Linh Hồn: rơi Linh Hồn Thạch.
- **Thể lực:** tối đa 100, hồi 1 điểm mỗi 3 phút. Quà hằng ngày cộng thêm 50.

## Trận đấu xác thực trên server

1. Client gọi `POST /api/battle/start`. Server kiểm tra ải đã mở khóa, trừ thể lực, chụp lại chỉ số thật của đội và tạo một **seed** ngẫu nhiên.
2. Client đánh trận bằng đúng seed và đội hình đó, ghi lại mọi lựa chọn kỹ năng và mục tiêu của đội mình.
3. Client gửi nhật ký qua `POST /api/battle/finish`. Server chạy lại toàn bộ trận bằng cùng engine (`game/src/engine/replay.ts`) và chỉ trao thưởng nếu kết quả chạy lại là thắng.

Cách này chặn được:
- sửa chỉ số hoặc kết quả ở client;
- dùng kỹ năng chưa hồi;
- dùng nhật ký của trận khác;
- gửi lại kết quả để nhận thưởng hai lần;
- trận quá hạn (2 giờ).

Phần drop ngẫu nhiên do server tự tính, client không đoán trước được.

## Đấu trường thường

- **Mùa giải:** mỗi mùa kéo dài 1 tuần, bắt đầu thứ Hai (giờ UTC). Sang mùa mới, chênh lệch điểm so với mốc 1000 được giữ lại một nửa.
- **Vé:** mỗi trận tốn 1 vé. Tối đa 5 vé, hồi 1 vé mỗi 30 phút.
- **Đối thủ:** danh sách 3 đối thủ gồm người chơi thật có điểm gần bạn (chênh không quá 300). Khi chưa đủ người, server bổ sung bot mạnh xấp xỉ đội của bạn. Mỗi đối thủ chỉ đánh được một lần cho tới khi làm mới danh sách.
- **Điểm Elo (K = 32):** người tấn công nhận trọn mức thay đổi, người phòng thủ thật nhận một nửa, theo chiều ngược lại.
- **Bỏ trận giữa chừng:** tính là thua.
- **Phần thưởng:**
  - Thắng: 1.500 Xu + 10 Ngọc. Thua: 300 Xu.
  - Cuối mùa thưởng theo bậc: Đồng, Bạc, Vàng, Bạch Kim, Kim Cương, Huyền Thoại.

## RTA realtime

Kết nối WebSocket qua `/api/rta/ws?token=…`. Thứ tự một trận:

1. **Ghép trận:** ghép hai người có điểm gần nhau. Khoảng điểm chấp nhận nới rộng 20 điểm cho mỗi giây chờ. Chế độ **Đấu với Bot** không tính điểm.
2. **Cấm trước:** hai bên cùng lúc cấm 1 ninja, không bên nào thấy lựa chọn của đối thủ trước khi cả hai chọn xong. Ninja bị cấm thì cả hai bên đều không được chọn.
3. **Chọn:** theo thứ tự rắn A1 · B1 B2 · A2 A3 · B3 B4 · A4 A5 · B5.
4. **Cấm sau:** mỗi bên loại 1 ninja của đối thủ, còn lại 4 đấu 4.
5. **Giao chiến:** server giữ trận đấu thật. Mỗi lượt có 30 giây, hết giờ máy tự đánh. Client nhận seed, đội hình và chuỗi hành động, rồi phát lại bằng cùng engine.
   - Người chơi mất kết nối thì máy đánh thay ngay.
   - Kết nối lại sẽ được gửi lại toàn bộ diễn biến trận.
6. **Kết quả:** Elo cập nhật cho cả hai người. Mọi trận được lưu vào bảng `rta_matches` (seed, lượt cấm/chọn, đội hình) để xem lại sau.

Cần sở hữu ít nhất 6 ninja mới vào được RTA.

## Ảnh nền và hiệu ứng kỹ năng

- **Ảnh gốc:** nằm trong `art/`. Gồm `art/bg/*.png` (1920×1080) và `art/fx/*.png` (spritesheet 2048×2048, lưới 4×4). Cách tạo ảnh xem [docs/ART_BRIEF.md](docs/ART_BRIEF.md).
- **Bản dùng trong game:** WebP nhẹ, nằm ở `game/public/fx` và `game/public/bg`. Tạo bằng lệnh `python tools/build_assets.py`, chỉ build lại file nào ảnh gốc có thay đổi. Dung lượng giảm từ 119 MB xuống 17 MB.
- **Kiểm tra ảnh gốc:** `python tools/check_assets.py`.
- **Biên đạo kỹ năng:** khai báo trong `game/src/battle/skillFx.ts`. Mỗi skill gồm các phần tụ chiêu, cầm trên tay khi lao tới, cách di chuyển (lao tới / đứng / dịch chuyển), vật bay (từ người hoặc từ trời), vụ nổ lớn kèm khung trúng đòn, hiệu ứng trúng, và hiệu ứng lên đồng đội. Skill nào không khai báo thì lấy hiệu ứng theo hệ.
- **Bối cảnh theo chế độ chơi:**

  | Chế độ | Bối cảnh |
  |---|---|
  | Chương 1 | Làng Lá |
  | Chương 2 | Rừng Tử Thần |
  | Chương 3 | Làng Mưa |
  | Chương 4 | Thung Lũng Tận Cùng |
  | Bí cảnh | Rừng / Sa mạc / Thung lũng |
  | Đấu trường | Đấu trường |
  | RTA | RTA |

  Mỗi bối cảnh có hiệu ứng môi trường riêng: cánh hoa, đom đóm, mưa, sương, cát, tàn lửa, ánh sao.

## Trang bị

8 ô: Vũ khí (Công), Mũ (Máu), Áo (Thủ), Quần (Máu %), Găng tay (Chí mạng %), Giày (Tốc độ), Băng đô (Công %), Pháp khí (Công % + Máu %, hiếm hơn).

| Phẩm chất | Màu | Chỉ số phụ | Hệ số chỉ số chính |
|---|---|---|---|
| Thường | xám | 0 | ×1 |
| Tinh Anh | xanh lá | 1 | ×1,15 |
| Hiếm | xanh dương | 2 | ×1,3 |
| Sử Thi | vàng | 3 | ×1,5 |
| Huyền Thoại | đỏ | 4 | ×1,75 |
| Thần Thoại | cầu vồng | 4 (luôn ở nửa trên) | ×2,1 |

- **Rơi đồ khi thắng:**
  - Ải: 60% có đồ, trùm chắc chắn rơi và dễ ra phẩm chất cao hơn.
  - Bí cảnh: 40% có đồ.
  - Cấp đồ bằng cấp ải.
- **Tài khoản mới:** nhận sẵn 4 món Tinh Anh.
- **Phân giải:** đồ chưa mặc đổi ra Xu.
- **Xác thực:** chỉ số trang bị được server chụp lại lúc vào trận (ải, bí cảnh, đấu trường, RTA), nên trận vẫn xác thực được.
- **Code:** công thức trong `game/src/engine/gear.ts`, server trong `server/src/gear.ts`.

## Điểm nộ

- Mỗi ninja có 3 ô nộ. Vào trận bắt đầu ở 0 nộ.
- Mỗi lượt dùng đòn thường hoặc kỹ năng 2 thì +1 nộ.
- Tuyệt kỹ tốn 1 nộ, nên không dùng được ngay ở lượt đầu.
