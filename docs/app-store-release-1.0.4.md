# App Store Release 1.0.4

Status: Submitted — Waiting for Review (2026-09-14)
Prepared: 2026-09-13
Version/build: `1.0.4 (32)`
Release candidate detail: [release-1.0.4-checklist.md](release-1.0.4-checklist.md)

Production build:
https://expo.dev/accounts/shogoota/projects/chord-palette/builds/ae369dff-1922-4d42-b128-972d832cfdba

EAS submission:
https://expo.dev/accounts/shogoota/projects/chord-palette/submissions/2e27aa22-30e2-4815-907e-f2cdafd6e441

## What's New — Japanese

動画出力に新しいビジュアル「フロー」を追加しました。

- 演奏したノートが上から鍵盤へ落ちていく「フロー」を追加
- コード名の近くにディグリーを表示し、進行の役割が一目で伝わるように
- トニック・サブドミナント・ドミナントの色をクラシックとフローで統一
- MIDI書き出しのファイル名が、選択した伴奏スタイルと一致するよう修正
- Variation / Dance の終盤の響きを、前半のフレーズと同じ密度に調整

## What's New — English

This update adds Flow, a new look for video export.

- Added Flow, where the performed notes fall from above onto the keyboard
- Added the degree next to the chord name so a progression's role reads at a glance
- Unified the tonic, subdominant and dominant colours across Classic and Flow
- Fixed exported MIDI file names so they match the selected accompaniment style
- Balanced the closing bars of Variation / Dance with the phrase before them

## Promotional Text

The 170-character slot that updates without review. Full history lives in
[app-store-listing.md](app-store-listing.md) §3.

Japanese (84 characters):

```
思いついたコード進行を、その場で鳴らして・並べて・縦動画に。新ビジュアル「フロー」はノートが鍵盤へ落ち、ディグリー表示で進行の役割まで伝わります。キー変更もワンタップ。
```

English (153 characters):

```
Sketch a chord progression, hear it instantly, and share it as a 9:16 video. The new Flow style drops your notes onto the keyboard and names each degree.
```

## App Review Notes

Existing notes in [app-store-listing.md](app-store-listing.md) §8 still apply
(no sign-in, Palette Pro is a ¥500/month auto-renewing subscription, no
microphone use, photo library access is only for saving exported videos).

Suggested test path for this update:

1. Open the editor and enter `F | G | Em | Am`.
2. Set tempo to 140 BPM, instrument to Piano, and audition accompaniment styles
   including Variation / Dance.
3. Open Export, choose the Classic visual style and export the video.
4. Export again with the Flow visual style and confirm the notes land on the
   keyboard in time with the audio.
5. Export MIDI and confirm the file name carries the selected style, e.g.
   `chord-palette-Variation-Dance-Piano-140bpm-F-G-Em-Am-{timestamp}.mid`.

## Submission Checks

- [x] Production build uploaded to App Store Connect
- [x] Apple processing completed
- [x] Version `1.0.4` created and build 32 attached in App Store Connect
- [x] What's New text entered
- [x] Promotional text updated
- [x] App description and keywords remain accurate
- [x] App Privacy answers reviewed against the shipping build (crash diagnostics
      and product analytics only)
- [x] Export compliance answered by `ITSAppUsesNonExemptEncryption: false`
- [x] `palette_pro_monthly` subscription remains review-ready
- [x] Content-rights declaration confirmed
- [x] Release option confirmed
- [x] Submitted for App Review — Waiting for Review
- [ ] Screenshots — the video-export cut may be refreshed with Flow. Optional,
      and it can be updated during review or after release without a new build
- [ ] Owner device sign-off on build 32 through TestFlight. Still worth doing
      while the version waits for review: the submission can be withdrawn from
      App Store Connect if anything is wrong
- [ ] Review outcome recorded here
