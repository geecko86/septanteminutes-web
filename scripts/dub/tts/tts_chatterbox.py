#!/usr/bin/env python3
"""Chatterbox MULTILINGUAL zero-shot voice-clone adapter for the dubbing cascade.

This adapter uses Resemble AI's ChatterboxMultilingualTTS: the per-item `lang`
field (passed to the model as `language_id`) selects the OUTPUT language the
cloned voice speaks. Languages must be in `chatterbox.SUPPORTED_LANGUAGES` (23,
incl. 'en', 'fr', 'fi'); an item with an unsupported lang aborts the run.

Batch-manifest CLI contract (shared by the manifest-based tts_<engine>.py adapters):

    tts_chatterbox.py --manifest <path.json> [--force]

The manifest is a JSON array of items:

    {"id": int,
     "ref": "<abs path to reference wav>",
     "ref_text": "<source-language transcript of the reference>",
     "text": "<text to speak in the target language>",
     "lang": "en",            # output language (language_id); default "en"
     "out": "<abs path to output wav>",
     "exaggeration": float,   # optional, per-item emotion knob (0..1-ish)
     "cfg_weight": float,     # optional, per-item CFG weight
     "intensity": float}      # optional, source intensity (logged only)

The model is loaded ONCE, then every item is synthesised: `text` is spoken in
the item's `lang` in the voice cloned from `ref`, written to `out`. Items whose
`out` already exists are skipped unless --force. The device used is printed to
stderr once; each item prints `[<id>] elapsed=<s>s` plus the expressiveness
knobs it used. On a synthesis failure we exit non-zero with a message naming the
failing id.

EMOTION-ADAPTIVE expressiveness: if a manifest item carries `exaggeration`
(and/or `cfg_weight`), the adapter uses THAT value for that item, overriding
the global default; the global default (--exaggeration/--cfg-weight flags or
CHATTERBOX_EXAGGERATION/CHATTERBOX_CFG env) is the per-knob fallback when an
item omits a value. Knobs are still gated by the installed generate()
signature, so only supported knobs are ever passed.

Device: defaults to `auto`, resolving to Apple `mps` when available, else `cpu`
(override via CHATTERBOX_DEVICE=auto|cpu|mps). MPS is made safe by setting
PYTORCH_ENABLE_MPS_FALLBACK=1 before torch is imported (without it the first
synth deadlocks). If synthesis still errors on mps the model is reloaded on cpu
and retried, reporting which device ran.

Chatterbox ignores `ref_text` (it clones zero-shot from `ref` audio alone); the
field is part of the shared contract and used by other engines (e.g. F5).

First run downloads the model weights from HuggingFace — that is expected.
Install into scripts/dub/.venv-chatterbox — see scripts/dub/tts/README.md.
"""

import argparse
import inspect
import json
import os
import sys
import time

# MPS needs the CPU fallback enabled BEFORE torch is imported anywhere, else the
# first synth deadlocks (a hang, not an error). setdefault so an explicit env
# value from the caller still wins.
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")


def log(msg: str) -> None:
    print(f"[tts_chatterbox] {msg}", file=sys.stderr, flush=True)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Chatterbox voice-clone TTS adapter (batch manifest)")
    p.add_argument("--manifest", required=True, help="path to the batch manifest JSON")
    p.add_argument("--force", action="store_true", help="re-synthesise items whose out already exists")
    # Optional Chatterbox generation knobs. These are applied only if the
    # installed ChatterboxTTS.generate() actually accepts them (guarded below),
    # so the adapter never hard-depends on a particular version's signature.
    # Defaults can be overridden via env (so the cascade, which only passes
    # --manifest, can still steer expressiveness): CHATTERBOX_EXAGGERATION,
    # CHATTERBOX_CFG. Resemble's expressive preset is exaggeration~0.7 + cfg~0.3.
    p.add_argument("--exaggeration", type=float,
                   default=float(os.environ.get("CHATTERBOX_EXAGGERATION", "0.5")),
                   help="emotion/intensity knob (if supported by the installed version)")
    p.add_argument("--cfg-weight", dest="cfg_weight", type=float,
                   default=float(os.environ.get("CHATTERBOX_CFG", "0.5")),
                   help="classifier-free guidance weight (if supported)")
    return p.parse_args()


