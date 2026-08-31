# Browser playback fixture

`playable.mp4` is a generated 3-second H.264 test pattern (320 × 180, 10 fps),
with no third-party content. It lets the browser regression test verify an actual
decoded video and advancing playback time instead of a fabricated MP4 header.
The E2E upload endpoint remains a protocol stub; a real G7 upload is a separate
acceptance check.

Regenerate with FFmpeg:

```bash
ffmpeg -f lavfi -i testsrc2=size=320x180:rate=10 -t 3 -c:v libx264 -pix_fmt yuv420p -movflags +faststart tests/fixtures/playable.mp4
```
