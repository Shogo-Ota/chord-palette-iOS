# src/modules

Expo Custom Native Module（Swift）と、その TypeScript ラッパを置く。

想定モジュール:
- `chord-audio/` — AVAudioEngine / AVAudioSequencer（コード試聴・同期ループ・音色/テンポ/音量/伴奏、オフラインレンダリング）
- `chord-video-export/` — AVFoundation / AVAssetWriter（9:16 1080×1920 MP4、音と表示の同期）

ルール: `npx create-expo-module --local` で作成。TS API は完全に型定義し、Native呼び出しは `services/` かこのラッパ経由に限定。Expo Go では動かないため Phase 2 以降は Development Build を使う。
