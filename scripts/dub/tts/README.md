# TTS engine adapters for the dubbing cascade

`scripts/dub/cascade.mjs` is the local FR→EN dubbing **cascade**: it reuses the
cached diarized ASR, translates each utterance to English with the Claude
backend (disfluencies preserved, `$0` on the subscription), then synthesises the
English with a **per-speaker zero-shot voice clone** and reassembles a timeline.

The TTS step is pluggable. Each engine is a small Python adapter in this folder
with a **uniform CLI**, run from its **own venv**. `cascade.mjs --engine <name>`
maps to `scripts/dub/tts/tts_<name>.py` and `scripts/dub/.venv-<name>/bin/python`.

## Uniform adapter CLI contract

Every `tts_<engine>.py` MUST accept exactly this interface:

```
tts_<engine>.py --ref <wav> (--text <str> | --text-file <path>) --lang <code> --out <wav>
```

- `--ref` — a short (8–15 s) wav of the target speaker to clone (mono is fine;
  the adapter resamples as the model needs).
- `--text` / `--text-file` — the text to speak. The orchestrator passes a
  `--text-file` (a temp file) so apostrophes/quotes/newlines never hit a shell.
- `--lang` — language code (the cascade always passes `en`).
- `--out` — output wav path.

Behaviour: print the device used and elapsed seconds to **stderr**; exit
**non-zero with a clear message** on failure; produce a non-empty `--out` on
success. Keep it small and dependency-light so the next engine matches.

## Engines

### XTTS-v2 (`xtts`, default) — `tts_xtts.py`

Coqui XTTS-v2 multilingual zero-shot voice clone. Local, no API.

```bash
# from the repo root
python3 -m venv scripts/dub/.venv-xtts
scripts/dub/.venv-xtts/bin/pip install -U pip
scripts/dub/.venv-xtts/bin/pip install coqui-tts
```

`coqui-tts` is the maintained community fork of Coqui `TTS` (the original `TTS`
package is unmaintained); it installs the same `TTS.api` module the adapter
imports.

**Coqui license / first run:** XTTS-v2 is gated behind the Coqui Public Model
License. The first synthesis downloads the model (~1.8 GB) and requires
agreeing to the CPML, which is done non-interactively via the
`COQUI_TOS_AGREED=1` environment variable. The adapter sets it
(`os.environ.setdefault`) and `cascade.mjs` also exports it when spawning the
adapter, so no interactive prompt blocks the run. To run the adapter by hand:

```bash
COQUI_TOS_AGREED=1 scripts/dub/.venv-xtts/bin/python scripts/dub/tts/tts_xtts.py \
  --ref .dub-cache/38/ref-speaker_0.wav \
  --text "Uh, well, I, I think it's complicated, you know." \
  --lang en \
  --out /tmp/clone-test.wav
```

**Device / MPS:** the adapter prefers Apple `mps` when available and falls back
to `cpu` if MPS synthesis errors (some XTTS ops are unsupported on MPS),
printing which device actually ran. On Apple Silicon, expect `cpu` to be the
reliable path; it is slower but works.

## End-to-end example (PoC: episode 38, clip 2275–2346 s, 3 speakers)

```bash
# 1. ensure the ASR + audio caches exist
yarn transcribe 38

# 2. run the cascade on the PoC clip (XTTS, fit each clip to its slot)
node scripts/dub/cascade.mjs 38 --clip 2275:2346 --fit

# output: .dub-cache/38/cascade-en.xtts.clip-2275-2346.mp3
```

Artifacts land in `.dub-cache/38/`: `ref-<speaker>.wav` (+ `.txt` ref text),
`tts-<i>.wav`, optional `gap-<i>.wav` / `fit-<i>.wav`, and the final
`cascade-en.<engine>[.clip-a-b].mp3`. All of `.dub-cache/` is gitignored, and
re-runs skip existing artifacts unless `--force`.

## Adding a new engine

1. Write `tts_<name>.py` honouring the CLI contract above.
2. `python3 -m venv scripts/dub/.venv-<name>` and install its deps.
3. Register `<name>` in `cascade.mjs`'s `ENGINE_ADAPTERS` / `ENGINE_VENVS` maps.

Candidates to try next: `tts_f5.py` (F5-TTS), `tts_chatterbox.py`,
`tts_cosyvoice.py` — each reusing the same `--ref/--text/--text-file/--lang/--out`
interface so the orchestrator stays unchanged.
