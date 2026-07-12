#!/usr/bin/env python3
"""F5-TTS (MLX / Apple Silicon) zero-shot voice-clone adapter for the dubbing cascade.

Batch-manifest CLI contract (shared by the manifest-based tts_<engine>.py adapters):

    tts_f5.py --manifest <path.json> [--force]

The manifest is a JSON array of items:

    {"id": int,
     "ref": "<abs path to reference wav>",
     "ref_text": "<source-language transcript of the reference>",
     "text": "<english text to speak>",
     "lang": "en",
     "out": "<abs path to output wav>"}

F5-TTS REQUIRES a reference transcript that matches the reference audio: we use
the manifest's `ref_text`. The model conditions on `ref_text + " " + text` and
the synthesised tail is sliced off after the reference, so a missing/empty
`ref_text` produces poor or broken output — it is treated as a hard error here.

The F5-MLX base model is English/Chinese. Our references are French while `text`
is English, so this is a cross-lingual clone (expected by design, some quality
loss — the French ref conditions timbre, the English text drives content).

Loading: f5_tts_mlx ships an importable generate() AND a CLI, but its generate()
reloads the model on every call. To honour the "load once" contract we load the
underlying `F5TTS` model ONCE here and call `f5tts.sample()` per item, mirroring
the package's own generate() core (RMS normalise the ref, prepend the ref text,
slice off the reference tail). First run downloads weights from HuggingFace.

Device: MLX runs on the Apple Silicon GPU (Metal); there is no torch/cpu split.
We report `device=mlx` for parity with the other adapters. (No torch is present
in this venv — it is intentionally MLX-only.)

F5 requires the reference audio at 24 kHz. The cascade extracts refs at the
source sample rate, so we resample to 24 kHz here with a dependency-light numpy
linear interpolation (the ref only conditions timbre, so this is sufficient).

Install into scripts/dub/.venv-f5 — see scripts/dub/tts/README.md.
"""

import argparse
import json
import os
import sys
import time

SAMPLE_RATE = 24_000
TARGET_RMS = 0.1  # matches f5_tts_mlx.generate


def log(msg: str) -> None:
    print(f"[tts_f5] {msg}", file=sys.stderr, flush=True)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="F5-TTS (MLX) voice-clone TTS adapter (batch manifest)")
    p.add_argument("--manifest", required=True, help="path to the batch manifest JSON")
    p.add_argument("--force", action="store_true", help="re-synthesise items whose out already exists")
    p.add_argument("--model", default="lucasnewman/f5-tts-mlx", help="F5-MLX HF model name")
    p.add_argument("--steps", type=int, default=8, help="sampling steps")
    p.add_argument("--cfg-strength", dest="cfg_strength", type=float, default=2.0,
                   help="classifier-free guidance strength")
    p.add_argument("--sway-sampling-coef", dest="sway_sampling_coef", type=float, default=-1.0,
                   help="sway sampling coefficient")
    p.add_argument("--speed", type=float, default=1.0, help="speech speed (duration heuristic)")
    return p.parse_args()


def load_manifest(path: str) -> list:
    if not os.path.isfile(path):
        raise SystemExit(f"tts_f5: manifest not found: {path}")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            items = json.load(fh)
    except Exception as exc:
        raise SystemExit(f"tts_f5: could not parse manifest {path}: {exc}")
    if not isinstance(items, list):
        raise SystemExit("tts_f5: manifest must be a JSON array of items")
    for it in items:
        for key in ("id", "ref", "ref_text", "text", "out"):
            if key not in it:
                raise SystemExit(f"tts_f5: manifest item missing '{key}': {it!r}")
    return items


