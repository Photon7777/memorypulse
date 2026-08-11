from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "frontend/public/og-editorial-v4.png"
SANS = "/System/Library/Fonts/SFNS.ttf"
MONO = "/System/Library/Fonts/SFNSMono.ttf"


def font(path: str, size: int, index: int = 0) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size=size, index=index)


def main() -> None:
    image = Image.new("RGB", (1200, 630), "#080a18")
    draw = ImageDraw.Draw(image)

    ink = "#f5f7ff"
    muted = "#9ba6c9"
    line = "#283153"
    blue = "#6e7bff"
    amber = "#f7b955"

    draw.rectangle((0, 0, 1200, 8), fill=blue)
    draw.line((56, 102, 1144, 102), fill=line, width=2)
    draw.line((56, 548, 1144, 548), fill=line, width=2)

    draw.rounded_rectangle((56, 42, 88, 74), radius=16, fill=blue)
    for x, height in ((66, 10), (72, 20), (78, 14)):
        draw.rounded_rectangle((x, 68 - height, x + 3, 68), radius=2, fill=amber)
    draw.text((102, 43), "Memory", font=font(SANS, 30), fill=ink)
    draw.text((217, 43), "Pulse", font=font(SANS, 30), fill=amber)
    draw.text((928, 50), "PUBLIC MARKET RESEARCH", font=font(MONO, 15), fill=muted)

    title_font = font(SANS, 68)
    draw.text((56, 154), "Memory markets and", font=title_font, fill=ink)
    draw.text((56, 235), "consumer electronics", font=title_font, fill=ink)
    draw.text(
        (58, 336),
        "Observed prices, forecast ranges, and source records.",
        font=font(SANS, 25),
        fill=muted,
    )

    cards = [
        ("PRICE DATA", "Source-defined history"),
        ("FORECASTS", "Backtests and scenarios"),
        ("OPEN DATA", "CSV, Parquet, checksums"),
    ]
    x = 56
    for label, detail in cards:
        draw.rounded_rectangle((x, 409, x + 334, 510), radius=8, outline=line, width=2, fill="#11162a")
        draw.text((x + 20, 430), label, font=font(MONO, 15), fill=blue)
        draw.text((x + 20, 467), detail, font=font(SANS, 20), fill=ink)
        x += 355

    draw.text((56, 577), "photon7777.github.io/memorypulse", font=font(MONO, 17), fill=ink)
    draw.text((960, 577), "MEMORYPULSE", font=font(MONO, 17), fill=muted)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUTPUT, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
