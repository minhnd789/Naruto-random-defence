# Hướng dẫn cho agent (Codex, Claude…)

Webgame "Ninja Đấu Trường": `game/` (React + PixiJS), `server/` (Fastify + PostgreSQL/PGlite). Xem `README.md`.

## Việc đang cần: tạo ảnh

Đọc và làm theo **`docs/ART_BRIEF.md`**: tạo ảnh nền vào `art/bg/` và spritesheet hiệu ứng vào `art/fx/` (ảnh gốc PNG; game dùng bản WebP do `python tools/build_assets.py` tạo ra), đúng tên file trong brief. Không sửa code.

## Lệnh kiểm tra (khi có sửa code)

```bash
npm --prefix server install && npm --prefix server test
npm --prefix game install && npm --prefix game run build
```
