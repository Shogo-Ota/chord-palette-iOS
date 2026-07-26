# Cursor Subagent / Rules 設計（Phase 4）

実装コード変更は含まない。提案と配置案のみ。

---

## 1. Subagent 構成

| Subagent | 責務 | 読む正本 | 触ってよいもの | 触ってはいけないもの |
|---|---|---|---|---|
| **music-theory-reviewer** | コード定義・テンション・度数・移調・表示/intervals/MIDI 一致 | `project/docs/music/*`（Theory〜Transposition） | レビューコメント、KB 修正提案 | 伴奏 Swift の勝手な改変、仕様なき候補追加 |
| **groove-reviewer** | Piano/Bass/Drum・Velocity/Timing/Humanize/Swing | `Groove.md` 以下 + `src/lib/performance/` | プロファイル設計レビュー | 原曲 MIDI の製品コードへのコピー |
| **knowledge-builder** | KB 更新・カタログ追記・用語統一 | 全 `project/docs/music/` | markdown 仕様書のみ | ランタイム実装の直接変更（実装は別エージェント） |
| **implementation-reviewer** | 層分離・型安全・テスト・アーキテクチャ規約 | `architecture.mdc`, ArchitectureReport, DataModel/Test 設計 | 実装 PR レビュー | 音楽的正誤の最終判断（theory/groove に委譲） |

既存 Quartet（planner/generator/designer/evaluator）は製品 UI スプリント用。  
上記4つは **音楽プラットフォーム変更用の専門レビュアー** として並列運用する。

---

## 2. 自動ルーティング（提案）

変更パスに応じて必須 Reviewer を起動する。

| 変更パス / キーワード | 必須 Reviewer |
|---|---|
| `src/data/music.ts`, `src/lib/voicing.ts`, `src/lib/transpose.ts`, `project/docs/music/{Theory,Chord*,Interval*,Extension*,Altered*,Roman*,Scale*,Transposition*,Voicing*}` | music-theory-reviewer |
| `modules/chord-audio/**`, `groove`, `accompaniment`, `DrumProvider`, `Humanize`, `project/docs/music/{Groove,Velocity,Timing,Piano*,Drum*,Humanize*}` | groove-reviewer |
| `project/docs/music/**` の追加・改訂 | knowledge-builder（先行）→ 関連 reviewer |
| `src/lib/**`, `src/types/**`, `**/__tests__/**`, ネイティブ橋 | implementation-reviewer |
| テンション候補 + MIDI | music-theory-reviewer **かつ** implementation-reviewer |
| 伴奏 + 理論跨ぎ | groove-reviewer **かつ** music-theory-reviewer |

Cursor Rules 例（擬似）:

```markdown
# music-change-routing
If diff touches chord/MIDI/tension/voicing docs or code → run music-theory-reviewer.
If diff touches groove/accompaniment/drum/humanize → run groove-reviewer.
Never implement music changes without updating project/docs/music/ first.
```

---

## 3. Rules 構成（提案配置）

```text
.cursor/rules/
  architecture.mdc          … 既存（層分離）
  workflow.mdc              … 既存
  typescript.mdc            … 既存
  music-knowledge.mdc       … NEW: KB が正、実装前更新必須
  music-theory-gates.mdc    … NEW: 表示/intervals/MIDI 一致、12キー
  groove-gates.mdc          … NEW: コピー禁止、プロファイル駆動
  agent-routing.mdc         … NEW: 上記ルーティング
```

### music-knowledge.mdc（骨子）

- 音楽仕様の正は `project/docs/music/`
- コード・テンション・伴奏の変更 PR は KB 差分を含める
- 要件書と矛盾する場合は実装せず選択肢を提示

### music-theory-gates.mdc（骨子）

- セブンスは別タブ
- アボイドで候補を消さない（Phase 5 方針）
- symbol / display / intervals / MIDI の一致テスト必須

### groove-gates.mdc（骨子）

- 原曲 MIDI/フレーズの直置き禁止
- 抽象特徴のみ KB / profile へ
- Preview と Export の決定論的一致

---

## 4. Subagent 定義ファイル（提案）

```text
.cursor/agents/
  music-theory-reviewer.md
  groove-reviewer.md
  knowledge-builder.md
  implementation-reviewer.md
```

各ファイルに: 目的 / 入力 / 出力フォーマット（合格・不合格・要KB更新）/ 参照パス。

---

## 5. Phase 4 完了条件

- [x] 4 Reviewer の責務とルーティングを文書化
- [ ] （承認後）`.cursor/agents/*.md` と Rules 実ファイルを追加

本 Phase では **提案文書まで**（実ファイル追加は承認後でも可）。
