import io
import json
import os
import sys
from PIL import Image


def print_result(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def ensure_parent(target_path):
    parent = os.path.dirname(target_path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def inspect_image(input_path):
    image = Image.open(input_path)
    payload = {
        "mode": image.mode,
        "size": list(image.size),
    }
    if "A" in image.getbands():
        alpha = image.getchannel("A")
        payload["alpha_extrema"] = list(alpha.getextrema())
        payload["alpha_bbox"] = list(alpha.getbbox()) if alpha.getbbox() else None
    else:
        payload["extrema"] = list(image.getextrema()) if isinstance(image.getextrema(), tuple) else image.getextrema()
    print_result(payload)


def run_rembg(input_path, output_path, model_name="u2net"):
    from rembg import new_session, remove

    ensure_parent(output_path)
    with open(input_path, "rb") as file:
        source = file.read()

    session = new_session(model_name)
    result = remove(source, session=session)
    image = Image.open(io.BytesIO(result)).convert("RGBA")
    image.save(output_path, "PNG")

    alpha = image.getchannel("A")
    print_result(
        {
            "ok": True,
            "mode": image.mode,
            "size": list(image.size),
            "alpha_extrema": list(alpha.getextrema()),
            "alpha_bbox": list(alpha.getbbox()) if alpha.getbbox() else None,
            "output_path": output_path,
        }
    )


def merge_mask(raw_path, mask_path, output_path):
    ensure_parent(output_path)
    raw = Image.open(raw_path).convert("RGBA")
    mask = Image.open(mask_path).convert("L")

    if mask.size != raw.size:
        mask = mask.resize(raw.size)

    low, high = mask.getextrema()
    if high <= 1:
        mask = mask.point(lambda pixel: 255 if pixel > 0 else 0)

    raw.putalpha(mask)
    raw.save(output_path, "PNG")

    alpha = raw.getchannel("A")
    print_result(
        {
            "ok": True,
            "mode": raw.mode,
            "size": list(raw.size),
            "alpha_extrema": list(alpha.getextrema()),
            "alpha_bbox": list(alpha.getbbox()) if alpha.getbbox() else None,
            "output_path": output_path,
        }
    )


def optimize_upload(input_path, output_path, max_side=2048, jpeg_quality=88):
    ensure_parent(output_path)
    image = Image.open(input_path)
    source_mode = image.mode
    width, height = image.size
    scale = min(1.0, float(max_side) / float(max(width, height, 1)))
    target_size = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))

    if target_size != image.size:
        image = image.resize(target_size, Image.Resampling.LANCZOS)

    has_alpha = "A" in image.getbands()
    ext = os.path.splitext(output_path)[1].lower()

    if has_alpha or ext == ".png":
        image = image.convert("RGBA")
        image.save(output_path, "PNG", optimize=True)
        output_format = "PNG"
    else:
        image = image.convert("RGB")
        image.save(output_path, "JPEG", quality=jpeg_quality, optimize=True)
        output_format = "JPEG"

    print_result(
        {
            "ok": True,
            "source_mode": source_mode,
            "mode": image.mode,
            "size": list(image.size),
            "output_path": output_path,
            "format": output_format,
        }
    )


def main():
    if len(sys.argv) < 3:
        raise SystemExit("usage: cutout_worker.py <command> <args...>")

    command = sys.argv[1]
    if command == "inspect":
        inspect_image(sys.argv[2])
        return

    if command == "rembg":
        if len(sys.argv) < 4:
            raise SystemExit("usage: cutout_worker.py rembg <input> <output> [model]")
        model_name = sys.argv[4] if len(sys.argv) > 4 else "u2net"
        run_rembg(sys.argv[2], sys.argv[3], model_name)
        return

    if command == "merge-mask":
        if len(sys.argv) < 5:
            raise SystemExit("usage: cutout_worker.py merge-mask <raw> <mask> <output>")
        merge_mask(sys.argv[2], sys.argv[3], sys.argv[4])
        return

    if command == "optimize-upload":
        if len(sys.argv) < 4:
            raise SystemExit("usage: cutout_worker.py optimize-upload <input> <output> [max_side] [quality]")
        max_side = int(sys.argv[4]) if len(sys.argv) > 4 else 2048
        quality = int(sys.argv[5]) if len(sys.argv) > 5 else 88
        optimize_upload(sys.argv[2], sys.argv[3], max_side, quality)
        return

    raise SystemExit(f"unknown command: {command}")


if __name__ == "__main__":
    main()