def load_manifest(path: str) -> list:
    if not os.path.isfile(path):
        raise SystemExit(f"tts_chatterbox: manifest not found: {path}")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            items = json.load(fh)
    except Exception as exc:
        raise SystemExit(f"tts_chatterbox: could not parse manifest {path}: {exc}")
    if not isinstance(items, list):
        raise SystemExit("tts_chatterbox: manifest must be a JSON array of items")
    for it in items:
        for key in ("id", "ref", "text", "out"):
            if key not in it:
                raise SystemExit(f"tts_chatterbox: manifest item missing '{key}': {it!r}")
    return items


def main() -> int:
    args = parse_args()
    items = load_manifest(args.manifest)

    try:
        import torch  # noqa: F401  (used for device detection)
        import torchaudio
        import chatterbox
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    except Exception as exc:  # pragma: no cover - import-time env problem
        raise SystemExit(
            f"tts_chatterbox: failed to import chatterbox-tts/torch ({exc}). "
            f"Install into scripts/dub/.venv-chatterbox — see scripts/dub/tts/README.md."
        )

    import torch

    # Output languages this build can speak (e.g. 'en','fr','fi'). Each item's
    # `lang` (default "en") is validated against this BEFORE any synthesis runs,
    # so an unsupported language aborts up front rather than mid-batch.
    supported_langs = set(getattr(chatterbox, "SUPPORTED_LANGUAGES", ()) or ())
    if supported_langs:
        for it in items:
            lang = (it.get("lang") or "en").strip().lower()
            if lang not in supported_langs:
                raise SystemExit(
                    f"tts_chatterbox: [{it.get('id')}] unsupported language "
                    f"'{lang}' — supported: {sorted(supported_langs)}"
                )

    # Which optional generation knobs does THIS installed version accept? We
    # only ever pass knobs present in the installed signature (the guard), so
    # the adapter never hard-depends on a particular version.
    try:
        gen_params = set(inspect.signature(ChatterboxMultilingualTTS.generate).parameters)
    except (TypeError, ValueError):
        gen_params = set()

    # EMOTION-ADAPTIVE expressiveness: the cascade may stamp a per-item
    # `exaggeration` (and `cfg_weight`) onto each manifest item, derived from
    # that utterance/turn's emotional intensity, so calm lines are voiced flat
    # and heated ones dramatically. When an item carries a value we use THAT for
    # that item; otherwise we fall back to the global default (CLI flag / env:
    # CHATTERBOX_EXAGGERATION, CHATTERBOX_CFG). The fallback is also applied
    # per-knob, so an item can override exaggeration while inheriting the global
    # cfg_weight (or vice versa).
    global_knobs = {}
    if "exaggeration" in gen_params:
        global_knobs["exaggeration"] = args.exaggeration
    if "cfg_weight" in gen_params:
        global_knobs["cfg_weight"] = args.cfg_weight
    log(f"generation knobs (global default): {global_knobs or '(none accepted by this version)'}")

    def knobs_for(it: dict) -> dict:
        """Per-item generation knobs: each item's own value when present, else
        the global default. Only knobs accepted by the installed generate() are
        included (the signature guard)."""
        knobs = {}
        if "exaggeration" in gen_params:
            val = it.get("exaggeration")
            knobs["exaggeration"] = float(val) if val is not None else args.exaggeration
        if "cfg_weight" in gen_params:
            val = it.get("cfg_weight")
            knobs["cfg_weight"] = float(val) if val is not None else args.cfg_weight
        return knobs

    # Device override via CHATTERBOX_DEVICE env (auto|cpu|mps). Default is
    # `auto`, resolving to mps when available — safe now that
    # PYTORCH_ENABLE_MPS_FALLBACK=1 is set at import time (the env-fallback stops
    # the first-synth deadlock). The mps->cpu reload-and-retry below remains as a
    # safety net for any op that still errors on mps.
    dev_env = os.environ.get("CHATTERBOX_DEVICE", "auto").strip().lower()
    if dev_env == "mps":
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    elif dev_env == "auto":
        device = "mps" if torch.backends.mps.is_available() else "cpu"
    else:
        device = "cpu"
    log(f"device={device} (CHATTERBOX_DEVICE={dev_env})")

    def load_model(dev: str):
        log(f"loading ChatterboxMultilingualTTS on {dev} (first run downloads weights from HuggingFace)…")
        # Some installs ship a broken `perth` where PerthImplicitWatermarker is
        # None (optional deps failed), which crashes ChatterboxTTS.__init__. The
        # watermarker is irrelevant for this PoC, so no-op it when missing.
        try:
            import perth
            if getattr(perth, "PerthImplicitWatermarker", None) is None:
                class _NoWatermark:
                    def apply_watermark(self, wav, sample_rate=None, **kw):
                        return wav
                    def get_watermark(self, *a, **k):
                        return None
                perth.PerthImplicitWatermarker = _NoWatermark
                log("perth watermarker missing -> no-op shim installed")
        except Exception:
            pass
        # from_pretrained(device) takes device positionally in this version.
        return ChatterboxMultilingualTTS.from_pretrained(dev)

    model = load_model(device)

    def synth(it: dict, dev: str) -> None:
        # Per-item knobs (emotion-adaptive): item value when present, else global.
        knobs = knobs_for(it)
        # `language_id` is driven by the item's `lang` (default "en"); already
        # validated against chatterbox.SUPPORTED_LANGUAGES above.
        lang = (it.get("lang") or "en").strip().lower()
        wav = model.generate(
            it["text"], language_id=lang, audio_prompt_path=it["ref"], **knobs
        )
        # generate() returns a tensor at model.sr; torchaudio wants 2-D (C, N).
        if wav.dim() == 1:
            wav = wav.unsqueeze(0)
        torchaudio.save(it["out"], wav.detach().to("cpu"), model.sr)

    for it in items:
        item_id = it["id"]
        out = it["out"]
        if not args.force and os.path.isfile(out) and os.path.getsize(out) > 0:
            log(f"[{item_id}] cached (skip) -> {out}")
            continue
        if not os.path.isfile(it["ref"]):
            raise SystemExit(f"tts_chatterbox: [{item_id}] reference wav not found: {it['ref']}")
        text = (it.get("text") or "").strip()
        if not text:
            raise SystemExit(f"tts_chatterbox: [{item_id}] empty text — nothing to synthesise")
        os.makedirs(os.path.dirname(os.path.abspath(out)) or ".", exist_ok=True)

        start = time.time()
        try:
            synth(it, device)
        except Exception as exc:
            if device == "mps":
                log(f"[{item_id}] mps synthesis failed ({exc}); reloading on cpu and retrying")
                device = "cpu"
                try:
                    model = load_model(device)
                    synth(it, device)
                except Exception as exc2:
                    raise SystemExit(
                        f"tts_chatterbox: [{item_id}] synthesis failed on cpu after mps fallback: {exc2}"
                    )
            else:
                raise SystemExit(f"tts_chatterbox: [{item_id}] synthesis failed on cpu: {exc}")

        if not os.path.isfile(out) or os.path.getsize(out) == 0:
            raise SystemExit(f"tts_chatterbox: [{item_id}] no output produced at {out}")
        # Surface the emotion-adaptive knobs actually applied to this item.
        applied = knobs_for(it)
        knob_str = (
            " ".join(f"{k}={v:.2f}" for k, v in applied.items()) if applied else "default"
        )
        intensity = it.get("intensity")
        intensity_str = f" intensity={float(intensity):.2f}" if intensity is not None else ""
        log(
            f"[{item_id}] elapsed={time.time() - start:.1f}s (device={device}{intensity_str} {knob_str}) -> {out}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
