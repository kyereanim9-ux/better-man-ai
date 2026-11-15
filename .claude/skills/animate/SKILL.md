---
name: animate
description: Turn one sentence into a painterly animated short film package - story, reference-sheet image prompts, and one timestamped master video prompt with a style lock. Use when the user types /animate followed by an idea, or asks for an animated short film, an animated clip from an idea, or prompts for one.
---

# Animated short film from one sentence

Input: one sentence with the idea (the text after `/animate`). If there is no
idea, ask for one sentence and nothing else.

This skill **writes**; it does not generate. Images and the clip are made in
the user's image and video tools. Only generate them yourself when the user
asks for it and a connected generator actually works — check first, tell the
credit cost before spending, and say plainly when a generator refuses instead
of presenting a slideshow of stills as animation.

## Folder

Work in an `animated-short-film/` folder (create what is missing):

- `prompts/` — one saved package per film, `<film-slug>.md`
- `references/` — the user's generated plates (character, locations, objects)
- `renders/` — clips that come back from the video tool
- `final/` — accepted masters

## The package (one Markdown file, in this order)

1. **Title and idea** — a short title, then the user's sentence, lightly cleaned.
2. **Story** — 3 to 5 numbered beats for a 10–15 second film, no dialogue
   unless asked. One character, at most two locations, one clear change from
   first beat to last. Say in one line how the change is *shown* (light,
   colour, weather, distance) — the video model can show that; it cannot show
   thoughts.
3. **Style lock** — one paragraph, pasted unchanged into every prompt: medium
   and texture, lighting, palette, lens feel, grain, aspect ratio, mood, and
   "no text, no logos, no watermark". Default look is painterly (gouache/oil
   brushwork, cinematic light) unless the user names another style. Never name
   a living artist, a studio or an existing film as the style.
4. **Character sheet prompt** — age range, hair, face, build, exact clothes and
   shoes, on one sheet: front full body, three-quarter close-up, side profile,
   neutral background, even light. Give the character a first name and reuse
   the same description word for word everywhere.
5. **Location sheet prompt(s)** — one per location, wide establishing view,
   **no people**, with the props the story needs already in place and in the
   state the story needs (e.g. "picture frame lying face down").
6. **Object sheet prompt(s)** — only for objects the story turns on.
7. **Master video prompt** — starts with the style lock, then one line fixing
   the character's look, then timestamped shots that add up exactly to the
   duration (`0:00–0:03 — …`). Each shot: framing, what moves, camera move,
   light. End with an audio line (music, two or three sounds, voice or no
   voice) and the duration and aspect ratio in the heading.

Keep every prompt self-contained: a person must be able to paste it alone.

## After writing

- Save the package to `prompts/<film-slug>.md` and show the user the file.
- Tell them the order: generate the sheets first, check them against the
  story, then run the master video prompt with the sheets attached as
  references.
- When plates come back, save them in `references/` with numbered names, look
  at each one, and name any detail that contradicts the story before the user
  spends a video generation on it.
- When a clip comes back, save it in `renders/`; finishing work (trim, music,
  titles, joining clips) can be done locally with `ffmpeg`, and the accepted
  result goes in `final/`.
