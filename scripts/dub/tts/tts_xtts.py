#!/usr/bin/env python3
"""XTTS-v2 zero-shot voice-clone adapter for the dubbing cascade (BATCH mode).

Uniform BATCH adapter contract (shared by the sibling tts_<engine>.py adapters):

    tts_<engine>.py --manifest <json> [--force]

`--manifest` is a JSON array of items, produced by cascade.mjs's SYNTH stage:

    [
      { "id": 0,
        "ref": "<abs reference speaker wav>",
        "ref_text": "<fr reference text>",   # informational; XTTS ignores it
        "text": "<english text to speak>",
        "lang": "en",
        "out": "<abs output wav path>" },
      ...
    ]

The model is loaded ONCE, then every item is synthesised in a loop: `text` is
spoken in the voice cloned from `ref`, written to `out`. Existing non-empty
outputs are skipped unless --force.

Output to stderr:
  - the device used, ONCE, after the model loads;
  - per item, `[<id>] elapsed=Xs`.
On failure the process exits non-zero with a message naming the failing id.

Anti-ramble: XTTS' autoregressive decoder tends to LOOP / over-generate on
short or repetitive references. The generation kwargs below (repetition_penalty,
temperature, top_k/top_p, length_penalty, enable_text_splitting) curb that; they
are exposed as CLI flags with sane defaults.

XTTS is gated behind the Coqui CPML; COQUI_TOS_AGREED=1 is set below so the
first run can download the model (~1.8 GB) non-interactively (cascade.mjs also
exports it). See scripts/dub/tts/README.md.
"""

import argparse
import json
import os
import sys
import time

# Agree to the Coqui CPML before importing TTS, so the first-run model download
# never blocks on an interactive prompt.
os.environ.setdefault("COQUI_TOS_AGREED", "1")

MODEL = "tts_models/multilingual/multi-dataset/xtts_v2"


def log(msg: str) -> None:
    print(f"[tts_xtts] {msg}", file=sys.stderr, flush=True)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="XTTS-v2 voice-clone TTS adapter (batch)")
    p.add_argument("--manifest", required=True, help="JSON array of synth items")
    p.add_argument(
        "--force",
        action="store_true",
        help="re-synthesise items whose output already exists",
    )
    # --- Anti-ramble / anti-loop generation params (XTTS via TTS.api) --------
    # Defaults chosen to curb the autoregressive decoder's tendency to loop or
    # over-generate on short/repetitive references.
    p.add_argument("--repetition-penalty", type=float, default=5.0,
                   help="penalise repeated tokens to stop looping (default 5.0)")
    p.add_argument("--temperature", type=float, default=0.7,
                   help="sampling temperature (default 0.7)")
    p.add_argument("--length-penalty", type=float, default=1.0,
                   help="length penalty (default 1.0)")
    p.add_argument("--top-k", type=int, default=50,
                   help="top-k sampling (default 50)")
    p.add_argument("--top-p", type=float, default=0.85,
                   help="top-p / nucleus sampling (default 0.85)")
    p.add_argument("--speed", type=float, default=1.0,
                   help="speaking-rate multiplier (default 1.0)")
    p.add_argument("--no-text-splitting", dest="text_splitting",
                   action="store_false",
                   help="disable sentence text-splitting (default: enabled)")
    p.set_defaults(text_splitting=True)
    return p.parse_args()


def load_manifest(path: str) -> list:
    if not os.path.isfile(path):
        raise SystemExit(f"tts_xtts: manifest not found: {path}")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            items = json.load(fh)
    except Exception as exc:
        raise SystemExit(f"tts_xtts: manifest is not valid JSON ({exc}): {path}")
    if not isinstance(items, list):
        raise SystemExit("tts_xtts: manifest must be a JSON array of items")
    return items


