# src/lib (domain)

UI・外部サービスに依存しない**純粋ロジック**を置く。単体テスト可能に保つ。

- `env.ts` — 型付き環境変数アクセサ（expo-constants経由）
- `logger.ts` — 構造化ロガー
- `errors.ts` — アプリ共通エラー階層（ユーザー向け/開発者向けメッセージ分離）
- 今後: `music/`（ダイアトニック・転調・コード計算）、`limits/`（16小節・投稿上限判定）

依存の向き: `app → features → lib`。`lib` は他層へ依存しない。
