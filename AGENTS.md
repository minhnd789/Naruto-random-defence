# Hướng dẫn cho agent (Codex, Claude…)

Webgame "Ninja Đấu Trường": `game/` (React + PixiJS), `server/` (Fastify + PostgreSQL/PGlite). Xem `README.md`.

## Việc đang cần: ảnh tư thế nhân vật (đợt thử 4 ninja)

Đọc và làm theo **`docs/POSE_BRIEF.md`**: vẽ 4 tư thế (dash, attack, cast, hit) cho Naruto, Sasuke, Gaara, Sakura vào `art/poses/<hero_id>/<pose>.png`. Kiểm tra bằng `python tools/check_assets.py --poses`, rồi chạy `python tools/build_assets.py` và commit cả bản WebP trong `game/public/poses/`. Không sửa code.

## Đã xong

- Ảnh nền và spritesheet hiệu ứng: `docs/ART_BRIEF.md` → `art/bg/`, `art/fx/` (bản game trong `game/public/bg`, `game/public/fx`).

## Ảnh: quy trình chung

- Ảnh gốc PNG đặt trong `art/`. Game chỉ dùng bản WebP do `python tools/build_assets.py` tạo trong `game/public/`.
- Kiểm tra trước khi commit: `python tools/check_assets.py` (nền + hiệu ứng) và `python tools/check_assets.py --poses` (tư thế).

## Lệnh kiểm tra (khi có sửa code)

```bash
npm --prefix server install && npm --prefix server test
npm --prefix game install && npm --prefix game run build
```
