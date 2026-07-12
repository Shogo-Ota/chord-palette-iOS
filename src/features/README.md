# src/features

画面固有のロジック・hook・サブコンポーネントを機能単位で置く。`src/app` の画面はここを呼ぶだけの薄い層にする。

想定モジュール: `editor/` `player/` `projects/` `presets/` `export/` `paywall/` `community/` `auth/` `moderation/`

ルール: 課金・認証・分析・Native呼び出しは直書きせず `services/` や hook を経由する。
