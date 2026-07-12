# Chord Palette — Agent Quartet Harness

Claude Code のサブエージェント4体によるスプリント駆動開発ハーネス。

```
@planner → @generator → @designer → @evaluator
                ↑                        │
                └── 不合格時のフィードバック ──┘
```

## 4つのエージェント

| エージェント | 役割 | model |
|---|---|---|
| **@planner** | 短いプロンプトから製品仕様書とスプリント計画を生成 | opus |
| **@generator** | スプリント契約に基づいてコードを実装 | opus |
| **@designer** | デザイントークンと参考画像でUIを仕上げ | opus |
| **@evaluator** | Playwright MCP で実操作テスト・合否判定 | opus |

## セットアップ

1. `.claude/agents/` と `CLAUDE.md` がプロジェクトに配置済み
2. デザイントークンを `/docs/design-tokens.md` に用意する
3. 参考画像を `/docs/design-references/` に配置する

## 使い方

### 1. 計画

```
@planner コード進行を試せる音楽アプリを作りたい。
```

### 2. 実装

```
@generator Sprint 1を実装して
```

### 3. デザイン

```
@designer Sprint 1のデザインを仕上げて
```

### 4. 評価

```
@evaluator Sprint 1を評価して
```

Evaluator が合格を出したら次のスプリントへ。不合格なら修正指示に従って該当エージェントに戻す。

## ファイル構成

```
Chord Palette/
├── CLAUDE.md                      # オーケストレーションルール
├── .claude/agents/
│   ├── planner.md                 # 仕様策定エージェント
│   ├── generator.md               # 実装エージェント
│   ├── designer.md                # デザインエージェント
│   └── evaluator.md               # QAエージェント
└── docs/
    ├── spec.md                    # 製品仕様書（Planner が生成）
    ├── design-tokens.md           # デザイントークン（ユーザーが用意）
    ├── design-references/         # 参考画像（ユーザーが用意）
    └── sprints/
        ├── sprint-1.md
        ├── sprint-2.md
        └── ...
```

## 前提条件

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) が使える環境
- Playwright MCP サーバーの設定（Evaluator・Designer が使用）

## アプリ開発（Expo / React Native）

iPhone向け音楽制作アプリ「Chord Palette」本体の開発情報。開発PCは **Windows のみ**を前提とし、実機検証は Expo Go（Phase 0-1）→ EAS Development Build（Phase 2 以降）で行う。

### 技術スタック

- Expo SDK 54 / React Native 0.81 / TypeScript（strict）/ Expo Router
- ローカル保存: expo-sqlite / expo-file-system（Phase 1）
- Native: Expo Custom Native Module + Swift（AVAudioEngine / AVAssetWriter, Phase 2-3）
- Convex / Clerk / RevenueCat / PostHog / Sentry（Phase 4 以降）

### セットアップ

```bash
npm install --legacy-peer-deps
cp .env.example .env   # 値は各フェーズで追記（未設定でも起動可）
npm start              # Expo Go の QR をスキャンして実機表示
```

### スクリプト

| コマンド | 内容 |
|---|---|
| `npm start` | Expo 開発サーバー起動 |
| `npm run lint` | ESLint（`expo lint`） |
| `npm run format` / `format:check` | Prettier 整形 / 検査 |
| `npm run typecheck` | `tsc --noEmit` 型チェック |
| `npm test` / `test:watch` | Jest 単体・統合テスト |

### ディレクトリ構成（層分離）

```
src/
├── app/            # 画面（Expo Router）。薄く保つ
├── features/       # 機能単位のロジック・hook・部品
├── services/       # 外部SaaS抽象化（billing/analytics/auth/backend…）
├── repositories/   # データアクセス（sqlite / Convex）
├── lib/            # 純粋ロジック（env/logger/errors、今後 music など）
├── modules/        # Expo Custom Native Module（Swift）ラッパ
├── components/     # 汎用UI（ErrorBoundary 等）
├── theme/          # デザイントークン
├── data/           # 音楽データ（music.ts）
└── types/          # 共通型
```

依存の向き: `app → features → (services / repositories) → lib`。各層の責務は各ディレクトリの `README.md` を参照。

### 環境変数

- クライアント同梱値は `EXPO_PUBLIC_*` 接頭辞のみ。`app.config.ts` の `extra` に渡り、`src/lib/env.ts` から型付きで参照する（`process.env` を画面で直接読まない）。
- 秘密鍵（R2 / 各サービスのサーバーシークレット）はクライアントに埋め込まない。`.env` はコミットしない。

### Phase 2A: ネイティブ音声モジュール（`modules/chord-audio`）

Phase 2A から、独自 Swift 製の音声エンジンを Expo Custom Native Module として追加した。**Expo Go では動作しない**（ネイティブモジュールが未リンクのため）。EAS Development Build が必要。

- ネイティブ実装: `modules/chord-audio/ios/*.swift`（AVAudioEngine による同期再生 / ループ / 3系統ミキサー）
- TS ラッパ: `modules/chord-audio`（`@modules/chord-audio` で import）
- サービス層: `src/services/audio`（`audioService` 経由でのみ利用。音量の正典は SQLite）
- 純粋ロジック/テスト: `src/services/audio/schedule.ts` ＋ `__tests__/schedule.test.ts`
- 検証専用画面: `src/app/dev-audio.tsx`（ルート `/dev-audio`。本番導線からは非表示）
- 音源は**技術検証用の合成音**（`SynthInstrumentProvider` / `SynthDrumProvider`）。Phase 2B で `InstrumentProvider` / `DrumProvider` を通じてサンプル音源へ交換する。

詳細な設計・API・同期基準・AVAudioSession 設定は `docs/sprints/sprint-2.md` を参照。

### EAS Development Build（Windows → iPhone 実機）

Windows PC には Xcode が無いため、クラウドの EAS Build で Development Build を作成し、実機へインストールする。以下は**ユーザー本人の操作が必要**な手順（対話・認証を含む）。

```bash
# 1. EAS CLI（未導入なら）
npm install -g eas-cli

# 2. Expo アカウントにログイン（ブラウザ/対話）
eas login

# 3. プロジェクトを EAS に紐付け（初回のみ。projectId を app に書き込む）
eas init

# 4. iOS Development Build を作成（Apple ログイン・端末UDID登録・証明書はここで対話）
eas build --profile development --platform ios
#   - Apple Developer アカウントでのログインを求められる
#   - 実機の UDID 登録（未登録なら eas device:create で QR から登録）
#   - Distribution Certificate / Provisioning Profile は EAS に生成・管理させてよい

# 5. ビルド完了後、表示される QR / URL から iPhone にインストール

# 6. 開発サーバーを Dev Client 用に起動して接続
npx expo start --dev-client
```

`eas.json` に `development` / `preview` / `production` プロファイルを定義済み。`development` は `developmentClient: true` / 内部配布 / 実機向け（simulator=false）。

## ライセンス

MIT
