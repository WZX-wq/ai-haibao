from __future__ import annotations

import io
import json
import pathlib
import urllib.parse
import urllib.request

from PIL import Image


ROOT = pathlib.Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "src" / "assets" / "template-covers"
API_BASE = "http://127.0.0.1:7001"
OFFICIAL_TEMPLATE_IDS = [
    101, 102, 103, 104, 105, 106, 107,
    201, 202, 203, 204, 205, 206, 207, 208,
    301, 302, 303, 304, 305, 306, 307, 308,
    401, 402, 403, 404, 405, 406, 407, 408,
]


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if isinstance(payload, dict) and "result" in payload:
        result = payload["result"]
        if isinstance(result, dict):
            return result
    if isinstance(payload, dict):
        return payload
    raise RuntimeError(f"Unexpected payload from {url}")


def fetch_bytes(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def build_screenshot_url(template_id: int, width: int, height: int) -> str:
    query = urllib.parse.urlencode(
        {
            "tempid": template_id,
            "width": width,
            "height": height,
            "type": "file",
            "index": 0,
            "force": 1,
        }
    )
    return f"{API_BASE}/api/screenshots?{query}"


def make_cover(template_id: int) -> None:
    detail = fetch_json(f"{API_BASE}/design/temp?id={template_id}")
    width = max(1, int(detail.get("width") or 1242))
    height = max(1, int(detail.get("height") or 1660))
    raw = fetch_bytes(build_screenshot_url(template_id, width, height))

    with Image.open(io.BytesIO(raw)) as image:
        image = image.convert("RGB")
        target_width = 480
        target_height = max(1, round(image.height * target_width / image.width))
        resized = image.resize((target_width, target_height), Image.Resampling.LANCZOS)

        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        output_path = OUTPUT_DIR / f"template-{template_id}.webp"
        resized.save(output_path, format="WEBP", quality=86, method=6)
        print(f"generated {output_path.name} ({target_width}x{target_height})")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for template_id in OFFICIAL_TEMPLATE_IDS:
        make_cover(template_id)


if __name__ == "__main__":
    main()
