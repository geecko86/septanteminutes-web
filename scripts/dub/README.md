# Dubbing pipeline (proof of concept)

FR → EN dubbing for *Septante Minutes Avec* episodes using
[Kyutai Hibiki](https://github.com/kyutai-labs/hibiki), a local speech-to-speech
model that translates French speech into English **while preserving each
speaker's voice**.

Hibiki was trained on segments of at most 120 s (40 s of context), so a full
~70-minute episode cannot be dubbed in one pass. `dub.mjs` splits the episode
into chunks of at most 90 s, cutting at natural silences (using the word
timestamps from the cached ASR), translates each chunk on its own, then
concatenates the English chunks back into a single mp3.

> **License / scope.** Hibiki is released under **CC-BY-4.0** and supports
> **French → English only**. This is a proof of concept, not a production
> feature.

## Prerequisites

### 1. ffmpeg + ffprobe

```bash
brew install ffmpeg
```

### 2. Python venv with moshi_mlx

Hibiki runs locally via the `moshi_mlx` package (Apple-Silicon MLX backend).
Create a venv inside this directory and install it:

```bash
python3 -m venv scripts/dub/.venv
scripts/dub/.venv/bin/pip install -U moshi_mlx
```

`dub.mjs` defaults to `scripts/dub/.venv/bin/python`; override with `--python`
if your interpreter lives elsewhere. The first run downloads the Hibiki weights
from Hugging Face (`kyutai/hibiki-2b-mlx-bf16` or `…-1b-…`) and caches them.

### 3. A transcribed episode

The dub step reuses the transcription caches — it never re-downloads audio or
re-charges ElevenLabs. Make sure the episode has been transcribed first so both
the source mp3 (`.transcripts-cache/audio/{num}.mp3`) and the ASR cache
(`.transcripts-cache/asr/{num}.json`) exist:

```bash
yarn transcribe <num>
```

## Usage

```bash
node scripts/dub/dub.mjs <episodeNum> [options]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--cfg-coef <n>` | `3` | Voice-similarity knob passed straight to Hibiki. Higher = closer to the original voice. |
| `--model <2b\|1b>` | `2b` | Hibiki checkpoint. `2b` → `kyutai/hibiki-2b-mlx-bf16`, `1b` → `kyutai/hibiki-1b-mlx-bf16`. `1b` is faster/lighter. |
| `--max-chunk-sec <n>` | `90` | Hard cap per chunk (must stay `< 120`). |
| `--clip <a>:<b>` | — | Process only the `[a, b]` second range. Great for a quick sanity run; the output filename notes the range. |
| `--python <path>` | `scripts/dub/.venv/bin/python` | The venv python that has `moshi_mlx`. |
| `--force` | off | Recompute chunk artifacts even if they already exist. |

### Quick sanity run (first 60 seconds)

```bash
node scripts/dub/dub.mjs 95 --clip 0:60
# -> .dub-cache/95/en.clip-0-60.mp3
```

### Full episode

```bash
node scripts/dub/dub.mjs 95
# -> .dub-cache/95/en.mp3
```

### Lighter / faster model, stronger voice match

```bash
node scripts/dub/dub.mjs 95 --model 1b --cfg-coef 4
```

## How it works

1. **Ensure source audio** — reuses `downloadAudio()` from the transcribe
   pipeline (cached mp3, no re-download).
2. **Plan chunks** — reads `.transcripts-cache/asr/{num}.json`, walks the
   word timings, and cuts at the largest inter-word silence near the 90 s cap so
   boundaries land in pauses, never mid-word. `--clip` restricts this first.
3. **Extract** — `ffmpeg -ss/-to` carves each chunk out of the source mp3 into
   `.dub-cache/{num}/src-{i}.wav` (PCM; Hibiki resamples internally).
4. **Translate** — runs `python -m moshi_mlx.run_inference <src> <out> --hf-repo
   <repo> --cfg-coef <n>` per chunk, **sequentially** (GPU/compute-bound), into
   `.dub-cache/{num}/en-{i}.wav`. Subprocess output is streamed live.
5. **Concatenate** — ffmpeg's concat demuxer joins the English chunks into
   `.dub-cache/{num}/en[.clip-a-b].mp3` at 128 kbps, then prints the dubbed
   duration next to the source duration for comparison.

The pipeline is **resumable and idempotent**: existing `src-{i}.wav` and
`en-{i}.wav` are skipped unless `--force`. Re-running after an interruption only
processes the chunks that are missing.

All artifacts live under `.dub-cache/` (gitignored).

---

# ElevenLabs Dubbing (hosted alternative)

`dub-elevenlabs.mjs` is a second proof of concept that dubs episodes with the
**[ElevenLabs Dubbing API](https://elevenlabs.io/docs/api-reference/dubbing)**
(the "cascade" approach) instead of local Hibiki. The whole clip is dubbed
server-side in one hosted call: ElevenLabs separates the speakers, translates,
and re-synthesises while preserving each voice — in any supported language
pair, not just FR → EN.

> **Paid, hosted.** Every run **spends ElevenLabs credits** (billed on the
> dubbed audio duration). Use `--clip` for sanity checks, and note that the
> output is cached so a re-run with the same options is free unless `--force`.

## Prerequisites

- **ffmpeg + ffprobe** on PATH (`brew install ffmpeg`).
- **`ELEVENLABS_API_KEY`** in `.env.local` at the repo root (gitignored), e.g.
  `ELEVENLABS_API_KEY=sk_...`. The script picks this up automatically under a
  plain `node` invocation (it shares the transcribe pipeline's secrets loading);
  if the variable is unset it also falls back to parsing `.env.local` then
  `.env`. The key value is never printed.
- A **cached source mp3** — run `yarn transcribe <num>` first (no ASR cache is
  needed here, only the audio). The script never re-downloads audio already in
  `.transcripts-cache/audio/{num}.mp3`.

## Usage

```bash
node scripts/dub/dub-elevenlabs.mjs <episodeNum> [options]
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--clip <a>:<b>` | — | Dub only the `[a, b]` second range. The output filename notes the range. Strongly recommended for test runs. |
| `--target <lang>` | `en` | Target language code passed to the API. |
| `--source <lang>` | `fr` | Source language code passed to the API. |
| `--num-speakers <n>` | `2` | Number of speakers to separate. |
| `--force` | off | Re-run the (paid) dub even if the cached output already exists. |

### Quick sanity run (a 60-second window)

```bash
node scripts/dub/dub-elevenlabs.mjs 84 --clip 184:244
# -> .dub-cache/84/eleven-en.clip-184-244.mp3
```

### Full episode into Spanish, 3 speakers

```bash
node scripts/dub/dub-elevenlabs.mjs 84 --target es --num-speakers 3
# -> .dub-cache/84/eleven-es.mp3
```

## How it works

1. **Ensure source audio** — reuses `downloadAudio()` from the transcribe
   pipeline (cached mp3, no re-download).
2. **Prepare the clip** — with `--clip`, `ffmpeg -ss/-to` carves the window out
   of the source mp3 into `.dub-cache/{num}/eleven-src[.clip-a-b].mp3`; without
   `--clip`, the full cached mp3 is sent as-is.
3. **Submit** — `POST /v1/dubbing` as multipart/form-data (`xi-api-key` header;
   fields `file`, `target_lang`, `source_lang`, `num_speakers`, `mode=automatic`).
   The response's `dubbing_id` and `expected_duration_sec` are logged.
4. **Poll** — `GET /v1/dubbing/{id}` every ~5 s until `status: "dubbed"`
   (failing on `"failed"` or an `error` field), with a 10-minute timeout.
5. **Download** — `GET /v1/dubbing/{id}/audio/{target}` is written to
   `.dub-cache/{num}/eleven-{target}[.clip-a-b].mp3`, then the dubbed duration is
   printed next to the source clip length for comparison.

The output is **cached**: re-running with the same options skips the paid call
unless `--force`. All artifacts live under `.dub-cache/` (gitignored).