def validate_item(item: dict) -> None:
    item_id = item.get("id")
    for field in ("ref", "text", "out"):
        if not item.get(field):
            raise SystemExit(f"tts_xtts: item {item_id!r} is missing required field {field!r}")
    if not os.path.isfile(item["ref"]):
        raise SystemExit(f"tts_xtts: item {item_id!r} reference wav not found: {item['ref']}")
    if not str(item["text"]).strip():
        raise SystemExit(f"tts_xtts: item {item_id!r} has empty text — nothing to synthesise")


def load_model(device: str):
    """Imports coqui-tts and loads XTTS on `device`. Raises on import problems."""
    try:
        import torch  # noqa: F401  (used for device detection by the caller)
        from TTS.api import TTS
    except Exception as exc:  # pragma: no cover - import-time env problem
        raise SystemExit(
            f"tts_xtts: failed to import coqui-tts/torch ({exc}). "
            f"Install into scripts/dub/.venv-xtts — see scripts/dub/tts/README.md."
        )
    return TTS(MODEL).to(device)


def synth_one(tts, item: dict, gen_kwargs: dict) -> None:
    """Synthesises one manifest item. Raises on any failure (caller names the id)."""
    tts.tts_to_file(
        text=str(item["text"]).strip(),
        speaker_wav=item["ref"],
        language=item.get("lang", "en"),
        file_path=item["out"],
        **gen_kwargs,
    )
    if not os.path.isfile(item["out"]) or os.path.getsize(item["out"]) == 0:
        raise RuntimeError(f"no output produced at {item['out']}")


def main() -> int:
    args = parse_args()
    items = load_manifest(args.manifest)
    if not items:
        log("manifest is empty — nothing to do")
        return 0

    # Validate everything (and ensure out dirs exist) before loading the heavy
    # model, so a bad manifest fails fast and cheap.
    for item in items:
        validate_item(item)
        os.makedirs(os.path.dirname(os.path.abspath(item["out"])) or ".", exist_ok=True)

    # Generation kwargs threaded into every tts_to_file call (the anti-ramble levers).
    gen_kwargs = {
        "repetition_penalty": args.repetition_penalty,
        "temperature": args.temperature,
        "length_penalty": args.length_penalty,
        "top_k": args.top_k,
        "top_p": args.top_p,
        "speed": args.speed,
        "enable_text_splitting": args.text_splitting,
    }

    import torch

    # XTTS has ops that may be unsupported on the MPS backend; prefer mps but
    # fall back to cpu the first time a synthesis errors, then stay on cpu.
    device = "mps" if torch.backends.mps.is_available() else "cpu"

    log(
        f"loading {MODEL} on {device} "
        f"(repetition_penalty={args.repetition_penalty}, temperature={args.temperature}, "
        f"top_k={args.top_k}, top_p={args.top_p}, length_penalty={args.length_penalty}, "
        f"speed={args.speed}, text_splitting={args.text_splitting})…"
    )
    tts = load_model(device)
    log(f"device={device} ({len(items)} item(s))")

    for item in items:
        item_id = item.get("id")
        out = item["out"]
        if not args.force and os.path.isfile(out) and os.path.getsize(out) > 0:
            log(f"[{item_id}] cached (skip)")
            continue

        start = time.time()
        try:
            synth_one(tts, item, gen_kwargs)
        except Exception as exc:
            # Fall back mps -> cpu ONCE, reload the model on cpu, retry, then
            # stay on cpu for the rest of the batch.
            if device == "mps":
                log(f"[{item_id}] mps synthesis failed ({exc}); retrying batch on cpu")
                device = "cpu"
                try:
                    tts = load_model(device)
                    synth_one(tts, item, gen_kwargs)
                except Exception as exc2:
                    raise SystemExit(
                        f"tts_xtts: synthesis failed for id {item_id} on cpu after mps fallback: {exc2}"
                    )
            else:
                raise SystemExit(f"tts_xtts: synthesis failed for id {item_id} on cpu: {exc}")

        log(f"[{item_id}] elapsed={time.time() - start:.1f}s -> {out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
