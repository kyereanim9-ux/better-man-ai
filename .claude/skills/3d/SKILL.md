---
name: 3d
description: Make, edit, view or export anything 3D. Use when the user asks for a 3D model, mesh, GLB, a 3D scene / room / stage layout, a 3D render or turntable, new camera angles of a place, a rigged or animated character, or an interactive 3D viewer on a web page or in an app. Covers the Higgsfield 3D connector tools and three.js.
---

# 3D work

Pick the path from what the user wants to end up with. Don't mix paths unless
asked, and say which one you chose in one line.

| The user wants | Path |
|---|---|
| One object as a 3D file, from a photo or drawing | A. Image → 3D mesh |
| A whole scene: room, stage, prop layout, camera, lights, render | B. Hosted 3D scene |
| New camera views of a place shown in a photo | B, location reference |
| To see or rotate a model on a page or inside the app | C. three.js viewer |

Paths A and B need the **Higgsfield** connector (`mcp__Higgsfield__*`). Its
tools are usually deferred: load them by name with ToolSearch first. If the
connector is not there, say so and offer path C or a local-Blender script;
never pretend a model was generated.

Generation spends the user's Higgsfield credits. Preflight the cost, tell the
user the number, and never resubmit a call just because the response was slow
or timed out — check the job first.

## A. Image → 3D mesh (`generate_3d`)

1. `models_explore` with `type: "3d"` to see current models, their media roles
   and parameters. Don't rely on remembered model names. Usual choices:
   - one image, general object → `image_to_3d` (optional texture, PBR, rig)
   - 2–4 views of the same object → `multi_image_to_3d` (better geometry)
   - one object lifted out of a busy photo → `sam_3_3d` (prompt names the object)
   - rig an existing GLB → `3d_rigging` (takes a public `model_url`, not a job id)
2. Get the image into Higgsfield: a local file → `media_upload`, `curl` PUT to
   the returned upload URL, `media_confirm`; a web URL → `media_import_url`.
   Pass the returned `media_id` in `medias[].value` — never a raw URL.
3. The mesh copies what is in the picture. To change props, clothing or pose,
   edit the image first (`generate_image`), then convert the edited result.
4. Call `generate_3d` with `get_cost: true`, then for real. Wait with
   `jobs_wait` (short timeouts), then show the result once.
5. Animated rigs: find a clip with `animation_actions`, pass
   `animation_action_id` with `enable_animation: true`.

## B. Hosted 3D scene (`scene_builder_3d_*`)

Always start by calling `get_preset_instructions` with
`{ "preset": "/3d-jutsu" }` and follow what it returns — it is the source of
truth and changes over time. For new angles of a supplied location also load
`/3d-jutsu/references/location-new-angles` before building anything.

What does not change:

- The scene is edited by running Blender Python (`bpy`) remotely. Query first
  (`scene_builder_3d_query_python`), never guess object names, units or APIs.
- Every write is guarded by `revision` and `expectedSceneSequence` taken from
  the latest query. One mutation at a time. On a conflict, re-query and write a
  new edit with a new `operationId`; don't replay old code.
- Work at metre scale, name objects by role (`HERO_…`, `ENV_…`, `CAM_main`,
  `LGT_key`), block out camera and lights first, then go coarse to fine.
- A successful operation only proves the code ran. Render a small preview from
  the delivery camera, fetch it with `scene_builder_3d_get_artifact`, **look at
  it**, fix the biggest visible problem, render again.
- Models come in only through `scene_builder_3d_search_assets` →
  `scene_builder_3d_import_asset`. The runtime has no network.
- Deliver with `scene_builder_3d_show_scene` once per finished revision;
  `scene_builder_3d_get_glb` / `get_blend` only when the user wants files.
  AI image/video from a render costs credits — only on request.

## C. Interactive viewer with three.js

For "show it in 3D" on a page, an Artifact, or a screen of an app.

- Load three.js as ES modules from a pinned version, e.g. an import map
  pointing `three` to `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
  and `three/addons/` to `…/three@0.160.0/examples/jsm/`. Never an unpinned URL.
- Minimum that looks right: `GLTFLoader` for `.glb`, `OrbitControls` with
  damping, a hemisphere light plus one directional light, `outputColorSpace =
  SRGBColorSpace`, frame the camera from the model's bounding box, handle
  resize, cap `devicePixelRatio` at 2, and show a plain message if WebGL or the
  file fails.
- Simple layouts (a room with speakers, screens, cameras) don't need a model
  file: build them from boxes and planes at real dimensions in metres, with
  labels, so the data in the database drives the scene.
- Check it for real: open the page in the pre-installed Playwright Chromium,
  take a screenshot, and look at it before saying it works. A blank canvas is
  the usual failure (camera inside the model, no light, wrong path).

## Before you say it is done

- You looked at a render or screenshot of the result, not just a success code.
- You told the user what it cost in credits, if anything.
- You gave the file or link in the form they asked for (GLB, image, video,
  page), and said plainly what you could not verify.
