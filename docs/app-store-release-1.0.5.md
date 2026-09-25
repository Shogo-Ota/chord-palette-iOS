# App Store Release 1.0.5

Status: Binary uploaded — not submitted for review (blocked on 1.0.4 leaving review)
Prepared: 2026-09-25
Version/build: `1.0.5 (34)`

Build 33 was uploaded and then superseded. It carried an `AUGMENTED TRIAD` group that
listed all twelve roots, which is three cards for each of the four augmented
pitch-class sets — `Caug`, `Eaug` and `A♭aug` are the same three notes. That is a chord
type dumped into a tab whose other groups all present a technique with a named target,
so it was pulled rather than shipped. Augmented returns in a later release as a
voice-leading connector that names the chord it resolves to.
Release candidate detail: [release-1.0.5-checklist.md](release-1.0.5-checklist.md)

Production build:
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/d28bd4eb-1911-4ee4-82f6-b4401f90946c

EAS submission:
https://expo.dev/accounts/shogoota/projects/chord-palette/submissions/81868bc5-1bcc-4cc8-866d-a14f57d19458

`1.0.4 (32)` was submitted on 2026-09-14 and is Waiting for Review. App Store Connect
will not accept a `1.0.5` version record until that version is approved, released,
rejected or removed from review. Uploading the binary is independent of that, so
build 34 goes to TestFlight and can be signed off on a device now. Creating the
`1.0.5` version and submitting for review are the only steps left, and both belong to
the owner.

## What's New — Japanese

Palette Pro に、コード1件ごとの伴奏スタイル変更を追加しました。

- 配置したコードを長押しし、そのコード1件だけ伴奏スタイルを変更できるようになりました
- Block・Natural・Variation・Arpeggio の8種類から選べ、「全体のSTYLEを使用」でいつでも戻せます
- 選んだスタイルは保存され、再生・MIDI書き出し・動画書き出しのすべてに反映されます

## What's New — English

Palette Pro gains a per-chord accompaniment style.

- Long-press a placed chord to change the accompaniment style for that one chord
- Choose from eight styles across Block, Natural, Variation and Arpeggio, and return
  to the project style at any time
- The choice is saved and carries through playback, MIDI export and video export

## Promotional Text

The 170-character slot that updates without review. Full history lives in
[app-store-listing.md](app-store-listing.md) §3.

Japanese (76 characters):

```
思いついたコード進行を、その場で鳴らして・並べて・縦動画に。コード1件だけ伴奏の弾き方を変えられるようになり、進行の表情をより細かく作り込めます。
```

English (139 characters):

```
Sketch a chord progression, hear it instantly, and share it as a 9:16 video. Now change the way a single chord in the progression is played.
```

## App Review Notes

Existing notes in [app-store-listing.md](app-store-listing.md) §8 still apply
(no sign-in, Palette Pro is a ¥500/month auto-renewing subscription, no microphone
use, photo library access is only for saving exported videos).

This update's one new feature is Palette Pro. A reviewer who does not purchase will
reach the paywall rather than the feature, which is intended. The note added to §8 for
this release spells out where the entry point is, because the per-chord style lives
inside a long-press menu rather than on a visible control.

Suggested test path for this update:

1. Open the editor and enter `C | Am | F | G`.
2. Without purchasing, long-press `F` and choose 「このコードの伴奏STYLEを変更」.
   The paywall appears and no style is applied.
3. Purchase or restore Palette Pro with a Sandbox account. The editor returns with `F`
   still selected and the style picker reopened. No style is applied automatically.
4. Set `F` alone to `Arpeggio Type 1`. The card shows `Arp` on its degree line, and on
   playback only `F` changes how it is played.
5. Change the project style from the Style screen. C, Am and G follow it; `F` keeps
   Arpeggio.
6. Choose 「全体のSTYLEを使用」 for `F`. The badge disappears and `F` follows the
   project style again.
7. Export MIDI and the video, and confirm both match what the app plays, including the
   position where the style changes.

## Submission Checks

- [x] `expo.version` set to `1.0.5`
- [x] Paywall perk text matches what actually ships
- [x] `app-store-listing.md` description, Pro section and review notes updated
- [x] Augmented triad group pulled from the 応用 tab, and every mention of it removed
      from the paywall, the store description and the review notes
- [x] What's New text drafted in Japanese and English
- [x] Promotional text drafted in Japanese and English
- [x] Sandbox purchase and restore verified on Preview build `2e8fa4ff`
- [x] Production build created — `1.0.5 (34)`
- [x] Production build uploaded to App Store Connect
- [ ] Apple processing completed
- [ ] `1.0.4` has left review, so version `1.0.5` can be created
- [ ] Version `1.0.5` created and the build attached in App Store Connect
- [ ] What's New text entered
- [ ] Promotional text updated
- [ ] `palette_pro_monthly` confirmed still available for sale
- [ ] RevenueCat current Offering confirmed to resolve the monthly package
- [ ] App Privacy answers re-checked — no new collection ships in this update
- [ ] Export compliance answered by `ITSAppUsesNonExemptEncryption: false`
- [ ] Content-rights declaration confirmed
- [ ] Release option confirmed
- [ ] Submitted for App Review
- [ ] Screenshots — optional refresh showing the per-chord style badge. Can be updated
      during review or after release without a new build
- [ ] Owner device sign-off on the production build through TestFlight
- [ ] Review outcome recorded here
