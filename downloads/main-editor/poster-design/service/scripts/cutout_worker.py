import io
import json
import os
import sys
from urllib.parse import urlparse
from PIL import Image


MIRROR_HOST_ALLOWLIST = {
    "github.com",
    "raw.githubusercontent.com",
    "release-assets.githubusercontent.com",
    "objects.githubusercontent.com",
    "media.githubusercontent.com",
    "huggingface.co",
}


def print_result(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def ensure_parent(target_path):
    parent = os.path.dirname(target_path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def build_mirrored_url(raw_url):
    mirror_prefix = os.getenv("REMBG_MODEL_MIRROR", "").strip()
    if not mirror_prefix or not isinstance(raw_url, str):
        return raw_url
    if not raw_url.startswith(("http://", "https://")):
        return raw_url
    parsed = urlparse(raw_url)
    if parsed.netloc not in MIRROR_HOST_ALLOWLIST:
        return raw_url
    return f"{mirror_prefix.rstrip('/')}/{raw_url}"


def enable_model_mirror():
    mirror_prefix = os.getenv("REMBG_MODEL_MIRROR", "").strip()
    if not mirror_prefix:
        return
    try:
        import requests
    except Exception:
        return

    original_request = requests.sessions.Session.request

    def mirrored_request(self, method, url, *args, **kwargs):
        return original_request(self, method, build_mirrored_url(url), *args, **kwargs)

    requests.sessions.Session.request = mirrored_request


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
    u2net_home = os.getenv("U2NET_HOME", "").strip()
    if u2net_home:
        os.makedirs(u2net_home, exist_ok=True)
    enable_model_mirror()
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

    raise SystemExit(f"unknown command: {command}")


if __name__ == "__main__":
    main()
