# 試聴・再生安定化（v1.01）

- 作成日: 2026-08-03

## 実施した修正

| 変更 | ファイル | 狙い |
|---|---|---|
| `play()` の世代付き直列化 | `src/services/audio/index.ts` | スタイル連打／live re-apply で古い `play` が後から勝ち残る競合を防ぐ |
| 試聴 UI の pause/resume 文言 | `src/app/groove.tsx` | 一時停止と停止を混同しない |
| City プリセットを `beat16` に | `styleCards.ts` | 再生成計画が City Engine と一致（試聴の安定した差別化） |

## 既存で維持する仕組み

- `useLiveSoundReapply`: パターン変更時に `rescaleBeats` で再生位置を維持
- 破棄時（ヘッダー戻る）: dirty かつ playing なら committed session で再 `play`
- ネイティブ診断: 割り込み／ルート変更を PlaybackDiagnostics に記録

## 手動確認（Dev Client）

1. コード進行ありで Ballad → Band → City を再生中に連打 → 最後のスタイルだけが鳴る
2. 試聴 → 一時停止 → 再開 → 同じ付近から続く
3. 未確定のまま戻る → エディタ側の committed スタイルに戻る
4. 着信／イヤホン抜去後に復帰できる

## 未解決

- ネイティブ側の並列 `play` キャンセル API は未追加（JS 直列化で十分か実機確認）
- 30–60 分の「低音だけ」は別紙 `bass_only_investigation_v1.md`
