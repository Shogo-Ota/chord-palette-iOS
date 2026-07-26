# Ground Truth MIDI（正解データ台帳）

Chord Palette のグルーヴ方向性を決める **最終教師** の台帳。  
OSS（GMD 等）は土台。**オーナーの耳が選んだ MIDI が優先**する。

---

## 1. ルール

1. 製品コードに生ノート列を埋め込まない（コピー禁止）  
2. 抽出するのは抽象特徴のみ（Velocity / Timing / 長さ / 分散 / 低音 / ストラム / シンコペ / 休符）  
3. 1 エントリ = 1 教材（ファイルまたは明確なフレーズ範囲）  
4. 追加時は `Groove.md` §6.1 チェックリストを埋め、関連 KB を更新してから実装する  
5. ライセンス・帰属を必ず記録する（第三者 MIDI の再配布・製品同梱はしない）

---

## 2. 置き場

| 種類 | パス |
|---|---|
| 教材 MIDI（ローカル） | オーナー Downloads 等（**リポジトリにコミットしない**） |
| 特徴 JSON（抽象のみ） | `docs/midi-references/*.features.json` |
| 本台帳 | `project/docs/music/GroundTruthMidi.md` |

解析ツール: `tools/analyze_ground_truth_midi.py`

---

## 3. 登録一覧

### GT-000 — Good Song Chords Top 10（10 曲集計）
- Status: **reflected**（リズム骨格のみ）— `src/lib/performance/styles/naturalComp.ts` ほか
  Natural bank 3 種のヒット位置。強弱・タイミング・長さは GT-001 が上書きしている。
- Source: `Good Song Chords Top 10 v20220617a.mid`（ch0 piano, ≈199 小節）
- License / Attribution: 第三者教材。**リポジトリにコミットしない**（`.mid` は削除済み）。
  解析結果 `docs/midi-references/Good_Song_Chords_Top_10.rhythm.json` のみ保持する。
- Style tags: pop, chord-comp, 90bpm hint
- Analyzed: sprint 7–8
- Features JSON: `docs/midi-references/Good_Song_Chords_Top_10.rhythm.json`
- Extracted into: `PianoPatterns.md`（4 分ボディ + & ベースの骨格）
- Notes: 抽出対象はアタック位置のみ。キー / メロディ / コード選択は学習していない。

### GT-001 — 日もすがら音楽と / Piano（Reo）
- Status: **reflected** — 測定値は `src/lib/performance/groundTruth.ts`、
  Natural feel への適用は `src/lib/performance/styles/naturalComp.ts`（ベロシティ・アクセント幅・
  ストラム幅・マイクロタイミング・ゲート。ゲートはコードとベースで別窓）。Driving / Relaxed は未適用。
- Source: `125BPM_allday_Piano.mid`  
  パス例: `...\MIDIデータ_日もすがら音楽と\125BPM_allday_Piano.mid`  
  関連: Reo - 日もすがら音楽と（Logic プロジェクト名より）
- License / Attribution: 第三者教材。**製品同梱・再配布禁止**。解析特徴のみ利用。
- Style tags: j-pop, city-pop, programmed-piano, 125bpm
- Tempo / Meter: **125 BPM**, 4/4（メタ tempo 一致）
- Length: ≈107.5 s / notes 1326
- Analyzed: 2026-07-26
- Features JSON: `docs/midi-references/GT-001_125BPM_allday_Piano.features.json`
- Extracted into: `Velocity.md`, `Timing.md`, `Accent.md`, `Humanize.md`, `PianoPatterns.md`, `Swing.md`（校正節）

#### 抽出サマリ（抽象特徴のみ）

| 項目 | 結果 |
|---|---|
| Velocity 全体 | median **73**, mean 71, range 37–100（控えめ・ダイナミックレンジ狭め） |
| Downbeat vel | median **75**, p25–p75 **68–83** |
| Upbeat vel | median **71**, p25–p75 **63–77** |
| 16 分裏 vel | median **70.5**, p25–p75 **63–77**（ダウンビートとの差が小さい） |
| Timing | 16 分グリッドに対し **median offset ≈ 0 ms**（強クオンタイズ） |
| Bass timing | mean ≈ 0 ms、外れ値 ±11–13 ms |
| Mid timing | mean ≈ **+2 ms**（わずかに後ろ）、外れ値 ±40–52 ms |
| Body − Bass | 同時発音クラスタ内: median **0**, p75 **+4 ms**, mean **+2 ms** |
| ストラム | クラスタ spread median **0**, mean **3.2 ms**, p75 **6.5 ms**, max 38 ms |
| 低音先打ち比 | **0.44**（低音先行は半分未満 → 同時押し寄り） |
| ノート長 | Bass **0.29–0.63 拍**（median 0.5）, Mid **0.21–0.50 拍**（median 0.30）— 低域が明確に長い |
| シンコペ | onset の **44% が e/a**, on-beat 36%, & 20% → **16 分駆動のピアノ** |
| 休符 | inter-onset median **0.25 拍**; ≥0.5 拍ギャップが 171 箇所 |
| 音域 | MIDI 34–91、bass(<48) 比率 **15.5%** |

#### プロダクトへの示唆

1. **ベロシティ基準を下げる**（旧仮値 95–110 はこの教材より熱すぎる）  
2. **ストラムは数 ms 級**（+8 / +15 ms 仮値は強すぎ。≈0–7 ms 帯が主）  
3. **16 分シンコペを伴奏の主役**に据える（eightBeat だけだと足りない）  
4. Humanize は **小さく**（既にクオンタイズ済みの打ち込み感）  
5. Swing は本教材では **ほぼストレート**（ratio 0.5）。ただしアナライザは swing を出力しないため、
   `groundTruth.ts` の `swingRatio` は**実測ではなく仮値**として扱う  
6. **ゲートは音域ごとに分ける**。低域と中域で音価が 1.7 倍違うため、共通レンジで揃えるとベースが切れる

---

## 4. エントリテンプレート（追加用）

```markdown
### GT-XXX — 短い名前
- Status: planned | analyzed | reflected
- Source:
- License / Attribution:
- Style tags:
- Tempo / Meter:
- Analyzed:
- Features JSON:
- Extracted into:
- Notes:
```
