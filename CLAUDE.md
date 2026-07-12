# Agent Quartet Harness

## エージェント・オーケストレーション

このハーネスは4つのサブエージェントによるパイプラインで開発を進める。

### パイプライン

```
@planner → @generator → @designer → @evaluator
                ↑                        │
                └── 不合格時のフィードバック ──┘
```

### 各エージェントの役割

| エージェント | 役割 | 入力 | 出力 |
|---|---|---|---|
| `@planner` | 仕様策定 | ユーザーの短いプロンプト | `/docs/spec.md`, `/docs/sprints/sprint-N.md` |
| `@generator` | 機能実装 | スプリント契約 | 動作するコード + 完了報告 |
| `@designer` | UI仕上げ | デザイントークン + 参考画像 + Generator の出力 | スタイル適用済みコード + 完了報告 |
| `@evaluator` | QAテスト | スプリント契約 + Playwright MCP | 合格 or 不合格（修正指示付き） |

### スプリント実行手順

各スプリントは以下の順序で実行する。**順序を飛ばしてはならない。**

#### 1. 計画フェーズ（初回のみ）
- `@planner` にプロダクトの概要を渡す
- `/docs/spec.md` と `/docs/sprints/sprint-N.md` が生成される
- ユーザーが確認・承認してから次へ進む

#### 2. 実装フェーズ
- `@generator` に対象スプリント番号を指示する
- Generator は `/docs/sprints/sprint-N.md` の契約条件を全て満たすコードを書く
- UIは機能的に必要な最低限でよい（Designer が磨く）

#### 3. デザインフェーズ
- `@designer` に対象スプリント番号を指示する
- Designer は以下を読み込んでUIを仕上げる:
  - `/docs/design-tokens.md` — デザイントークン
  - `/docs/design-references/` — 参考画像
  - Generator の完了報告
- **機能を壊してはならない**

#### 4. 評価フェーズ
- `@evaluator` に対象スプリント番号を指示する
- Evaluator は Playwright MCP で実際にアプリを操作してテストする
- 判定基準:
  - スプリント契約の全条件を満たしているか
  - デザイン4基準（デザインの質、オリジナリティ、クラフト、機能性）が閾値以上か
  - エッジケースで壊れないか

#### 5. フィードバックループ（不合格時）
- Evaluator が不合格を出した場合、修正指示に従って該当エージェントに戻す:
  - **機能の不具合** → `@generator` に戻す
  - **デザインの問題** → `@designer` に戻す
- 修正後、再度 `@evaluator` で評価する
- **合格するまでこのループを繰り返す**
- 合格したら次のスプリントへ進む

### ファイル構成

```
/docs/
├── spec.md                    # 製品仕様書（Planner が生成）
├── design-tokens.md           # デザイントークン（ユーザーが用意）
├── design-references/         # 参考画像（ユーザーが用意）
│   └── *.png / *.jpg
└── sprints/
    ├── sprint-1.md            # Sprint 1 計画と契約
    ├── sprint-2.md            # Sprint 2 計画と契約
    └── ...
```

### ルール

- スプリントは必ず番号順に実行する。Sprint 2 を Sprint 1 より先に実行してはならない
- Evaluator が合格を出すまで次のスプリントに進んではならない
- 各エージェントは自分の責務範囲外の作業をしてはならない:
  - Planner は実装詳細に踏み込まない
  - Generator は仕様変更をしない
  - Designer は機能追加・ロジック変更をしない
  - Evaluator は自分でコードを修正しない
- デザイントークンと参考画像が `/docs/` に存在しない場合、Designer フェーズの前にユーザーに用意を依頼する
