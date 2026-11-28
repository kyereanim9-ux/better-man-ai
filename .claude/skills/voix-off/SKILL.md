---
name: voix-off
description: The owner's saved voice-over and background-music recipe for videos (ElevenLabs). Use whenever a video, film, animation, promo clip, Reel/TikTok or explainer needs a voice-over, narration, "voix off", background music or "musique de fond", or when the user says "avec la voix habituelle", "la même voix", "nos voix". Gives the exact voice IDs, model, script style, sync method, music prompt, ducking and loudness settings so every video sounds the same.
---

# Voix off et musique — la recette de la maison

The owner chose these voices once and wants them reused **every time**. Don't
search for a new voice unless they ask for a different one.

## Saved voices (ElevenLabs)

| Use | Name | voice_id | Notes |
|---|---|---|---|
| **Default narrator (French, female)** | Julia – Warm French Narrator | `mNu8EQcIlFZdOJs7yfhe` | Warm, soft, calm, Parisian. Used for « Ma juste place » (nov. 2026). |

- Model: **`eleven_v4`** (supports tags like `[warmly]`, `[softly]`, `[pause]`, `[long pause]`).
- One take per clip: `generations_count: 1`. Never call a generation twice to retry (it charges twice).
- If the user asks for a male voice or another language, find one with
  `creative_list_voices` (pass `languages`), then **add a row to this table** so it is kept too.

Load the ElevenLabs tools with ToolSearch first:
`select:mcp__ElevenLabs__creative_create_flow,mcp__ElevenLabs__creative_generate_speech,mcp__ElevenLabs__creative_generate_in_flow,mcp__ElevenLabs__creative_get_flow_run_status`

## Writing the script

- French. Match the audience: **tu** for personal/coaching content (Better Man AI, carnets),
  **vous** for the church AV team app. Ask if unclear.
- One short paragraph **per scene** (2–15 s each). Short sentences; `…` and `[pause]` for breathing room.
- Start each clip with one tone tag: `[softly]` for intimate/emotional lines, `[warmly]` for explanation and the call to action.
- Only facts from the user's material. No invented prices, links, guarantees or testimonials;
  if a call to action needs a link or price the user did not give, say « Lien en bio » and tell them.

## Workflow (one clip per scene, then sync the video to the voice)

1. `creative_create_flow` (name it after the video) and pass its `flow_id` to every call.
2. `creative_generate_speech` for each scene (voice + model above). Several can start at once;
   ElevenLabs queues some ("concurrency limit… retrying") — just keep polling.
3. Poll `creative_get_flow_run_status` until `all_completed`; download each `content_url`
   with `curl -s -o public/vo/N.mp3 "<url>"` (URLs expire after a few hours).
4. Measure each clip, and find the pauses to time on-screen text:
   ```bash
   ffprobe -v error -show_entries format=duration -of csv=p=0 public/vo/N.mp3
   ffmpeg -hide_banner -i public/vo/N.mp3 -af silencedetect=n=-35dB:d=0.25 -f null - 2>&1 | grep -oE "silence_(start|end): [0-9.]+"
   ```
5. Scene length (frames at 30 fps) = `15 lead + clip × 30 + ~30 tail` (more on the last scene for the fade-out).
   Start each clip 15 frames into its scene. Make text appear when its words are spoken
   (`15 + seconds × 30`).

In Remotion, inside each scene's sequence:
```tsx
<Sequence from={VO_LEAD} layout="none">
  <Audio src={staticFile(`vo/${i + 1}.mp3`)} />
</Sequence>
```

## Background music

Default: one track for the whole video, a few seconds longer than it, model **`eleven_music_v2_5`**
via `creative_generate_in_flow` (`node_type: "music"`, `generations_count: 1`, ~900 credits for 90 s).
Prompt used and liked:

> Soft, intimate cinematic instrumental, about N seconds long, no vocals. Gentle felt piano melody over
> warm ambient string pads and a subtle airy texture, slow tempo around 70 BPM, tender and hopeful.
> Starts very quiet and introspective, slowly grows warmer with light cello in the middle, then resolves
> into a luminous, uplifting ending. Calm, elegant, ideal as background under a spoken voice-over.

ElevenLabs may still tag the track "not instrumental": tell the user to listen once for singing.

**Ducking** (music lowers under the voice, fades in/out) — volume callback on the music `<Audio>`:
```tsx
const MUSIC_HIGH = 0.38, MUSIC_LOW = 0.13; // VO_SECONDS = measured clip lengths
const musicVolume = (f: number) => {
  let start = 0, duck = 0;
  for (let i = 0; i < SCENES.length; i++) {
    const a = start + VO_LEAD, b = a + VO_SECONDS[i] * 30;
    duck = Math.max(duck, Math.min(
      interpolate(f, [a - 12, a], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      interpolate(f, [b, b + 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })));
    start += SCENES[i] - TRANSITION;
  }
  const total = start + TRANSITION;
  const fade = Math.min(interpolate(f, [0, 30], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(f, [total - 60, total - 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  return (MUSIC_HIGH - (MUSIC_HIGH - MUSIC_LOW) * duck) * fade;
};
// <Audio src={staticFile("music.mp3")} volume={musicVolume} />
```

## Final loudness (always)

Remotion's mix comes out quiet (~-28 LUFS). After rendering, bring it to social-media level:
```bash
ffmpeg -y -i in.mp4 -c:v copy -af loudnorm=I=-15:TP=-1.5:LRA=11 -c:a aac -b:a 192k -ar 48000 out.mp4
```

## Tell the owner

- Which voice was used, and the approximate credits spent (voice ≈ 100–270 credits per clip, music ≈ 900).
- That you cannot listen to the audio yourself, so they should listen once before publishing.
