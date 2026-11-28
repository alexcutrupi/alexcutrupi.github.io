#!/usr/bin/env python3
"""Build the home page intro's Live Photo montages: one video per variant instead of a clip per scene.

Each montage is ten Live Photo scenes picked at random, 0.4s apiece with short dissolves between them,
cut from the middle of each scene's motion and sped up 1.6x like the intro used to play them. The page
picks a variant at random and then plays the opening scene's own clip after it.

Usage: python3 tools/make_intro_montages.py [variants]     (rebuild after adding Live Photo scenes)
"""
import json, random, subprocess, sys
from pathlib import Path

DIR = Path("assets/photo-blends")
VARIANTS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
CUT, FADE, SPEED = 0.4, 0.12, 1.6      # seconds on screen, dissolve length, playback speed
SEGMENT = CUT + FADE                  # each piece overlaps the next by the dissolve
SIZES = {"desktop": (1920, 1206), "mobile": (1080, 1680)}

def duration(path):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                 str(path)], capture_output=True, text=True, check=True).stdout)

motion = json.loads((DIR / "scenes.json").read_text())["motion"]
rng = random.Random(7)  # Fixed seed, so rebuilding gives the same montages unless the scenes change.
for variant in range(1, VARIANTS + 1):
    scenes = rng.sample(motion, 10)
    for kind, (w, h) in SIZES.items():
        inputs, parts = [], []
        for i, scene in enumerate(scenes):
            clip = DIR / f"{kind}-{scene:02d}.mp4"
            need = SEGMENT * SPEED
            start = max(0, (duration(clip) - need) / 2)  # The middle of the motion.
            inputs += ["-i", str(clip)]
            parts.append(f"[{i}:v]trim=start={start:.3f}:duration={need:.3f},setpts=(PTS-STARTPTS)/{SPEED},"
                         f"fps=30,scale={w}:{h},setsar=1,format=yuv420p[v{i}]")
        chain, last = [], "v0"
        for i in range(1, len(scenes)):
            out = f"x{i}"
            chain.append(f"[{last}][v{i}]xfade=transition=fade:duration={FADE}:offset={CUT * i:.3f}[{out}]")
            last = out
        target = DIR / f"intro-{kind}-{variant}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(parts + chain),
                        "-map", f"[{last}]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "28",
                        "-pix_fmt", "yuv420p", "-color_range", "tv", "-movflags", "+faststart",
                        "-map_metadata", "-1", str(target)], check=True)
    print(f"variant {variant}: scenes {scenes}", flush=True)

# Tell the page how many montages there are to pick from.
scenes_file = DIR / "scenes.json"
data = json.loads(scenes_file.read_text())
data["introVariants"] = VARIANTS
scenes_file.write_text(json.dumps(data, separators=(",", ":")))
