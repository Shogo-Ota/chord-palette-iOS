# Playback A/B 手順（OLD 事前録音 vs NEW Realtime Sampler）

前提: **同じ Final MIDI を両エンジンで鳴らす**。違いがエンジン由来であることを保証するため、生成層は一切触らない。

## 1. 固定素材

```bash
npm run audition:playback
```

`LocalAnalysis/playback_regression/` に出力される。

| ファイル | 何を確かめるか |
| --- | --- |
| `block_type1.mid` | ブロック和音。同時発音の厚みと強奏時の潰れ |
| `ballad_type1.mid` | バラード。**v1 では 6 音が音域クランプで別の音高になる** |
| `arpeggio_type1.mid` | アルペジオ。弱音が聞こえるか |
| `velocity_test.mid` | C4 を velocity 30 / 60 / 90 / 120。音量差だけか、音色差もあるか |
| `duration_test.mid` | 同じ音を 0.25 / 1 / 4 / 6 拍。90BPM の 6 拍 = 4 秒 → **v1 は 3 秒で音が消える** |
| `sustain_test.mid` | 1 小節目はペダル下、2 小節目は素。v1 は CC64 を見ないので両者が同じに聞こえる |
| `polyphony_test.mid` | 18 音同時。ボイス落ちとクリップ |
| `manifest.json` | 各 artifact の指紋・イベント数・v1 が再現できない音の件数 |

`manifest.json` の `signature` は、実機の再生診断（`realtime.planSignature`）と一致していなければならない。一致していなければ別の Final MIDI を鳴らしている。

## 2. DAW リファレンス

`.mid` を DAW（またはピアノ音源）で再生し、「Final MIDI 自体が音楽的に妥当か」を先に確認する。

- DAW で良く鳴る → 悪さの原因は再生層。v2 で改善するはず
- DAW でも悪い → 生成層にも問題がある。Playback Engine の判定と切り分けて記録する

この切り分けを済ませてから生成層に着手する。

## 3. 実機 A/B

1. 管理者モードを ON にしてホームから **v1.01 Listening** を開く
2. 画面上部の **Playback Engine** で `OLD 事前録音` / `NEW Sampler` を切り替える（切替時に自動で停止する）
3. 同じ Pattern・同じ音色のまま OLD → NEW を続けて試聴する
4. Piano と E.Piano の両方で繰り返す

エンジン切替時に Metro ログへ診断が出る。確認する値。

| キー | 期待 |
| --- | --- |
| `activeEngine` | 切り替えた側 |
| `realtime.planLoaded` | `true` |
| `realtime.instrument` / `realtime.program` | piano → 0 / ePiano → 4 |
| `realtime.planSignature` | `manifest.json` の該当 signature |
| `realtime.lastError` | **出ていないこと**（出ていればロード失敗。無音や音色差の原因） |
| `instrumentSoundFonts.ePiano.found` | Rhodes SF2 の有無。`false` なら v1 の E.Piano は合成音に落ちている |

## 4. 聴取判定（ユーザー）

v2 に期待する変化。左が v1 の既知の挙動。

| 観点 | v1 | v2 に期待 |
| --- | --- | --- |
| 強弱 | 音量だけ変わる | 音色も変わる（SF2 に層があれば） |
| リリース | 30ms の直線フェード | 自然な減衰 |
| 長い音 | 3 秒で消える | 消えない |
| バラードの響き | 一部の音が別の音高 | 意図した和音 |
| 同時発音 | ペラい / 潰れる | 厚みが残る |
| アルペジオの弱音 | 埋もれる | 聞こえる |
| ステレオ | 左右同一 | 広がりがある |
| 音色切替 | 待たされる | ほぼ即時 |

判定は PASS / FAIL と、FAIL の場合はどの artifact のどこかを記録する。

## 5. 判定後

- **v2 が明確に良い** → 再生層が主原因。v2 を既定にして、生成層（onset の量子化・`top` トラックの消失）へ進む
- **v2 でも悪い** → Final MIDI 側にも問題がある。DAW リファレンスの結果と突き合わせて生成層の課題を特定する
- **v2 が悪化** → `realtime.lastError`、ループ境界の鳴り残り、SF2 のバンク有無を先に確認する（エンジンの結線ミスと音源の限界を混同しない）