def load_ref_audio(np, sf, ref_path: str):
    """Read a reference wav as mono float32 at 24 kHz, RMS-normalised.

    F5-MLX requires 24 kHz; the cascade extracts refs at the source rate, so we
    resample with numpy linear interpolation (no librosa/scipy in this venv).
    """
    audio, sr = sf.read(ref_path, dtype="float32", always_2d=False)
    if audio.ndim > 1:  # downmix to mono
        audio = audio.mean(axis=1)
    if sr != SAMPLE_RATE:
        n_out = int(round(len(audio) * SAMPLE_RATE / sr))
        if n_out <= 1:
            raise SystemExit(f"tts_f5: reference too short to resample: {ref_path}")
        x_old = np.linspace(0.0, 1.0, num=len(audio), endpoint=False)
        x_new = np.linspace(0.0, 1.0, num=n_out, endpoint=False)
        audio = np.interp(x_new, x_old, audio).astype("float32")
    return audio


def main() -> int:
    args = parse_args()
    items = load_manifest(args.manifest)

    try:
        import numpy as np
        import soundfile as sf
        import mlx.core as mx
        from f5_tts_mlx.cfm import F5TTS
        from f5_tts_mlx.utils import convert_char_to_pinyin
    except Exception as exc:  # pragma: no cover - import-time env problem
        raise SystemExit(
            f"tts_f5: failed to import f5-tts-mlx/mlx ({exc}). "
            f"Install into scripts/dub/.venv-f5 (Apple Silicon only) — see scripts/dub/tts/README.md."
        )

    # MLX is Metal/GPU-only on Apple Silicon; there is no cpu/mps split to make.
    device = "mlx"
    log(f"device={device}")

    log(f"loading F5TTS '{args.model}' (first run downloads weights from HuggingFace)…")
    try:
        f5tts = F5TTS.from_pretrained(args.model)
    except Exception as exc:
        raise SystemExit(f"tts_f5: failed to load model '{args.model}': {exc}")

    for it in items:
        item_id = it["id"]
        out = it["out"]
        if not args.force and os.path.isfile(out) and os.path.getsize(out) > 0:
            log(f"[{item_id}] cached (skip) -> {out}")
            continue
        if not os.path.isfile(it["ref"]):
            raise SystemExit(f"tts_f5: [{item_id}] reference wav not found: {it['ref']}")
        text = (it.get("text") or "").strip()
        if not text:
            raise SystemExit(f"tts_f5: [{item_id}] empty text — nothing to synthesise")
        ref_text = (it.get("ref_text") or "").strip()
        if not ref_text:
            raise SystemExit(
                f"tts_f5: [{item_id}] empty ref_text — F5-TTS requires the reference transcript"
            )
        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)

        start = time.time()
        try:
            audio_np = load_ref_audio(np, sf, it["ref"])
            audio = mx.array(audio_np)

            # RMS-normalise the reference (mirrors f5_tts_mlx.generate).
            rms = mx.sqrt(mx.mean(mx.square(audio)))
            if rms < TARGET_RMS:
                audio = audio * TARGET_RMS / rms

            # F5 conditions on "<ref_text> <gen_text>" (pinyin-encoded) and we
            # slice off the reference-length prefix from the generated wave.
            cond_text = convert_char_to_pinyin([ref_text + " " + text])

            wave, _ = f5tts.sample(
                mx.expand_dims(audio, axis=0),
                text=cond_text,
                duration=None,
                steps=args.steps,
                method="rk4",
                speed=args.speed,
                cfg_strength=args.cfg_strength,
                sway_sampling_coef=args.sway_sampling_coef,
            )
            wave = wave[audio.shape[0]:]
            mx.eval(wave)

            sf.write(out, np.array(wave), SAMPLE_RATE)
        except SystemExit:
            raise
        except Exception as exc:
            raise SystemExit(f"tts_f5: [{item_id}] synthesis failed on {device}: {exc}")

        if not os.path.isfile(out) or os.path.getsize(out) == 0:
            raise SystemExit(f"tts_f5: [{item_id}] no output produced at {out}")
        log(f"[{item_id}] elapsed={time.time() - start:.1f}s (device={device}) -> {out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
