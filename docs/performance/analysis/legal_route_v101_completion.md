# 合法ルート伴奏分析（v1.01）完了報告

- 完了日: 2026-08-03
- 計画: 合法ルートでのジャンル伴奏分析（無断 MIDI 不使用／GMD 保留）

## やったこと

| # | 項目 | 成果物 / 変更 |
|---|---|---|
| 1 | スタイル UI 洗練 | `StyleCardGrid.tsx`, `groove.tsx` |
| 2 | 試聴・再生安定化 | `audioService.play` 直列化、試聴文言。メモ: `playback_stability_v1.md` |
| 3 | 低音だけ調査 | `bass_only_investigation_v1.md` + Ballad bassOnly 抑制 |
| 4 | ピアノ／エレピ調査 | `piano_epiano_sound_survey_v1.md` |
| 5 | Baseline 評価 | `baseline_quality_eval_v1.md` |
| 6 | Ballad/Band/City 聴感改善 | `ballad.ts` / `eightBeat.ts` / `sixteenBeat.ts` / `feel/profiles.ts`、City→`beat16` |
| 7 | 公開 MIDI 表確定（取得なし） | `docs/data_collection/public_accompaniment_datasets.md` |
| 8 | GMD 保留 | `gmd_acquisition.md` に将来タスク明記 |

## Reference Songs → HYPOTHESIS

- `docs/style_datasets/ballad_teacher.md`
- `docs/style_datasets/band_teacher.md`
- `docs/style_datasets/city_teacher.md`

（スタイル全体のメモ。曲単位のコピー採譜なし）

## やらなかったこと（計画どおり）

- 教師プレイリスト曲の無断 MIDI 取得・解析
- 曲名からの実測風断定
- GMD の追加解析・本番ドラム値反映
- 公開データセットの取り込みパイプライン投入

## 次（任意）

- Dev Client 実機でスタイル連打・長時間再生の確認
- エレピ／ベース用の合法データが現れたら表を更新し、取得フェーズを別契約で開始
