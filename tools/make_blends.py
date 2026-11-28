#!/usr/bin/env python3
# (c) Alex Cutrupi. All rights reserved. See LICENSE.
"""Build three-photo backdrop blends (stills + looping Live Photo motion) for the portfolio.

Usage: make_blends.py <photos-dir> <output-dir> <first-scene-number> [--motion-only]

Each batch of scenes is listed under its first scene number in BATCHES:
  python3 tools/make_blends.py "live photos" <out> 52      # scenes 52-62
  python3 tools/make_blends.py "live photos/bg" <out> 63   # scenes 63-76

A scene gets motion when at least one of its photos is a Live Photo (a .mov next to the photo);
photos without one are held still in the motion. Scenes with no Live Photos are stills only.
"""
import colorsys
import json
import math
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SRC = Path(sys.argv[1])
OUT = Path(sys.argv[2])
FIRST = int(sys.argv[3])

# Three photos per scene, grouped by place and subject, keyed by the batch's first scene number.
BATCHES = {}
BATCHES[52] = [
    ["IMG_0202", "IMG_0216", "IMG_0289"],  # Alton Towers by day
    ["IMG_0232", "IMG_9616", "IMG_8875"],  # Alton Towers after dark
    ["IMG_0284", "IMG_9115", "IMG_8253"],  # Alton Towers park
    ["IMG_2442", "IMG_2443", "IMG_2445"],  # Thorpe Park arrival
    ["IMG_2446", "IMG_2479", "IMG_2488"],  # Thorpe Park rides
    ["IMG_4754", "IMG_9556", "IMG_8410"],  # Coasters
    ["IMG_2420", "IMG_2429", "IMG_4845"],  # Rail journey
    ["IMG_2432", "IMG_2434", "IMG_4846"],  # Train interiors
    ["IMG_0472", "IMG_0473", "IMG_0017"],  # London
    ["IMG_0513", "IMG_0525", "IMG_0511"],  # Brighton
    ["IMG_0506", "IMG_0509", "IMG_0010"],  # Cats & carriages
]
BATCHES[63] = [
    ["IMG_0145", "IMG_0147", "IMG_0150"],  # Alton Towers park
    ["IMG_0158", "IMG_0161", "IMG_9475"],  # Alton Towers coasters
    ["IMG_0018", "IMG_0032", "IMG_0398"],  # Train interiors
    ["IMG_0409", "IMG_0420", "IMG_0463"],  # Manchester trams
    ["IMG_0448", "IMG_0477", "IMG_0458"],  # London Underground
    ["IMG_0510", "IMG_0651", "IMG_0656"],  # TransPennine
    ["IMG_0116", "IMG_0541", "IMG_0678"],  # Seaside & views
    ["IMG_0384", "IMG_0480", "IMG_9772"],  # Through the window
    ["IMG_0299", "IMG_0457", "IMG_0471"],  # Station halls
    ["IMG_0226", "IMG_0419", "IMG_9823"],  # Platforms
    ["IMG_0460", "IMG_9473", "IMG_4170"],  # Out and about (the street photo has no motion)
    # Stills only
    ["IMG_20251222_142222_2957", "IMG_20251222_143438_2958", "IMG_20260110_100435_3096"],  # London landmarks
    ["IMG_20251222_143654_2960", "IMG_20251222_144915_2967", "2AED7365-FE72-4AEB-A60C-5E2131BE9C8E"],  # London at Christmas
    ["IMG_0488", "IMG_0495", "IMG_20251108_151403_98"],  # Trains & days out
]
SCENES = BATCHES[FIRST]


def find(name, extensions):
    """The photo or clip for `name`, whatever the case of its extension, or None."""
    for extension in extensions:
        for candidate in (SRC / f"{name}.{extension.upper()}", SRC / f"{name}.{extension.lower()}"):
            if candidate.exists():
                return candidate
    return None

STILL = {"desktop": (3900, 2450), "mobile": (1800, 2800)}     # Full quality, saved as *-full.webp
STANDARD = {"desktop": (2560, 1608), "mobile": (1170, 1820)}  # For screens without the pixels for full
MOTION = {"desktop": (1920, 1206), "mobile": (1080, 1680)}
LOOP = 6.0   # seconds per motion loop
FPS = 30
SPEED = 0.7  # Live Photos play a little slower than real time
FEATHER = 0.2  # share of the long edge used for each soft seam


def run(args):
    subprocess.run(args, check=True)


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)], check=True, capture_output=True, text=True).stdout
    return float(out.strip())


def layout(kind, size):
    """Panel size and offsets: side by side on desktop, stacked on mobile."""
    w, h = size
    long_edge = w if kind == "desktop" else h
    feather = round(long_edge * FEATHER / 2) * 2
    panel = round((long_edge + 2 * feather) / 3 / 2) * 2
    step = panel - feather
    if kind == "desktop":
        return (panel, h), [(i * step, 0) for i in range(3)], feather, "X"
    return (w, panel), [(0, i * step) for i in range(3)], feather, "Y"


