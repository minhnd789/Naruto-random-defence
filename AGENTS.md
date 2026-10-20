# Hướng dẫn cho agent (Codex, Claude…)

Webgame "Ninja Đấu Trường": `game/` (React + PixiJS), `server/` (Fastify + PostgreSQL/PGlite). Xem `README.md`.

## Ảnh tư thế nhân vật

Theo **`docs/POSE_BRIEF.md`**: 4 tư thế (dash, attack, cast, hit) mỗi ninja, lưu `art/poses/<hero_id>/<pose>.png`. Sau khi vẽ: `python tools/normalize_poses.py <hero_id>` (căn khung) → `python tools/check_assets.py --poses` → `python tools/build_assets.py`, commit cả bản WebP trong `game/public/poses/`. Không sửa code.

Đã có đủ 20/20 ninja. Ninja mới thêm vào game cần 4 tư thế theo cùng brief.

## Việc hiện tại: icon trang bị

Theo **`docs/GEAR_BRIEF.md`**: 44 icon (31 trang bị thường + 13 pháp khí/thần khí), lưu `art/gear/<id>.png` (1024×1024, nền trong suốt). Sau khi vẽ: `python tools/check_assets.py --gear` → `python tools/build_assets.py`, commit `art/gear/` và `game/public/gear/`. Không sửa code. Danh sách id lấy từ `GEAR_VARIANTS` trong `game/src/engine/gear.ts`.

## Đã xong

- Ảnh nền và spritesheet hiệu ứng: `docs/ART_BRIEF.md` → `art/bg/`, `art/fx/` (bản game trong `game/public/bg`, `game/public/fx`).

## Ảnh: quy trình chung

- Ảnh gốc PNG đặt trong `art/`. Game chỉ dùng bản WebP do `python tools/build_assets.py` tạo trong `game/public/`.
- Kiểm tra trước khi commit: `python tools/check_assets.py` (nền + hiệu ứng), `--poses` (tư thế), `--gear` (icon trang bị).

## Lệnh kiểm tra (khi có sửa code)

```bash
npm --prefix server install && npm --prefix server test
npm --prefix game install && npm --prefix game run build
```
