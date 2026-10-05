#!/usr/bin/env python3
"""
Build the final FirmiCore Facebook video (9:16, 1080x1920) from three Flow clips.

What it does
  1. Joins clip1 + clip2 + clip3 (any length, e.g. 8 s or 10 s each) in order.
  2. Adds the FirmiCore logo watermark and the text overlays at the right times.
  3. Puts the FirmiCore end card (logo, name, website, "Book a free demo")
     over the LAST 4 SECONDS, while the narration from clip 3 keeps playing.
  4. Trims the result to 30 s at most.

Needs only Python 3 and ffmpeg (ffmpeg and ffprobe must be on your PATH).
No pip packages.

Usage
  python make_final_video.py clip1.mp4 clip2.mp4 clip3.mp4
  python make_final_video.py clip1.mp4 clip2.mp4 clip3.mp4 -o my_video.mp4
  python make_final_video.py clip1.mp4 clip2.mp4 clip3.mp4 --music music.mp3

Run it from this folder (docs/marketing) so it finds ./overlays and the end card,
or pass --assets /path/to/docs/marketing.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

W, H, FPS = 1080, 1920, 30
MAX_SECONDS = 30.0
END_CARD_SECONDS = 4.0
FADE = 0.3

# (file, clip index 0-2 or "all", local start s, local end s)
# Times are inside the clip; they are clamped so nothing runs under the end card.
OVERLAYS = [
    ("overlays/firmicore-overlay-1-logo-watermark.png", "all", 0.0, 999.0),
    ("overlays/firmicore-overlay-0-hook.png", 0, 0.0, 3.0),
    ("overlays/firmicore-overlay-2-meet-firmicore-triage.png", 0, 6.0, 9.5),
    ("overlays/firmicore-overlay-3a-safety-first.png", 1, 1.0, 3.0),
    ("overlays/firmicore-overlay-3b-step-by-step.png", 1, 4.0, 6.0),
    ("overlays/firmicore-overlay-3c-your-language.png", 1, 7.0, 9.0),
    ("overlays/firmicore-overlay-4a-fewer-calls.png", 2, 0.5, 2.5),
    ("overlays/firmicore-overlay-4b-operators-own.png", 2, 2.5, 4.5),
    ("overlays/firmicore-overlay-4c-work-orders.png", 2, 4.5, 6.5),
]
END_CARD = "firmicore-endcard-1080x1920.png"


def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit("ffmpeg failed:\n" + " ".join(cmd) + "\n\n" + p.stderr[-2000:])
    return p.stdout


def probe(path):
    out = run(["ffprobe", "-v", "error", "-print_format", "json",
               "-show_entries", "format=duration:stream=codec_type", str(path)])
    info = json.loads(out)
    has_audio = any(s["codec_type"] == "audio" for s in info["streams"])
    return float(info["format"]["duration"]), has_audio


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("clips", nargs=3, help="clip1.mp4 clip2.mp4 clip3.mp4 (in story order)")
    ap.add_argument("-o", "--output", default="firmicore_final_30s.mp4")
    ap.add_argument("--assets", default=str(Path(__file__).resolve().parent),
                    help="folder that contains overlays/ and the end card PNG")
    ap.add_argument("--music", help="optional background music file (mixed quietly under the voice)")
    args = ap.parse_args()

    assets = Path(args.assets)
    clips = [Path(c) for c in args.clips]
    for c in clips:
        if not c.exists():
            sys.exit(f"Clip not found: {c}")

    meta = [probe(c) for c in clips]
    durations = [m[0] for m in meta]
    starts = [sum(durations[:i]) for i in range(3)]
    total = min(sum(durations), MAX_SECONDS)
    end_start = max(total - END_CARD_SECONDS, 0)
    print(f"Clips: {[round(d, 2) for d in durations]} s  ->  video {total:.1f} s, end card from {end_start:.1f} s")

    inputs, filters = [], []
    # ---- 1. normalise and join the clips ----
    for i, c in enumerate(clips):
        inputs += ["-i", str(c)]
        filters.append(
            f"[{i}:v]scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps={FPS},format=yuv420p[v{i}]")
        if meta[i][1]:
            filters.append(f"[{i}:a]aresample=44100,aformat=channel_layouts=stereo[a{i}]")
        else:  # clip has no sound: make silence of the same length
            filters.append(f"anullsrc=r=44100:cl=stereo,atrim=0:{durations[i]},asetpts=N/SR/TB[a{i}]")
    filters.append("".join(f"[v{i}][a{i}]" for i in range(3)) + "concat=n=3:v=1:a=1[vcat][acat]")

    # ---- 2. overlays with fade in / out ----
    last = "vcat"
    idx = 3
    jobs = []
    for fname, which, a, b in OVERLAYS:
        base = 0.0 if which == "all" else starts[which]
        t0 = base + a
        t1 = min(base + b, end_start) if which != "all" else end_start
        if which != "all":
            t1 = min(t1, base + durations[which])
        if t1 - t0 < 0.6:
            continue  # clip too short, skip this overlay
        jobs.append((assets / fname, t0, t1))
    jobs.append((assets / END_CARD, end_start, total))

    for n, (png, t0, t1) in enumerate(jobs):
        if not png.exists():
            sys.exit(f"Missing image: {png}")
        inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{t1:.2f}", "-i", str(png)]
        d_in = min(FADE, (t1 - t0) / 2)
        filters.append(
            f"[{idx}:v]format=rgba,"
            f"fade=t=in:st={t0:.2f}:d={d_in:.2f}:alpha=1,"
            f"fade=t=out:st={t1 - d_in:.2f}:d={d_in:.2f}:alpha=1[o{n}]")
        filters.append(f"[{last}][o{n}]overlay=0:0:format=auto:eof_action=pass:enable='between(t,{t0:.2f},{t1:.2f})'[m{n}]")
        last = f"m{n}"
        idx += 1

    # ---- 3. audio (optional quiet music under the voice) ----
    audio_label = "acat"
    if args.music:
        inputs += ["-stream_loop", "-1", "-i", args.music]
        filters.append(f"[{idx}:a]aresample=44100,aformat=channel_layouts=stereo,volume=0.12[mus]")
        filters.append("[acat][mus]amix=inputs=2:duration=first:dropout_transition=0[amix]")
        audio_label = "amix"
    filters.append(f"[{audio_label}]afade=t=out:st={max(total - 0.8, 0):.2f}:d=0.8[aout]")

    cmd = ["ffmpeg", "-y", "-loglevel", "error", *inputs,
           "-filter_complex", ";".join(filters),
           "-map", f"[{last}]", "-map", "[aout]",
           "-t", f"{total:.2f}",
           "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
           args.output]
    run(cmd)
    print(f"Done -> {args.output}")


if __name__ == "__main__":
    main()
