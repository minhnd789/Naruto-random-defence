"""Tạo bản ảnh nhẹ cho game từ ảnh gốc trong art/.

Dùng: python tools/build_assets.py [--force]

  art/fx/fx_*.png (2048x2048, ô 512) → game/public/fx/fx_*.webp (ô FX_CELL px, WebP có alpha)
  art/fx/manifest.json                → game/public/fx/manifest.json (thêm "cell")
  art/bg/bg_*.png (1920x1080)         → game/public/bg/bg_*.webp
  art/poses/<hero>/<pose>.png         → game/public/poses/<hero>/<pose>.webp (+ manifest.json)

Chỉ build lại file nào ảnh gốc mới hơn bản đã build (trừ khi có --force).
"""
import json
import sys
from pathlib import Path

# Console Windows mặc định không in được tiếng Việt
sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC_FX, SRC_BG = ROOT / "art" / "fx", ROOT / "art" / "bg"
OUT_FX, OUT_BG = ROOT / "game" / "public" / "fx", ROOT / "game" / "public" / "bg"
SRC_POSES, OUT_POSES = ROOT / "art" / "poses", ROOT / "game" / "public" / "poses"
POSE_OUT_SIZE = (512, 768)  # giữ đúng tỉ lệ khung 1024x1536
SRC_CELL = 512
FX_CELL = 320  # đủ nét khi phóng to ~2 lần trên màn hình, dung lượng nhỏ hơn ~6 lần
FX_QUALITY = 82
BG_QUALITY = 84


def stale(src: Path, out: Path, force: bool) -> bool:
    return force or not out.exists() or out.stat().st_mtime < src.stat().st_mtime


def main() -> None:
    force = "--force" in sys.argv
    OUT_FX.mkdir(parents=True, exist_ok=True)
    OUT_BG.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((SRC_FX / "manifest.json").read_text(encoding="utf-8"))
    total_src = total_out = 0
    built = 0

    for name, meta in manifest["fx"].items():
        src = SRC_FX / f"{name}.png"
        out = OUT_FX / f"{name}.webp"
        if not src.exists():
            print("Thiếu", src.relative_to(ROOT))
            continue
        if stale(src, out, force):
            im = Image.open(src).convert("RGBA")
            scale = FX_CELL / SRC_CELL
            im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
            im.save(out, "WEBP", quality=FX_QUALITY, method=6, alpha_quality=90)
            built += 1
        total_src += src.stat().st_size
        total_out += out.stat().st_size

    out_manifest = {"cell": FX_CELL, "fx": manifest["fx"]}
    (OUT_FX / "manifest.json").write_text(json.dumps(out_manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    for src in sorted(SRC_BG.glob("bg_*.png")):
        out = OUT_BG / f"{src.stem}.webp"
        if stale(src, out, force):
            Image.open(src).convert("RGB").save(out, "WEBP", quality=BG_QUALITY, method=6)
            built += 1
        total_src += src.stat().st_size
        total_out += out.stat().st_size

    # Ảnh tư thế: giữ nguyên khung (để vạch chân và tỉ lệ đúng như brief), chỉ thu nhỏ
    poses: dict[str, list[str]] = {}
    if SRC_POSES.exists():
        for hero in sorted(p for p in SRC_POSES.iterdir() if p.is_dir()):
            for src in sorted(hero.glob("*.png")):
                out = OUT_POSES / hero.name / f"{src.stem}.webp"
                out.parent.mkdir(parents=True, exist_ok=True)
                if stale(src, out, force):
                    Image.open(src).convert("RGBA").resize(POSE_OUT_SIZE, Image.LANCZOS).save(out, "WEBP", quality=86, method=6, alpha_quality=95)
                    built += 1
                poses.setdefault(hero.name, []).append(src.stem)
                total_src += src.stat().st_size
                total_out += out.stat().st_size
    OUT_POSES.mkdir(parents=True, exist_ok=True)
    (OUT_POSES / "manifest.json").write_text(
        json.dumps({"feet": 0.96, "stand": 0.8, "heroes": poses}, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    mb = lambda b: f"{b / 1_048_576:.1f} MB"
    print(f"Đã build {built} file. Ảnh gốc {mb(total_src)} → bản game {mb(total_out)}")


if __name__ == "__main__":
    main()
