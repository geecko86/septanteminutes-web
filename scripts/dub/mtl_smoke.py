import sys, time, os
import torch
import torchaudio as ta

# perth.PerthImplicitWatermarker is None in this install (optional backend missing);
# fall back to the no-op DummyWatermarker so the smoke test can run. Watermarking is
# not relevant to evaluating multilingual synthesis quality.
import perth
if getattr(perth, "PerthImplicitWatermarker", None) is None:
    perth.PerthImplicitWatermarker = perth.DummyWatermarker
    print("[smoke] patched perth.PerthImplicitWatermarker -> DummyWatermarker", flush=True)

from chatterbox.mtl_tts import ChatterboxMultilingualTTS, SUPPORTED_LANGUAGES

OUT = "/Users/geecko/Documents/JS/septanteminutes-web/.dub-cache/38"
REF = os.path.join(OUT, "ref-smoke.wav")

device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"[smoke] device={device}", flush=True)
print(f"[smoke] supported langs ({len(SUPPORTED_LANGUAGES)}): {SUPPORTED_LANGUAGES}", flush=True)

t0 = time.time()
model = ChatterboxMultilingualTTS.from_pretrained(device=device)
print(f"[smoke] model loaded in {time.time()-t0:.1f}s", flush=True)

cases = [
    ("fi", "Hyvää huomenta, tervetuloa kuuntelemaan tätä jaksoa.", "mtl-smoke-fi.wav"),
    ("fr", "Bonjour et bienvenue dans cet épisode du podcast.", "mtl-smoke-fr.wav"),
    ("en", "Good morning and welcome to this episode of the podcast.", "mtl-smoke-en.wav"),
]

for lang, text, fname in cases:
    try:
        t1 = time.time()
        wav = model.generate(
            text,
            language_id=lang,
            audio_prompt_path=REF,
            exaggeration=0.5,
            cfg_weight=0.5,
            temperature=0.8,
        )
        path = os.path.join(OUT, fname)
        ta.save(path, wav, model.sr)
        dur = wav.shape[-1] / model.sr
        print(f"[smoke] OK lang={lang} file={path} audio_dur={dur:.2f}s elapsed={time.time()-t1:.1f}s", flush=True)
    except Exception as e:
        import traceback
        print(f"[smoke] FAIL lang={lang}: {type(e).__name__}: {e}", flush=True)
        traceback.print_exc()

print("[smoke] done", flush=True)
