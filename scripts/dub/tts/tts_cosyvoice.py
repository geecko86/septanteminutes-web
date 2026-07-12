#!/usr/bin/env python3
"""CosyVoice 2 (Alibaba, Apache-2.0) cross-lingual voice+prosody-clone adapter.

Batch-manifest CLI contract (shared by the manifest-based tts_<engine>.py adapters):

    tts_cosyvoice.py --manifest <path.json> [--force]

The manifest is a JSON array of items:

    {"id": int,
     "ref": "<abs path to reference wav>",
     "ref_text": "<source-language transcript of the reference>",
     "text": "<english text to speak>",
     "lang": "en",
     "out": "<abs path to output wav>"}

The model is loaded ONCE, then every item is synthesised: `text` is spoken in
English in the voice cloned from `ref`, written to `out`. Items whose `out`
already exists are skipped unless --force. The device used is printed to stderr
once; each item prints `[<id>] elapsed=<s>s`. On a synthesis failure we exit
non-zero with a message naming the failing id.

WHY CosyVoice2 cross-lingual:
  We use CosyVoice2's `inference_cross_lingual(tts_text, prompt_wav)` API. Unlike
  XTTS' zero-shot clone (which only carries timbre), CosyVoice2 cross-lingual
  transfers the source speaker's PROSODY/emotion from the FR prompt audio into
  the EN synthesis. It clones from the `ref` wav ALONE (audio prompt), so it
  ignores `ref_text` — the field stays in the contract for engines like F5.

DEVICE / Apple Silicon (HONEST NOTE):
  CosyVoice2's model + frontend hardcode `torch.device('cuda' if cuda else 'cpu')`
  — there is NO MPS code path in the upstream model. On this Mac it therefore runs
  on CPU. We expose `--device {auto,cpu,mps}`: `auto`/`cpu` run the supported CPU
  path; `mps` best-effort monkey-patches the model/frontend device to mps (the
  Qwen2 LLM + flow-matching decoder may not all be MPS-compatible, so on any error
  we fall back to cpu and stay there). We print the device that actually ran.

REPO / WEIGHTS:
  CosyVoice2 is not on PyPI as the Apache-2.0 engine; it lives in the
  FunAudioLLM/CosyVoice repo (cloned to scripts/dub/.cosyvoice-repo, with its
  Matcha-TTS submodule populated). Both are injected onto sys.path below. The
  CosyVoice2-0.5B weights come from ModelScope ('iic/CosyVoice2-0.5B'); the model
  dir is resolved from --model-dir / $COSYVOICE2_MODEL_DIR / the local download /
  the ModelScope id (triggering a download on first run).

  Text frontend: ttsfrd/pynini do not build on Mac; the upstream frontend
  gracefully falls back to `wetext` (pure Python), which IS installed here.

Install into scripts/dub/.venv-cosyvoice — see scripts/dub/tts/README.md.
"""

import argparse
import inspect
import json
import os
import sys
import time

# CosyVoice forks internally; silence the HF tokenizers parallelism warning.
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

# --- Make the cloned CosyVoice repo + its Matcha-TTS submodule importable. -----
_THIS = os.path.dirname(os.path.abspath(__file__))
_REPO = os.path.join(os.path.dirname(_THIS), ".cosyvoice-repo")
_MATCHA = os.path.join(_REPO, "third_party", "Matcha-TTS")
for _p in (_REPO, _MATCHA):
    if os.path.isdir(_p) and _p not in sys.path:
        sys.path.insert(0, _p)

# This CosyVoice2 revision loads the prompt wav internally via load_wav(), which
# requires the source sample rate >= 16 kHz (it resamples to 16 k for tokens and
# 24 k for the prompt feat). The cascade-provided refs satisfy that.
PROMPT_MIN_SR = 16_000


def log(msg: str) -> None:
    print(f"[tts_cosyvoice] {msg}", file=sys.stderr, flush=True)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="CosyVoice2 cross-lingual voice+prosody clone (batch manifest)")
    p.add_argument("--manifest", required=True, help="path to the batch manifest JSON")
    p.add_argument("--force", action="store_true", help="re-synthesise items whose out already exists")
    p.add_argument("--model-dir", default=os.environ.get("COSYVOICE2_MODEL_DIR", ""),
                   help="path to a local CosyVoice2-0.5B dir (else resolved/downloaded)")
    p.add_argument("--device", choices=("auto", "cpu", "mps"), default="auto",
                   help="auto/cpu = supported CPU path; mps = best-effort, falls back to cpu on error")
    p.add_argument("--speed", type=float, default=1.0, help="speaking-rate multiplier (default 1.0)")
    return p.parse_args()


def load_manifest(path: str) -> list:
    if not os.path.isfile(path):
        raise SystemExit(f"tts_cosyvoice: manifest not found: {path}")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            items = json.load(fh)
    except Exception as exc:
        raise SystemExit(f"tts_cosyvoice: could not parse manifest {path}: {exc}")
    if not isinstance(items, list):
        raise SystemExit("tts_cosyvoice: manifest must be a JSON array of items")
    for it in items:
        for key in ("id", "ref", "text", "out"):
            if key not in it:
                raise SystemExit(f"tts_cosyvoice: manifest item missing '{key}': {it!r}")
    return items


