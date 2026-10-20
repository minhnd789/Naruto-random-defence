"""Kiểm tra ảnh nền và spritesheet trước khi commit.

Dùng: python tools/check_assets.py
Kiểm tra:
  - bg_*.png: đúng 1920x1080.
  - fx_*.png: đúng kích thước lưới theo manifest (mặc định 2048x2048, 4x4 ô 512).
  - Nền đen: viền ngoài mỗi ô gần như đen (hiệu ứng không tràn sang ô bên cạnh).
  - Hiệu ứng "once": khung cuối tối hơn rõ rệt so với khung sáng nhất.
  - Hiệu ứng "loop": khung cuối gần giống khung đầu (nối mượt).
In OK / LỖI cho từng file, và danh sách file còn thiếu so với manifest.
"""
import json
import sys
from pathlib import Path

# Console Windows mặc định không in được tiếng Việt
sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent.parent
FX = ROOT / "game" / "public" / "fx"
BG = ROOT / "game" / "public" / "bg"
CELL = 512
BACKGROUNDS = ["bg_konoha", "bg_forest", "bg_rain", "bg_valley", "bg_desert", "bg_arena", "bg_rta"]


def brightness(im: Image.Image) -> float:
    return ImageStat.Stat(im.convert("L")).mean[0]


def check_fx(path: Path, meta: dict) -> list[str]:
    errs = []
    im = Image.open(path).convert("RGB")
    cols, rows, count = meta["cols"], meta["rows"], meta["frames"]
    if im.size != (cols * CELL, rows * CELL):
        return [f"kích thước {im.size}, cần {(cols * CELL, rows * CELL)}"]
    cells = [im.crop(((i % cols) * CELL, (i // cols) * CELL, (i % cols + 1) * CELL, (i // cols + 1) * CELL)) for i in range(count)]
    # Viền 6px quanh mỗi ô phải gần đen
    for i, c in enumerate(cells):
        edge = max(
            brightness(c.crop((0, 0, CELL, 6))),
            brightness(c.crop((0, CELL - 6, CELL, CELL))),
            brightness(c.crop((0, 0, 6, CELL))),
            brightness(c.crop((CELL - 6, 0, CELL, CELL))),
        )
        if edge > 18:
            errs.append(f"khung {i + 1}: hiệu ứng chạm/tràn mép ô (độ sáng viền {edge:.0f})")
            break
    lum = [brightness(c) for c in cells]
    if max(lum) < 4:
        errs.append("mọi khung gần như đen, không thấy hiệu ứng")
    elif meta.get("loop"):
        diff = brightness(ImageChops.difference(cells[0], cells[-1]))
        if diff > 25:
            errs.append(f"loop không mượt: khung cuối khác khung đầu quá nhiều ({diff:.0f})")
    else:
        if lum[-1] > max(lum) * 0.5:
            errs.append(f"once: khung cuối chưa tan đủ (sáng {lum[-1]:.0f} so với đỉnh {max(lum):.0f})")
    return errs


def main() -> int:
    manifest = json.loads((FX / "manifest.json").read_text(encoding="utf-8"))["fx"]
    bad = 0
    missing = []
    for name in BACKGROUNDS:
        p = BG / f"{name}.png"
        if not p.exists():
            missing.append(str(p.relative_to(ROOT)))
            continue
        size = Image.open(p).size
        ok = size == (1920, 1080)
        bad += not ok
        print(("OK   " if ok else "LỖI ") + f"{p.name}" + ("" if ok else f": kích thước {size}, cần (1920, 1080)"))
    for name, meta in manifest.items():
        p = FX / f"{name}.png"
        if not p.exists():
            missing.append(str(p.relative_to(ROOT)))
            continue
        errs = check_fx(p, meta)
        bad += bool(errs)
        print(("OK   " if not errs else "LỖI ") + p.name + ("" if not errs else ": " + "; ".join(errs)))
    if missing:
        print(f"\nCòn thiếu {len(missing)} file:")
        for m in missing:
            print("  -", m)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
