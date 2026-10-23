#!/usr/bin/env python3
"""
Builds a narration track (mp3) + subtitles (srt) from a timed scene list so the
speech starts inside its scene and never runs into the next one.

For every scene: speak the text, measure it, speed it up slightly if it is longer
than the scene (max 1.35x), pad with silence to the scene's exact length. The scenes
are then joined on the video's own timeline, so second N of the mp3 is second N of the
video. Scenes that are still too long are reported — shorten that text or widen its window.

Needs: Python 3.9+, ffmpeg + ffprobe on PATH, and for real voices `pip install edge-tts`
(free Microsoft Edge voices, no account / key, needs internet). Sinhala voices:
si-LK-ThiliniNeural (female), si-LK-SameeraNeural (male). English: en-US-JennyNeural, en-GB-SoniaNeural ...

Usage:
  python make_narration.py scenes-machines.json --lang en --out narration_en
  python make_narration.py scenes-machines.json --lang si --out narration_si
  python make_narration.py scenes-machines.json --lang en --fake --out test   # beeps only, no internet
List voices:  edge-tts --list-voices | grep -E "si-LK|en-US"

Then lay it over the video (video stays untouched, original audio replaced):
  ffmpeg -i guide.mp4 -i narration_si.mp3 -map 0:v -map 1:a -c:v copy -c:a aac -shortest guide_si.mp4
"""
import argparse
import asyncio
import json
import os
import re
import subprocess
import sys
import tempfile

LEAD = 0.15        # speech starts this long after the scene starts
TAIL = 0.20        # and ends at least this long before the next scene
MAX_TEMPO = 1.35   # never speed speech up more than this
DEFAULT_VOICE = {"en": "en-US-JennyNeural", "si": "si-LK-ThiliniNeural"}


def parse_time(s: str) -> float:
    parts = [float(p) for p in s.strip().split(":")]
    t = 0.0
    for p in parts:
        t = t * 60 + p
    return t


def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.exit(f"command failed: {' '.join(cmd)}\n{r.stderr}")
    return r.stdout


def duration(path: str) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(out.strip())


async def speak_edge(text: str, voice: str, out: str):
    try:
        import edge_tts  # type: ignore
    except ImportError:
        sys.exit("edge-tts is not installed: run  pip install edge-tts   (or use --fake to test)")
    await edge_tts.Communicate(text, voice).save(out)


def speak_fake(text: str, out: str):
    # A tone about as long as the sentence would take to say (~2.7 words / second).
    words = max(1, len(re.findall(r"\S+", text)))
    run(["ffmpeg", "-y", "-f", "lavfi", "-i", f"sine=frequency=440:duration={words / 2.7:.2f}", "-ar", "24000", "-ac", "1", out])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scenes")
    ap.add_argument("--lang", required=True, choices=["en", "si"])
    ap.add_argument("--voice")
    ap.add_argument("--out", required=True, help="output name without extension")
    ap.add_argument("--fake", action="store_true", help="beeps instead of speech (no internet, for checking the timing)")
    args = ap.parse_args()

    scenes = json.load(open(args.scenes, encoding="utf-8"))["scenes"]
    voice = args.voice or DEFAULT_VOICE[args.lang]
    work = tempfile.mkdtemp(prefix="narration_")
    parts, srt, report = [], [], []
    cursor = 0.0
    problems = 0

    for i, sc in enumerate(scenes, 1):
        start, end = parse_time(sc["start"]), parse_time(sc["end"])
        window = end - start
        text = sc[args.lang].strip()
        if start < cursor - 0.001:
            sys.exit(f"scene {i} starts before the previous one ends")
        if start > cursor + 0.001:  # silence before this scene
            gap = os.path.join(work, f"gap{i}.wav")
            run(["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", f"{start - cursor:.3f}", gap])
            parts.append(gap)

        raw = os.path.join(work, f"raw{i}.mp3")
        if args.fake:
            speak_fake(text, raw)
        else:
            asyncio.run(speak_edge(text, voice, raw))
        spoken = duration(raw)

        room = window - LEAD - TAIL
        tempo = 1.0
        if spoken > room:
            tempo = min(spoken / room, MAX_TEMPO) if room > 0 else MAX_TEMPO
        final_len = spoken / tempo
        status = "ok"
        fade = ""
        if final_len > room + 0.001:
            status = "TOO LONG — shorten the text or widen the scene"
            problems += 1
            fade = f",afade=t=out:st={max(0, window - LEAD - 0.4):.3f}:d=0.4"
        seg = os.path.join(work, f"seg{i}.wav")
        af = f"atempo={tempo:.4f},adelay={int(LEAD * 1000)}:all=1{fade},apad"  # endless silence, cut to the exact scene length by -t
        run(["ffmpeg", "-y", "-i", raw, "-af", af, "-t", f"{window:.3f}", "-ar", "24000", "-ac", "1", seg])
        parts.append(seg)
        cursor = end

        speech_end = min(start + LEAD + final_len, end - 0.05)
        srt.append(f"{i}\n{srt_time(start + LEAD)} --> {srt_time(speech_end)}\n{text}\n")
        report.append((i, sc["start"], sc["end"], window, spoken, tempo, status))

    lst = os.path.join(work, "list.txt")
    with open(lst, "w") as f:
        for p in parts:
            f.write(f"file '{p}'\n")
    mp3 = f"{args.out}.mp3"
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c:a", "libmp3lame", "-b:a", "128k", mp3])
    with open(f"{args.out}.srt", "w", encoding="utf-8") as f:
        f.write("\n".join(srt))

    print(f"{'#':>2} {'start':>6} {'end':>6} {'window':>7} {'speech':>7} {'speed':>6}  result")
    for i, s, e, w, sp, t, st in report:
        print(f"{i:>2} {s:>6} {e:>6} {w:>6.1f}s {sp:>6.1f}s {t:>5.2f}x  {st}")
    total = duration(mp3)
    print(f"\n{mp3}: {total:.1f}s (video timeline ends at {cursor:.1f}s) · {args.out}.srt written")
    if problems:
        print(f"{problems} scene(s) too long — see above.")


if __name__ == "__main__":
    main()
