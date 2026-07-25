# src/lib (domain)

UI・外部サービスに依存しない**純粋ロジック**を置く。単体テスト可能に保つ。

- `env.ts` — 型付き環境変数アクセサ（expo-constants経由）
- `logger.ts` — 構造化ロガー
- `errors.ts` — アプリ共通エラー階層（ユーザー向け/開発者向けメッセージ分離）
- `music/` — ChordDefinition カタログ・テンション候補・MIDI intervals（仕様の正は `project/docs/music/`）
- `voicing.ts` / `transpose.ts` — ボイシング・移調（music カタログを利用）

依存の向き: `app → features → lib`。`lib` は他層へ依存しない（移行中の例外は減らしていく）。
