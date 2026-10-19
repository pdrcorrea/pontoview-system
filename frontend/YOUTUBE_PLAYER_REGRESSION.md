# YouTube playback regression guard

The player uses a fresh YouTube embed iframe for each playlist cycle. Commit `578e1fe` adds an explicit `playVideo()` call from the IFrame API `onReady` event. This change requires Android-TV validation and must not yet be described as production-tested.

## Invariants

- Do not reintroduce the global `youtube-autoplay.js` or `youtubeAutoplayGuard.ts` interceptors into the player bootstrap. The localized YouTube IFrame API inside YouTubeStage is used only to start the video explicitly.
- Recreate the iframe on each playlist item rotation; never reuse an old YouTube iframe. Start the video explicitly in `onReady`.
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
