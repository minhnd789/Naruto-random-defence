"""Căn khung ảnh tư thế về chuẩn của brief (chân ở vạch 96%, cao đứng thẳng 80%, căn giữa theo bàn chân).

Dùng: python tools/normalize_poses.py [hero_id ...] [--scale hero_id=1.05 ...]

Trình tạo ảnh thường vẽ nhân vật to kín khung và đặt chân lệch. Các tư thế của cùng một ninja
thường cùng tỉ lệ với nhau, nên script dùng MỘT hệ số thu phóng chung cho cả 4 tư thế:
  - Ước lượng chiều cao đứng thẳng = chiều cao của tư thế "thẳng" nhất / UPRIGHT_RATIO.
  - Thu phóng để chiều cao đứng thẳng = 80% khung; --scale để chỉnh tay nếu cần.
  - Dời từng ảnh: điểm thấp nhất chạm vạch 96%, tâm vùng bàn chân nằm giữa khung.
Ảnh gốc được sao lưu một lần vào art/poses_raw/ (chạy lại luôn đọc từ bản sao lưu, nên không bị co dần).
"""
import shutil
import sys
from pathlib import Path

# Console Windows mặc định không in được tiếng Việt
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
POSES, RAW = ROOT / "art" / "poses", ROOT / "art" / "poses_raw"
W, H = 1024, 1536
FEET, STAND = 0.96, 0.80
# Tư thế cao nhất (thường là thi triển / trúng đòn) chỉ thấp hơn dáng đứng thẳng một chút vì chân dạng
UPRIGHT_RATIO = 0.93
FOOT_BAND = 0.12  # phần dưới cùng (tỉ lệ chiều cao nhân vật) coi là vùng bàn chân


def bbox(a: np.ndarray):
    rows = np.where(a.any(axis=1))[0]
    cols = np.where(a.any(axis=0))[0]
    return rows[0], rows[-1], cols[0], cols[-1]


def normalize_hero(hero: str, manual: float = 1.0) -> None:
    src_dir, raw_dir = POSES / hero, RAW / hero
    raw_dir.mkdir(parents=True, exist_ok=True)
    for f in src_dir.glob("*.png"):
        if not (raw_dir / f.name).exists():
            shutil.copy2(f, raw_dir / f.name)
    files = sorted(raw_dir.glob("*.png"))
    if not files:
        print(f"{hero}: không có ảnh")
        return
    ims = {f.stem: Image.open(f).convert("RGBA") for f in files}
    masks = {k: np.asarray(im.getchannel("A")) > 40 for k, im in ims.items()}
    heights = {k: (lambda b: b[1] - b[0])(bbox(m)) for k, m in masks.items()}
    upright = max(heights.values()) / UPRIGHT_RATIO
    k = (STAND * H) / upright * manual
    for name, im in ims.items():
        m = masks[name]
        top, bot, left, right = bbox(m)
        # Tâm bàn chân: trung bình toạ độ x của các điểm ảnh trong vùng đáy
        band_top = int(bot - (bot - top) * FOOT_BAND)
        xs = np.nonzero(m[band_top : bot + 1])[1]
        foot_x = xs.mean() if len(xs) else (left + right) / 2
        crop = im.crop((left, top, right + 1, bot + 1))
        crop = crop.resize((max(1, round(crop.width * k)), max(1, round(crop.height * k))), Image.LANCZOS)
        x = round(W / 2 - (foot_x - left) * k)
        y = round(FEET * H - crop.height)
        # Không để nhân vật bị cắt mép: đẩy vào trong nếu cần (ưu tiên giữ chân đúng vạch)
        x = min(max(x, 6), W - 6 - crop.width) if crop.width < W - 12 else (W - crop.width) // 2
        y = max(y, 6)
        out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        out.alpha_composite(crop, (x, y))
        out.save(src_dir / f"{name}.png")
    print(f"{hero}: thu phóng ×{k:.3f} (chiều cao các tư thế {', '.join(f'{n} {h}px' for n, h in heights.items())})")


def main() -> None:
    args = sys.argv[1:]
    manual = {}
    if "--scale" in args:
        i = args.index("--scale")
        for kv in args[i + 1 :]:
            if "=" in kv:
                h, v = kv.split("=")
                manual[h] = float(v)
        args = args[:i]
    heroes = args or sorted(p.name for p in POSES.iterdir() if p.is_dir())
    for h in heroes:
        normalize_hero(h, manual.get(h, 1.0))


if __name__ == "__main__":
    main()
