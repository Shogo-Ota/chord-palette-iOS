# App Store Release 1.0.5

Status: Prepared — not yet submitted (blocked on 1.0.4 leaving review)
Prepared: 2026-09-25
Version/build: `1.0.5 (33 expected)`
Release candidate detail: [release-1.0.5-checklist.md](release-1.0.5-checklist.md)

Production build: pending

EAS submission: pending

`1.0.4 (32)` was submitted on 2026-09-14 and is Waiting for Review. App Store Connect
will not accept `1.0.5` until that version is approved, released, rejected or removed
from review. Everything else for this submission is ready.

## What's New — Japanese

Palette Pro に、コード1件ごとの伴奏スタイル変更と増三和音を追加しました。

- 配置したコードを長押しし、そのコード1件だけ伴奏スタイルを変更できるようになりました
- Block・Natural・Variation・Arpeggio の8種類から選べ、「全体のSTYLEを使用」でいつでも戻せます
- 選んだスタイルは保存され、再生・MIDI書き出し・動画書き出しのすべてに反映されます
- 「応用」ライブラリに増三和音を追加しました。選択中のキーの12音すべてを、メジャーとマイナーの両方で使えます

## What's New — English

Palette Pro gains a per-chord accompaniment style and augmented triads.

- Long-press a placed chord to change the accompaniment style for that one chord
- Choose from eight styles across Block, Natural, Variation and Arpeggio, and return
  to the project style at any time
- The choice is saved and carries through playback, MIDI export and video export
- Added augmented triads to the advanced library, covering all twelve roots of the
  selected key in both major and minor

## Promotional Text

The 170-character slot that updates without review. Full history lives in
[app-store-listing.md](app-store-listing.md) §3.

Japanese (88 characters):

```
思いついたコード進行を、その場で鳴らして・並べて・縦動画に。コード1件だけ伴奏の弾き方を変えられるようになり、増三和音も加わって、進行の表情をより細かく作り込めます。
```

English (152 characters):

```
Sketch a chord progression, hear it instantly, and share it as a 9:16 video. Now change the accompaniment of a single chord, and reach for augmented triads.
```

## App Review Notes

Existing notes in [app-store-listing.md](app-store-listing.md) §8 still apply
(no sign-in, Palette Pro is a ¥500/month auto-renewing subscription, no microphone
use, photo library access is only for saving exported videos).

Both features in this update are Palette Pro. A reviewer who does not purchase will
reach the paywall rather than the feature, which is intended. The two notes added to
§8 for this release spell out where each entry point is, because the per-chord style
lives inside a long-press menu and the free tier can only audition an augmented triad.

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
8. Open the 応用 tab and scroll to `AUGMENTED TRIAD`. Without Pro, tapping a card
   auditions it and shows the upgrade prompt without adding it to the progression.
9. With Pro, tap `Caug` to add or replace a chord, then play it back.

## Submission Checks

- [x] `expo.version` set to `1.0.5`
- [x] Paywall perk text matches what actually ships (augmented triads listed)
- [x] `app-store-listing.md` description, Pro section and review notes updated
- [x] What's New text drafted in Japanese and English
- [x] Promotional text drafted in Japanese and English
- [x] Sandbox purchase and restore verified on Preview build `2e8fa4ff`
- [ ] Production build created
- [ ] Production build uploaded to App Store Connect
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
