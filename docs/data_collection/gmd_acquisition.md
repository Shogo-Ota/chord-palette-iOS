# Groove MIDI Dataset（GMD）取得手順

- 作成日: 2026-08-03
- 方針: ユーザー自作 MIDI を初期前提にしない。公式配布・明確ライセンスの人間演奏データを優先する。
- **ステータス（v1.01）: 将来タスクとして保持。追加の正当性検証・統計解析・Baseline 比較・本番ドラム値反映は行わない。** 手順・WIP コード・Profile 成果物は削除しない。

## 1. 公式配布元

| 項目 | 内容 |
|---|---|
| 公式ページ | https://magenta.withgoogle.com/datasets/groove |
| 別名 URL | https://g.co/magenta/groove-dataset / https://magenta.tensorflow.org/datasets/groove |
| TFDS | `groove/full-midionly`（https://www.tensorflow.org/datasets/catalog/groove） |
| 提供元 | Google LLC（Magenta） |
| 論文 | Gillick et al., “Learning to Groove with Inverse Sequence Transformations,” ICML 2019 |

## 2. ダウンロードするファイル

Chord Palette の Humanize 解析には **MIDI のみ版**で足りる（音声不要）。

| アーカイブ | サイズ | SHA256（公式掲載） |
|---|---|---|
| `groove-v1.0.0-midionly.zip` | 3.11 MB | `651cbc524ffb891be1a3e46d89dc82a1cecb09a57c748c7b45b844c4841dcc1e` |

フル版（MIDI+WAV）`groove-v1.0.0.zip`（約 4.76 GB）は音声研究用。本パイプラインでは不要。

## 3. ローカル配置

推奨パス（いずれか）:

```text
# A. ダウンロード直下（現在のオーナー環境で確認済み）
C:\Users\shogo\Downloads\groove-v1.0.0-midionly\groove

# B. リポジトリ外/内の開発用コピー（gitignore）
assets_dev/gmd/groove
```

展開後の必須ファイル:

- `LICENSE`（CC BY 4.0）
- `README`（公式ページへの誘導）
- `info.csv`（1150 エントリのメタデータ）
- `drummer1/` … `drummer10/`（`.mid`）

環境変数:

```bash
export GMD_ROOT="/c/Users/shogo/Downloads/groove-v1.0.0-midionly/groove"
# Windows Git Bash 例
```

## 4. ライセンス（取得時点の確認）

ローカル `LICENSE` および公式ページの記載:

> Creative Commons Attribution 4.0 International (CC BY 4.0)

| 項目 | 判断 |
|---|---|
| 商用利用 | **可**（CC BY 4.0。帰属表示が必要） |
| 改変・派生 | **可**（統計プロファイルへの変換は派生の一種） |
| 再配布 | 元 MIDI の再配布はライセンス上可能だが、**アプリ・リポジトリには同梱しない**（社内ポリシー） |
| 帰属 | Google LLC / Magenta / 論文 citation を `docs` と Profile JSON に記録 |

**注意**: CC BY は「利用可」であって「帰属なし」ではない。アプリ内に Profile を載せる段階で Attribution 文言を製品ドキュメントへ入れる。

## 5. 解析パイプラインの実行

```bash
# 統計プロファイル生成（元 MIDI はコミットされない）
GMD_ROOT="C:/Users/shogo/Downloads/groove-v1.0.0-midionly/groove" \
GMD_PROFILE_WRITE=1 \
npx jest gmdPipeline
```

出力: `docs/performance/humanize/gmd_drum_profile_v1.json`（MEASURED 統計のみ）

## 6. やらないこと

- 元 `.mid` を git / アプリバンドルへ入れる
- ライセンス未確認ミラーからの取得
- GMD からベース／ピアノ Humanize を推定する
- エンジン本番値への自動書き込み（Profile 生成まで。統合は別フェーズ）
