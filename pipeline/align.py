#!/usr/bin/env python3
"""Word-level timestamp alignment for a VO audio file, via faster-whisper.
Usage: python3 pipeline/align.py <audio_path> <out_json_path>
"""
import json
import sys


def main():
    if len(sys.argv) != 3:
        print("Pakai: python3 pipeline/align.py <audio_path> <out_json_path>", file=sys.stderr)
        sys.exit(1)

    audio_path, out_path = sys.argv[1], sys.argv[2]

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("MISSING_DEPENDENCY:faster-whisper", file=sys.stderr)
        sys.exit(2)

    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, _ = model.transcribe(audio_path, language="id", word_timestamps=True)

    words = []
    for segment in segments:
        for word in segment.words:
            words.append({"word": word.word.strip(), "start": word.start, "end": word.end})

    with open(out_path, "w") as f:
        json.dump({"words": words}, f, indent=2)

    print(f"{len(words)} kata -> {out_path}")


if __name__ == "__main__":
    main()
