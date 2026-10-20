"""Ghép các khung rời thành spritesheet.

Dùng:  python tools/pack_sheet.py fx_rasengan
Đọc:   art/frames/fx_rasengan/01.png ... 16.png (mọi định dạng ảnh PIL đọc được)
Ghi:   game/public/fx/fx_rasengan.png  (lưới theo manifest, mặc định 4x4, mỗi ô 512x512)

Mỗi khung được thu vào ô 512x512 (giữ tỉ lệ, căn giữa) trên nền đen.
Nếu khung có nền trong suốt, phần trong suốt được đổ đen để hợp với chế độ hoà trộn additive.
"""
import json
import sys
from pathlib import Path

# Console Windows mặc định không in được tiếng Việt
sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FX_DIR = ROOT / "game" / "public" / "fx"
FRAMES_DIR = ROOT / "art" / "frames"
CELL = 512


def pack(name: str) -> Path:
    manifest = json.loads((FX_DIR / "manifest.json").read_text(encoding="utf-8"))
    meta = manifest["fx"].get(name, {"cols": 4, "rows": 4, "frames": 16})
    cols, rows, count = meta["cols"], meta["rows"], meta["frames"]
    src = FRAMES_DIR / name
    files = sorted(p for p in src.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
    if len(files) != count:
        sys.exit(f"{name}: cần {count} khung trong {src}, đang có {len(files)}")
    sheet = Image.new("RGB", (cols * CELL, rows * CELL), (0, 0, 0))
    for i, f in enumerate(files):
        im = Image.open(f).convert("RGBA")
        bg = Image.new("RGBA", im.size, (0, 0, 0, 255))
        im = Image.alpha_composite(bg, im).convert("RGB")
        im.thumbnail((CELL, CELL), Image.LANCZOS)
        x = (i % cols) * CELL + (CELL - im.width) // 2
        y = (i // cols) * CELL + (CELL - im.height) // 2
        sheet.paste(im, (x, y))
    out = FX_DIR / f"{name}.png"
    sheet.save(out, optimize=True)
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Dùng: python tools/pack_sheet.py <tên_hiệu_ứng> [tên khác ...]  (hoặc --all)")
    names = [p.name for p in FRAMES_DIR.iterdir() if p.is_dir()] if sys.argv[1] == "--all" else sys.argv[1:]
    for n in names:
        print("Đã ghép", pack(n).relative_to(ROOT))
