"""Ghép khung rời thành spritesheet, hoặc tách phông màu của một spritesheet có sẵn.

Dùng:
  python tools/pack_sheet.py fx_rasengan            # ghép art/frames/fx_rasengan/01..16.png
  python tools/pack_sheet.py --all                   # ghép mọi thư mục trong art/frames/
  python tools/pack_sheet.py --key fx_crows sheet.png  # tách phông màu của sheet đã vẽ sẵn thành nền trong suốt

Kết quả luôn là PNG nền trong suốt:
  - Khung đã có alpha thật → giữ nguyên.
  - Khung nền đen (cách làm cũ cho hiệu ứng phát sáng) → độ sáng đổi thành độ đục, quầng sáng giữ được độ mềm.
  - Khung trên phông màu (mặc định #FF00FF, hoặc `key` trong manifest) → tách phông, khử viền ám màu.
"""
import json
import sys
from pathlib import Path

# Console Windows mặc định không in được tiếng Việt
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FX_DIR = ROOT / "game" / "public" / "fx"
FRAMES_DIR = ROOT / "art" / "frames"
CELL = 512


def load_meta(name: str) -> dict:
    manifest = json.loads((FX_DIR / "manifest.json").read_text(encoding="utf-8"))
    meta = {"cols": 4, "rows": 4, "frames": 16, "blend": "add", "key": "#FF00FF"}
    meta.update(manifest["fx"].get(name, {}))
    return meta


def hex_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def key_out(im: Image.Image, key_hex: str) -> Image.Image:
    """Tách phông màu thành alpha, mềm ở viền, và khử màu phông ám vào viền hiệu ứng."""
    rgba = np.asarray(im.convert("RGBA")).astype(np.float32)
    rgb, alpha = rgba[..., :3], rgba[..., 3] / 255.0
    key = hex_rgb(key_hex)
    dist = np.linalg.norm(rgb - key, axis=-1)
    # Gần màu phông → trong suốt; xa → giữ; chuyển tiếp mềm trong khoảng 60–140
    a = np.clip((dist - 60) / 80, 0, 1)
    alpha = np.minimum(alpha, a)
    # Khử ám màu ở viền: các kênh trội của phông (vd. R,B với magenta) bị kéo xuống
    # ngang kênh còn lại, mạnh dần khi điểm ảnh càng trong suốt
    dom = [i for i in range(3) if key[i] > 200]
    low = [i for i in range(3) if key[i] < 128]
    if dom and low:
        cap = rgb[..., low].max(axis=-1)
        edge = 1 - alpha  # 0 ở lõi hiệu ứng, 1 ở vùng phông
        for i in dom:
            rgb[..., i] = rgb[..., i] - np.maximum(rgb[..., i] - cap, 0) * edge
    out = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def has_alpha(im: Image.Image) -> bool:
    return im.mode in ("RGBA", "LA") and np.asarray(im.getchannel("A")).min() < 250


def black_to_alpha(im: Image.Image) -> Image.Image:
    """Ảnh phát sáng trên nền đen → nền trong suốt: độ đục = kênh sáng nhất, màu được "khử nhân" lại."""
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    a = rgb.max(axis=-1)
    safe = np.maximum(a, 1)[..., None]
    out = np.dstack([np.clip(rgb / safe * 255, 0, 255), a]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def prepare_frame(im: Image.Image, meta: dict) -> Image.Image:
    if has_alpha(im):
        return im.convert("RGBA")
    rgb = np.asarray(im.convert("RGB")).astype(np.float32)
    corners = np.array([rgb[2, 2], rgb[2, -3], rgb[-3, 2], rgb[-3, -3]])
    if corners.max() < 24:  # nền đen
        return black_to_alpha(im)
    return key_out(im, meta["key"])


def new_sheet(meta: dict) -> Image.Image:
    return Image.new("RGBA", (meta["cols"] * CELL, meta["rows"] * CELL), (0, 0, 0, 0))


def save(sheet: Image.Image, name: str, meta: dict) -> Path:
    out = FX_DIR / f"{name}.png"
    sheet.save(out, optimize=True)
    return out


def pack(name: str) -> Path:
    meta = load_meta(name)
    src = FRAMES_DIR / name
    files = sorted(p for p in src.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
    if len(files) != meta["frames"]:
        sys.exit(f"{name}: cần {meta['frames']} khung trong {src}, đang có {len(files)}")
    sheet = new_sheet(meta)
    for i, f in enumerate(files):
        im = prepare_frame(Image.open(f), meta)
        im.thumbnail((CELL, CELL), Image.LANCZOS)
        x = (i % meta["cols"]) * CELL + (CELL - im.width) // 2
        y = (i // meta["cols"]) * CELL + (CELL - im.height) // 2
        sheet.alpha_composite(im, (x, y))
    return save(sheet, name, meta)


def key_sheet(name: str, path: str) -> Path:
    """Sheet đã vẽ sẵn trên phông màu: co về đúng kích thước lưới rồi tách phông."""
    meta = load_meta(name)
    im = Image.open(path)
    size = (meta["cols"] * CELL, meta["rows"] * CELL)
    if im.size != size:
        im = im.resize(size, Image.LANCZOS)
    return save(prepare_frame(im, meta), name, meta)


if __name__ == "__main__":
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    if args[0] == "--key":
        if len(args) != 3:
            sys.exit("Dùng: python tools/pack_sheet.py --key <tên_hiệu_ứng> <đường_dẫn_sheet>")
        print("Đã tách phông", key_sheet(args[1], args[2]).relative_to(ROOT))
    else:
        names = [p.name for p in FRAMES_DIR.iterdir() if p.is_dir()] if args[0] == "--all" else args
        for n in names:
            print("Đã ghép", pack(n).relative_to(ROOT))
