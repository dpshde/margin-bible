#!/usr/bin/env python3
"""Write Dylan's open-book raster into favicon/PWA/iOS icons. No SVG glyph."""

from __future__ import annotations

import base64
import io
import struct
import sys
from pathlib import Path

# Pillow is only required to write rasters. --self-test stays stdlib so CI can run it.
if "--self-test" not in sys.argv:
    from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE_PNG = ROOT / "app/assets/images/open-book-icon.png"
SOURCE_SVG = ROOT / "app/assets/images/open-book-icon.svg"
PUBLIC_SVG = PUBLIC / "icon.svg"
IOS_ICONSET = ROOT / "ios/Margin/Assets.xcassets/AppIcon.appiconset"
DARK = (26, 24, 22)
MASKABLE_SAFE = 0.80
ATTACHED_P32 = [
    ROOT / "margin-favicon-out/icon-32.png",
    Path("/workspace/margin-favicon-out/icon-32.png"),
]

# Dylan's ICO payload (16x16 PNG is valid; 32x32 PNG in this blob is truncated).
ICO = """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"""


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def extractIcoPngs(icoBytes: bytes) -> list[bytes]:
    reserved, kind, count = struct.unpack_from("<HHH", icoBytes, 0)
    if reserved != 0 or kind != 1 or count < 1:
        fail(f"ICO header is not a valid icon (reserved={reserved} type={kind} count={count})")
    pngs = []
    offset = 6
    for _ in range(count):
        _w, _h, _colors, _res, _planes, _bits, size, dataOffset = struct.unpack_from("<BBBBHHII", icoBytes, offset)
        blob = icoBytes[dataOffset : dataOffset + size]
        if blob[:8] != b"\x89PNG\r\n\x1a\n":
            fail("ICO image is not a PNG")
        pngs.append(blob)
        offset += 16
    return pngs


def loadPng(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image.convert("RGBA")


def lanczos(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def writeIco(path: Path, images: list[Image.Image]) -> None:
    payloads = []
    for image in images:
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        payloads.append(buf.getvalue())
    count = len(images)
    header = struct.pack("<HHH", 0, 1, count)
    offset = 6 + (16 * count)
    entries = b""
    for image, data in zip(images, payloads):
        width = image.width if image.width < 256 else 0
        height = image.height if image.height < 256 else 0
        entries += struct.pack("<BBBBHHII", width, height, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    path.write_bytes(header + entries + b"".join(payloads))


def makeOpaque(image: Image.Image, background: tuple[int, int, int] = DARK) -> Image.Image:
    rgba = image.convert("RGBA")
    canvas = Image.new("RGB", rgba.size, background)
    canvas.paste(rgba, mask=rgba.split()[3])
    return canvas


def makeMaskable(book: Image.Image, size: int = 512, safe: float = MASKABLE_SAFE) -> Image.Image:
    canvas = Image.new("RGB", (size, size), DARK)
    target = int(round(size * safe))
    fitted = lanczos(book, target)
    offset = (size - target) // 2
    canvas.paste(fitted, (offset, offset), fitted)
    return canvas


def savePng(path: Path, image: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG")


def loadAttachedP32() -> Image.Image | None:
    for path in ATTACHED_P32:
        if path.is_file():
            image = Image.open(path)
            image.load()
            print(f"using attached raster {path}")
            return image.convert("RGBA")
    return None


def loadP32FromIco(pngs: list[bytes]) -> Image.Image:
    book16 = loadPng(pngs[0])
    if book16.size != (16, 16):
        fail(f"ICO 16px PNG is {book16.size}, not 16x16")
    if len(pngs) > 1:
        try:
            book32 = loadPng(pngs[1])
            if book32.size == (32, 32):
                print("using ICO 32px PNG")
                return book32
        except Exception as error:
            print(f"ICO 32px PNG is unreadable ({error}); LANCZOS 16->32")
    else:
        print("ICO has no 32px image; LANCZOS 16->32")
    return lanczos(book16, 32)


def deleteSvgGlyphs() -> None:
    for path in (PUBLIC_SVG, SOURCE_SVG):
        if path.exists():
            path.unlink()
            print(f"deleted {path.relative_to(ROOT)}")


def writeAll(book32: Image.Image, book16: Image.Image) -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    SOURCE_PNG.parent.mkdir(parents=True, exist_ok=True)

    favicon32 = lanczos(book32, 32) if book32.size != (32, 32) else book32
    book192 = lanczos(book32, 192)
    book180 = lanczos(book32, 180)
    book512 = lanczos(book192, 512)

    savePng(PUBLIC / "favicon-32.png", favicon32)
    savePng(PUBLIC / "icon.png", favicon32)
    savePng(PUBLIC / "apple-touch-icon.png", makeOpaque(book180))
    savePng(PUBLIC / "icon-192.png", book192)
    savePng(PUBLIC / "icon-maskable.png", makeMaskable(book32, size=512))
    savePng(SOURCE_PNG, book192)
    savePng(PUBLIC / "icon-512.png", book512)

    writeIco(PUBLIC / "favicon.ico", [book16 if book16.size == (16, 16) else lanczos(book32, 16), favicon32])

    IOS_ICONSET.mkdir(parents=True, exist_ok=True)
    for size in (40, 58, 60, 80, 87, 120, 180, 1024):
        savePng(IOS_ICONSET / f"AppIcon-{size}.png", makeOpaque(lanczos(book32, size)))

    deleteSvgGlyphs()


def confirm() -> None:
    fav32 = PUBLIC / "favicon-32.png"
    data = fav32.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        fail("public/favicon-32.png is not a PNG")
    if PUBLIC_SVG.exists() or SOURCE_SVG.exists():
        fail("SVG glyph still present")
    image = Image.open(fav32)
    image.load()
    if image.size != (32, 32):
        fail(f"favicon-32.png is {image.size}, not 32x32")
    print("ok: public/favicon-32.png is PNG 32x32; SVG glyphs removed")


def pngSize(data: bytes) -> tuple[int, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        fail("not a PNG")
    if data[12:16] != b"IHDR":
        fail("PNG missing IHDR")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def selfTest() -> None:
    if not ICO:
        fail("missing ICO= constant")
    icoBytes = base64.b64decode(ICO)
    pngs = extractIcoPngs(icoBytes)
    width, height = pngSize(pngs[0])
    if (width, height) != (16, 16):
        fail(f"self-test: ICO 16px is {width}x{height}")
    print("write-dylan-favicon self-test ok")


def main() -> None:
    if "--self-test" in sys.argv:
        selfTest()
        return
    if not ICO:
        fail("missing ICO= constant")
    icoBytes = base64.b64decode(ICO)
    pngs = extractIcoPngs(icoBytes)
    book16 = loadPng(pngs[0])
    attached = loadAttachedP32()
    book32 = attached if attached is not None else loadP32FromIco(pngs)
    writeAll(book32, book16)
    confirm()


if __name__ == "__main__":
    main()
