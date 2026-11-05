---
name: create-feature-video
description: Record an annotated demo video of a Mongoose Studio feature with Puppeteer, using the local UI and a debug Chrome. Use when asked to record, script, or update a feature video, demo, or walkthrough.
---

# Create a feature video

Feature videos are Puppeteer scripts in `videos/` that drive the real local UI and record it with `page.screencast()`.
Use `videos/recordSyncIndexes.js` as the template: copy it, then replace `record()` with the steps of the new demo.

## Prerequisites

- Mongoose Studio running on `localhost:3333/studio`, serving the code you want to show.
- Chrome started with `--remote-debugging-port=9222`.
- `ffmpeg` on the `PATH`.
- `puppeteer` is already in `devDependencies`.
  Install with `PUPPETEER_SKIP_DOWNLOAD=1`, because the script attaches to the debug Chrome and doesn't need its own browser.

## Before writing the script

1. Check that both services are up, and that the served `app.js` contains the feature.
2. Read the current state through the API without changing anything.
   A demo often runs real actions against the local database, so know what it will change.
3. Make sure the demo has real data worth showing.
   The sync indexes demo uses 5M seeded users (`npm run seed -- 5000000`) so that the progress bars are visible.
4. If the demo can only run once, add a `--reset` flag that undoes exactly what the demo changes, and nothing else.
   Retakes are expected, so plan for them.
   Have the script refuse to start if there is nothing to demo.

## How the script works

- **Connect:** use `puppeteer.connect({ browserURL, defaultViewport: null })` and open a new tab, so the user's tabs stay untouched.
  Close the tab in a `finally`.
- **Viewport:** set 1920x1080 with `page.setViewport()`, then call `page.bringToFront()`.
- **Keep painting:** call `page.emulateFocusedPage(true)`.
  Without it, one take froze partway through.
- **Record:** start `page.screencast()` after the page loads, so the video doesn't begin on a blank page.
- **Seekable output:** Puppeteer pipes the video, so the file has no duration.
  Record to a raw file, then run `ffmpeg -i raw.webm -c copy final.webm`.
- **Cursor:** screencasts don't capture the mouse.
  Draw an SVG cursor in the page, move it with a CSS transition, and send real clicks with `page.mouse`.
- **Annotations:** [`neat-annotations`](https://neat-annotations.syabro.com/) is CSS only, and works by wrapping elements.
  Wrapping would break elements that Vue owns, so position an empty `.ann` span over the target with `position: fixed`.
  Add a light background to the label so it stays readable on top of the page.
- **Zoom:** apply a CSS `transform` to `<body>` with a transition, and hide overflow on `<html>` to prevent scrollbars.
  Append the cursor and annotations to `<html>`, otherwise the zoom scales them too.
  Modals are `position: fixed`, so they zoom with `<body>`.

## Pitfalls we hit

- **Clear annotations before the click, not after.**
  Otherwise the note sits on top of whatever the click opens.
- **Don't let annotations cover controls.**
  Pick a direction that keeps the label off nearby buttons.
  The direction class is where the arrow points, so `ann-n` puts the label below the target.
- **Aim the cursor at where the target ends up.**
  If a zoom and a cursor move run together, compute the target's final position instead of reading it mid-transition.
- **Account for the current zoom.**
  `getBoundingClientRect()` includes the current transform, so remove it before computing the next zoom.
  `offsetWidth` and `offsetHeight` aren't affected.
- **Move off a tight zoom right after a click that opens something elsewhere.**
  Waiting leaves the new element cut off at the edge of the screen.
- **Know what the UI does on its own.**
  For example, the sync indexes modal closes itself on success.
- **Don't anchor annotations to temporary UI.**
  The success tick fades out, so the final annotation targets the row instead.
- **Set the format explicitly.**
  Puppeteer defaults to WebM even when the path ends in `.mp4`, so record WebM and convert afterward.
- **Allow for encoding time.**
  `recorder.stop()` can take 20 seconds or more, so don't use a short timeout.

## Verify every take

A clean exit doesn't mean the video is good.
A frozen take still has the right duration, because `stop()` pads the end with the last frame.

Decode the whole video and confirm that the frames keep changing:

```sh
ffmpeg -v error -i video.webm -vf "fps=1,scale=160:-1" frames/%03d.png
md5sum frames/*.png | awk '{print $1}' | sort | uniq -c | sort -rn | head -1
```

A count above 1 means a repeated frame, so look at where it happens.
A demo can legitimately pause on one screen, so judge that by the script's timing.

Then build a contact sheet, and actually look at it:

```sh
ffmpeg -v error -ss 4 -t 3 -i video.webm -vf "fps=5,scale=480:-1,tile=4x4" -frames:v 1 sheet.png
```

Check the moments around every click, zoom, and annotation at 4-5 frames per second, because many problems last under a second.
Decode from the start rather than seeking if a frame looks wrong, and make sure the sampled window really covers the moment you changed.

## Finish

1. Run the script's `--reset` so the local database is back where it started.
2. Confirm that no tab or `ffmpeg` process was left behind.
3. Convert to MP4 if needed:

```sh
ffmpeg -i video.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart video.mp4
```

Write recordings to `~/Videos/mongoose-studio`.
`videos/` only contains the code that generates them.