def resolve_model_dir(cli_dir: str) -> str:
    """Find a local CosyVoice2-0.5B dir, else return the ModelScope id to download."""
    candidates = []
    if cli_dir:
        candidates.append(cli_dir)
    # Local copy alongside the repo (what setup downloads to, if local_dir honoured).
    candidates.append(os.path.join(os.path.dirname(_THIS), ".cosyvoice-models", "CosyVoice2-0.5B"))
    # Default ModelScope cache location.
    candidates.append(os.path.expanduser("~/.cache/modelscope/hub/iic/CosyVoice2-0.5B"))
    for c in candidates:
        if c and os.path.isfile(os.path.join(c, "cosyvoice2.yaml")):
            return c
    # Not found locally — return the id so CosyVoice2.__init__ triggers a download.
    return "iic/CosyVoice2-0.5B"


def patch_device(model, frontend, device: str) -> None:
    """Best-effort: move a loaded CosyVoice2 model + frontend onto `device`.

    Upstream hardcodes cuda/cpu; there is no mps path. We retarget the tensors
    so an mps attempt is at least possible. Any failure here propagates and the
    caller falls back to cpu.
    """
    import torch
    dev = torch.device(device)
    frontend.device = dev
    model.device = dev
    for attr in ("llm", "flow", "hift"):
        m = getattr(model, attr, None)
        if m is not None:
            m.to(dev)


def main() -> int:
    args = parse_args()
    items = load_manifest(args.manifest)

    try:
        import torch
        import torchaudio
        from cosyvoice.cli.cosyvoice import CosyVoice2
    except Exception as exc:  # pragma: no cover - import-time env problem
        raise SystemExit(
            f"tts_cosyvoice: failed to import CosyVoice2/torch ({exc}). "
            f"Install into scripts/dub/.venv-cosyvoice and clone the repo to "
            f"scripts/dub/.cosyvoice-repo (+ Matcha-TTS submodule) — see scripts/dub/tts/README.md."
        )

    model_dir = resolve_model_dir(args.model_dir)

    # CosyVoice2 has no MPS path upstream; cuda is unavailable on this Mac, so the
    # supported device is cpu. 'mps' is opt-in and best-effort (patched post-load).
    want_mps = args.device == "mps" and torch.backends.mps.is_available()
    device = "mps" if want_mps else "cpu"

    log(f"loading CosyVoice2 from {model_dir!r} (first run downloads weights from ModelScope)…")
    try:
        cosyvoice = CosyVoice2(model_dir, load_jit=False, load_trt=False, fp16=False)
    except Exception as exc:
        raise SystemExit(f"tts_cosyvoice: failed to load CosyVoice2 model from {model_dir!r}: {exc}")

    if device == "mps":
        try:
            patch_device(cosyvoice.model, cosyvoice.frontend, "mps")
            log("device=mps (best-effort; will fall back to cpu on synthesis error)")
        except Exception as exc:
            log(f"mps patch failed ({exc}); using cpu")
            device = "cpu"
            patch_device(cosyvoice.model, cosyvoice.frontend, "cpu")
    if device == "cpu":
        log("device=cpu (CosyVoice2 has no upstream MPS path on Apple Silicon)")

    sr = cosyvoice.sample_rate
    text_frontend = getattr(cosyvoice.frontend, "text_frontend", "")
    log(f"sample_rate={sr}, text_frontend={text_frontend or 'none'!r}, {len(items)} item(s)")

    # Does this installed inference_cross_lingual accept `speed`? (it does upstream)
    try:
        xl_params = set(inspect.signature(cosyvoice.inference_cross_lingual).parameters)
    except (TypeError, ValueError):
        xl_params = set()
    extra = {"speed": args.speed} if "speed" in xl_params else {}

    def synth(it: dict) -> None:
        # This CosyVoice2 revision's inference_cross_lingual(tts_text, prompt_wav)
        # takes prompt_wav as a FILE PATH and loads it internally (at 16 kHz for
        # speech tokens, 24 kHz for the prompt feat). We pass the ref wav path.
        chunks = []
        # inference_cross_lingual is a generator yielding {'tts_speech': [1, n]}.
        for out in cosyvoice.inference_cross_lingual(it["text"], it["ref"], **extra):
            chunks.append(out["tts_speech"])
        if not chunks:
            raise RuntimeError("model yielded no audio")
        wav = torch.cat(chunks, dim=1)  # [1, total]
        torchaudio.save(it["out"], wav.detach().to("cpu"), sr)

    nonlocal_device = {"d": device}

    for it in items:
        item_id = it["id"]
        out = it["out"]
        if not args.force and os.path.isfile(out) and os.path.getsize(out) > 0:
            log(f"[{item_id}] cached (skip) -> {out}")
            continue
        if not os.path.isfile(it["ref"]):
            raise SystemExit(f"tts_cosyvoice: [{item_id}] reference wav not found: {it['ref']}")
        text = (it.get("text") or "").strip()
        if not text:
            raise SystemExit(f"tts_cosyvoice: [{item_id}] empty text — nothing to synthesise")
        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)

        start = time.time()
        try:
            synth(it)
        except Exception as exc:
            if nonlocal_device["d"] == "mps":
                log(f"[{item_id}] mps synthesis failed ({exc}); retargeting to cpu and retrying")
                try:
                    patch_device(cosyvoice.model, cosyvoice.frontend, "cpu")
                    nonlocal_device["d"] = "cpu"
                    synth(it)
                except Exception as exc2:
                    raise SystemExit(
                        f"tts_cosyvoice: [{item_id}] synthesis failed on cpu after mps fallback: {exc2}"
                    )
            else:
                raise SystemExit(f"tts_cosyvoice: [{item_id}] synthesis failed on cpu: {exc}")

        if not os.path.isfile(out) or os.path.getsize(out) == 0:
            raise SystemExit(f"tts_cosyvoice: [{item_id}] no output produced at {out}")
        log(f"[{item_id}] elapsed={time.time() - start:.1f}s (device={nonlocal_device['d']}) -> {out}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
