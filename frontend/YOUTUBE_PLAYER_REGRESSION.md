# YouTube playback regression guard

The current production-tested approach uses a fresh YouTube embed iframe for each playlist cycle. Reference commits: `534506d8` (timed iframe implementation) and `e5418106` (remove obsolete autoplay interceptor).

## Invariants

- Do not reintroduce the YouTube IFrame API wrapper, `youtube-autoplay.js`, or `youtubeAutoplayGuard.ts` into the player bootstrap.
- Recreate the iframe on each playlist item rotation; never reuse an old YouTube iframe.
- Preserve per-content mute/controls/start/end settings. Browser autoplay policy may block audible playback; do not claim guaranteed unmuted autoplay.
- The playlist duration is enforced by PontoView even when the YouTube embed does not emit lifecycle events.
- Changes to the player must avoid extra polling or backend requests.

## Minimum manual regression checks before merging player changes

1. A YouTube live item plays on first appearance after opening the player.
2. The same live item plays again on its second and third playlist cycles without clicking Play or refreshing the page.
3. Each item advances at its configured duration, including a blocked/unavailable embed.
4. Check both content settings: sound enabled and muted, plus browser autoplay limitations.
5. Verify another item type plays correctly before and after YouTube.
6. Repeat on Chrome and Android TV when feasible.

Avoid claiming successful production playback solely on the basis of a passing build.
