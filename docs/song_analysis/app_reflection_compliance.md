# アプリ反映コンプライアンス・チェックリスト

- 版: v1.0（2026-08-03）
- 上位: [`song_midi_analysis_policy.md`](./song_midi_analysis_policy.md)

Source MIDI → Measured → Aggregate → Design Target → App Profile の各段階で、製品へ持ち込む前に確認する。

## A. データ持ち込み

- [ ] 元 `.mid` / `.midi` がリポジトリ・アプリバンドルに含まれていない
- [ ] イベント列が原曲を復元できる粒度で App Profile に入っていない
- [ ] メロディ／リードトラックを App Profile に含めていない
- [ ] 「曲名 → その曲の伴奏」マッピングを UI / API に追加していない

## B. 抽象化

- [ ] 固有リフ・特徴的フィルがパターン ID として残っていない
- [ ] コード進行そのもの（原曲進行の固定列）をテンプレ化していない
- [ ] 相対化（拍相対・度数相対・オクターブ相対）または統計量のみである
- [ ] 1 曲だけの特徴を `MEASURED_AGGREGATE` / スタイル確定値として書いていない

## C. ラベル

- [ ] 実装値が `DESIGN_TARGET` または `App Profile` として明示されている
- [ ] 根拠に `MEASURED_SONG` / `MEASURED_AGGREGATE` / `USER_LISTENING` / `HYPOTHESIS` が追跡できる
- [ ] `HYPOTHESIS` を MEASURED と書いていない

## D. エンジン反映

- [ ] 任意のユーザー進行で破綻しない（特定原曲進行専用になっていない）
- [ ] 再生安定性を悪化させていない（ストレステスト／手動確認）
- [ ] スタイル間の差が説明可能である
- [ ] 過度な原曲類似を避けるため、意図的に丸めた／抑えた点を記録した

## E. リリース前宣言（テンプレ）

```text
本更新の伴奏パラメータは Chord Palette 独自の DESIGN_TARGET / App Profile である。
Source MIDI は内部分析のみに使用し、アプリに同梱していない。
原曲再現・曲名指定の原曲風生成は提供しない。
```

## 現状

MIDI 未提供のため、App Profile への反映候補は **なし**。本チェックリストは受領後のゲートとして使う。
