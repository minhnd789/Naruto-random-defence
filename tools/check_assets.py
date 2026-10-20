"""Kiểm tra ảnh nền và spritesheet trước khi commit.

Dùng: python tools/check_assets.py
Kiểm tra:
  - bg_*.png: đúng 1920x1080.
  - fx_*.png: đúng kích thước lưới theo manifest (mặc định 2048x2048, 4x4 ô 512).
  - Mọi hiệu ứng: có kênh alpha thật, viền mỗi ô trong suốt (không tràn sang ô bên cạnh),
    không còn sót màu phông, không phải ô caro "giả trong suốt" do trình tạo ảnh vẽ vào.
  - Hiệu ứng "once": khung cuối tối hơn rõ rệt so với khung sáng nhất.
  - Hiệu ứng "loop": khung cuối gần giống khung đầu (nối mượt).
In OK / LỖI cho từng file, và danh sách file còn thiếu so với manifest.
"""
import json
import sys
from pathlib import Path

# Console Windows mặc định không in được tiếng Việt
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parent.parent
FX = ROOT / "art" / "fx"
BG = ROOT / "art" / "bg"
CELL = 512
POSES_DIR = ROOT / "art" / "poses"
POSE_NAMES = ["dash", "attack", "cast", "hit"]
POSE_SIZE = (1024, 1536)
POSE_FEET = 0.96   # chân chạm vạch này (tỉ lệ chiều cao)
POSE_STAND = 0.80  # chiều cao đứng thẳng (tỉ lệ chiều cao ảnh)
BACKGROUNDS = ["bg_konoha", "bg_forest", "bg_rain", "bg_valley", "bg_desert", "bg_arena", "bg_rta"]


def brightness(im: Image.Image) -> float:
    return ImageStat.Stat(im.convert("L")).mean[0]


def check_transparent(raw: Image.Image, meta: dict, cells_alpha: list) -> list[str]:
    errs = []
    if raw.mode not in ("RGBA", "LA") or np.asarray(raw.getchannel("A")).min() > 250:
        return ["ảnh không có nền trong suốt thật (nền đặc hoặc ô caro giả). Tạo lại với transparent background, hoặc chạy tools/pack_sheet.py --key"]
    for i, a in enumerate(cells_alpha):
        edge = max(a[:6].mean(), a[-6:].mean(), a[:, :6].mean(), a[:, -6:].mean())
        if edge > 10:
            errs.append(f"khung {i + 1}: viền ô không trong suốt (hiệu ứng tràn mép hoặc còn nền)")
            break
    rgba = np.asarray(raw.convert("RGBA")).astype(np.float32)
    key = np.array([int(meta.get("key", "#FF00FF").lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)
    visible = rgba[..., 3] > 128
    near = (np.linalg.norm(rgba[..., :3] - key, axis=-1) < 70) & visible
    if visible.any() and near.sum() / visible.sum() > 0.005:
        errs.append(f"còn sót màu phông {meta.get('key')} ({near.sum() / visible.sum():.1%} điểm ảnh hiện)")
    return errs


def check_fx(path: Path, meta: dict) -> list[str]:
    errs = []
    raw = Image.open(path)
    im = raw.convert("RGB")
    cols, rows, count = meta["cols"], meta["rows"], meta["frames"]
    if im.size != (cols * CELL, rows * CELL):
        return [f"kích thước {im.size}, cần {(cols * CELL, rows * CELL)}"]
    boxes = [((i % cols) * CELL, (i // cols) * CELL, (i % cols + 1) * CELL, (i // cols + 1) * CELL) for i in range(count)]
    alpha = raw.convert("RGBA").getchannel("A")
    cells_alpha = [np.asarray(alpha.crop(b)).astype(np.float32) for b in boxes]
    errs += check_transparent(raw, meta, cells_alpha)
    if errs and "không có nền trong suốt" in errs[0]:
        return errs
    # Độ "hiện" của mỗi khung = độ phủ alpha, dùng cho kiểm tra once/loop bên dưới
    cells = [alpha.crop(b).convert("RGB") for b in boxes]
    lum = [brightness(c) for c in cells]
    if max(lum) < 4:
        errs.append("mọi khung gần như trong suốt, không thấy hiệu ứng")
    elif meta.get("loop"):
        diff = brightness(ImageChops.difference(cells[0], cells[-1]))
        if diff > 25:
            errs.append(f"loop không mượt: khung cuối khác khung đầu quá nhiều ({diff:.0f})")
    else:
        if lum[-1] > max(lum) * 0.5:
            errs.append(f"once: khung cuối chưa tan đủ (độ phủ {lum[-1]:.0f} so với đỉnh {max(lum):.0f})")
    return errs


def check_pose(path: Path) -> list[str]:
    errs = []
    raw = Image.open(path)
    if raw.size != POSE_SIZE:
        return [f"kích thước {raw.size}, cần {POSE_SIZE}"]
    if raw.mode not in ("RGBA", "LA") or np.asarray(raw.getchannel("A")).min() > 250:
        return ["không có nền trong suốt thật (nền đặc hoặc ô caro giả)"]
    a = np.asarray(raw.convert("RGBA").getchannel("A")) > 40
    rows = np.where(a.any(axis=1))[0]
    cols = np.where(a.any(axis=0))[0]
    if not len(rows):
        return ["ảnh trống"]
    h, w = POSE_SIZE[1], POSE_SIZE[0]
    bottom = rows[-1] / h
    if not (POSE_FEET - 0.03 <= bottom <= POSE_FEET + 0.025):
        errs.append(f"chân ở {bottom:.0%} chiều cao, cần ~{POSE_FEET:.0%}")
    ys, xs = np.nonzero(a)
    cx = xs.mean() / w
    # Tư thế trúng đòn ngả người ra sau nên cho phép lệch nhiều hơn
    lim = 0.22 if path.stem == "hit" else 0.15
    if not (0.5 - lim <= cx <= 0.5 + lim):
        errs.append(f"trọng tâm lệch ngang ({cx:.0%}), cần gần 50%")
    if cols[0] < 4 or cols[-1] > w - 5 or rows[0] < 4:
        errs.append("nhân vật chạm mép ảnh (bị cắt)")
    height = (rows[-1] - rows[0]) / h
    if height > POSE_STAND + 0.12:
        errs.append(f"nhân vật quá to (cao {height:.0%} ảnh, tối đa ~{POSE_STAND + 0.1:.0%})")
    return errs


def main_poses() -> int:
    bad = 0
    if not POSES_DIR.exists():
        print("Chưa có thư mục art/poses")
        return 0
    for hero in sorted(p for p in POSES_DIR.iterdir() if p.is_dir()):
        for pose in POSE_NAMES:
            f = hero / f"{pose}.png"
            if not f.exists():
                print(f"THIẾU {hero.name}/{pose}.png")
                continue
            errs = check_pose(f)
            bad += bool(errs)
            print(("OK   " if not errs else "LỖI ") + f"{hero.name}/{pose}.png" + ("" if not errs else ": " + "; ".join(errs)))
    return 1 if bad else 0


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
    sys.exit(main_poses() if "--poses" in sys.argv else main())