def graph(kind, size, motion, clips=None):
    (pw, ph), offsets, feather, axis = layout(kind, size)
    w, h = size
    # Each clip plays in full; shorter ones hold their first frame so all three finish together.
    length = max(clips) / SPEED if motion else 1
    d = f":d={length:.3f}"
    parts = [f"color=black:s={w}x{h}:r={FPS}{d},format=yuva420p[base]"]
    for i in range(3):
        chain = (f"[{i}:v]scale={pw}:{ph}:force_original_aspect_ratio=increase,"
                 f"crop={pw}:{ph},setsar=1,format=yuva420p")
        if motion:
            # Inputs are already trimmed, stabilised and smoothed by prepare_clip().
            lead = length - clips[i] / SPEED
            chain = (f"{chain},setpts=PTS-STARTPTS,fps={FPS},"
                     f"tpad=start_mode=clone:start_duration={lead:.3f}:stop_mode=clone:stop_duration={length:.3f},"
                     f"trim=duration={length:.3f}")
        if i == 0:
            parts.append(f"{chain}[p0]")
        else:
            # Smoothstep ramp on the leading edge so each photo melts into the previous one.
            t = f"clip({axis}/{feather},0,1)"
            parts.append(f"{chain}[c{i}]")
            parts.append(f"color=white:s={pw}x{ph}:r={FPS}{d},format=gray,"
                         f"geq=lum='255*{t}*{t}*(3-2*{t})'[m{i}]")
            parts.append(f"[c{i}][m{i}]alphamerge[p{i}]")
    last = "base"
    for i, (x, y) in enumerate(offsets):
        parts.append(f"[{last}][p{i}]overlay={x}:{y}:shortest=1:format=auto[o{i}]")
        last = f"o{i}"
    parts.append(f"[{last}]format=yuv420p[out]")
    return ";".join(parts)


def prepare_clip(scene, movie, still=None):
    """Trim a Live Photo to the scene's shortest clip (keeping the middle, where the still was taken),
    steady the camera shake, slow it down and fill in frames so it plays smoothly at FPS."""
    clips = OUT / "clips"
    clips.mkdir(parents=True, exist_ok=True)
    if movie is None:
        # No Live Photo: a one-second clip of the photo, framed like the others, held still in the motion.
        target = clips / f"{scene}-{still.stem}-still.mp4"
        if not target.exists():
            zoom = 1.04
            run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", "1", "-i", str(still),
                 "-vf", f"crop=trunc(iw/{zoom}/2)*2:trunc(ih/{zoom}/2)*2",
                 "-c:v", "libx264", "-preset", "medium", "-crf", "10", "-pix_fmt", "yuv420p", str(target)])
        return target
    target = clips / f"{scene}-{movie.stem}.mp4"
    if not target.exists():
        zoom = 1.04  # hides the edges that stabilising moves into view
        run(["ffmpeg", "-v", "error", "-y", "-an", "-i", str(movie), "-vf",
             f"setpts=PTS-STARTPTS,"
             f"deshake=rx=48:ry=48:edge=mirror,"
             f"crop=trunc(iw/{zoom}/2)*2:trunc(ih/{zoom}/2)*2,"
             f"setpts=PTS/{SPEED},"
             f"minterpolate=fps={FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1",
             "-c:v", "libx264", "-preset", "medium", "-crf", "10", "-pix_fmt", "yuv420p", str(target)])
    return target


def tone(still_png):
    """Average colour, normalised to the saturation and lightness the site's tones use."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(still_png), "-vf", "scale=1:1:flags=area",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], check=True, capture_output=True).stdout
    r, g, b = (c / 255 for c in raw[:3])
    hue, _, _ = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(hue, .48, .65)
    return "#{:02x}{:02x}{:02x}".format(round(r * 255), round(g * 255), round(b * 255))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    tones = []
    limit = len(SCENES)
    for index, names in enumerate(SCENES[:limit]):
        scene = f"{FIRST + index:02d}"
        stills = [find(n, ["jpg", "jpeg"]) for n in names]
        assert all(stills), f"missing photo in {names}"
        movies = [find(n, ["mov"]) for n in names]
        motion = any(movies)
        # Held-still photos count as zero length, so the scene lasts as long as its longest Live Photo.
        lengths = [duration(m) if m else 0 for m in movies]
        for kind in ("desktop", "mobile"):
            if "--motion-only" not in sys.argv:
                png = OUT / f"{kind}-{scene}.png"
                inputs = sum((["-i", str(p)] for p in stills), [])
                run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex",
                     graph(kind, STILL[kind], False), "-map", "[out]", "-frames:v", "1", str(png)])
                # Both sizes: the page picks full quality only on screens that can show it.
                run(["cwebp", "-quiet", "-q", "80", "-m", "6", "-metadata", "none",
                     str(png), "-o", str(OUT / f"{kind}-{scene}-full.webp")])
                w, h = STANDARD[kind]
                run(["cwebp", "-quiet", "-q", "82", "-m", "6", "-metadata", "none", "-resize", str(w), str(h),
                     str(png), "-o", str(OUT / f"{kind}-{scene}.webp")])

            if not motion:
                continue
            with ThreadPoolExecutor(3) as pool:
                prepared = list(pool.map(lambda pair: prepare_clip(scene, *pair), zip(movies, stills)))
            inputs = sum((["-an", "-i", str(c)] for c in prepared), [])
            run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex",
                 graph(kind, MOTION[kind], True, lengths), "-map", "[out]", "-an",
                 "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-profile:v", "high", "-tune", "film",
                 "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart", "-map_metadata", "-1",
                 str(OUT / f"{kind}-{scene}.mp4")])
        print(scene, names, [round(x, 2) for x in lengths], "motion" if motion else "still", flush=True)
        if "--motion-only" not in sys.argv:
            tones.append(tone(OUT / f"desktop-{scene}.png"))
    if tones:
        (OUT / "tones.json").write_text(json.dumps(tones))


main()
