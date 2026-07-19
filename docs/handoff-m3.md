# 引き継ぎ：Chord Palette（M3 課金 ＋ 音楽監修の追加）

作成日: 2026-07-18 / 目的: 新しいチャットでサブエージェントを起動して M3（課金）と音質向上を進めるための引き継ぎ。

> このチャットが肥大化し、サブエージェントの新規起動が `Timeout waiting for bubble creation` で失敗するようになったため、新チャットへ移行する。本ファイルを新チャットの冒頭で参照させること。

---

## 0. リポジトリ / ブランチ
- パス: `C:\AI Works\Chord Palette`
- 現ブランチ: `cursor/docs-release-plan-and-aesthetics`（`master` から派生。docs コミット `0e37f06` を push 済み）
- `master` 最新: `ac81766`（下記 M1/M2/UI 実装を含む）
- 作業ツリーに **改行コード(LF↔CRLF)のみ** の未コミット差分あり → 無視してよい（コンテンツ差分なし）

## 1. これまでの到達点（master にコミット済み）
- **M1 オーディオ**: 伴奏4パターン（block / eightBeat / sixteenthBeat / arpeggio）＋ドラム7グルーヴ（pop8/pop16/rock8/rock16/soul16/jazzSwing/bossaNova）＋度数対応テンション＋コード低音2オクターブ(C1+C2)。play/export に配線済み。
  - 伴奏の聴感方針（実装済み）: **block=拍頭固定・シンコペ無し・ベロシティほぼ均一** / **8・16beat=食い(look)＋微小タイミング揺らぎ＋ベロシティ波** / **arpeggio=現状維持**。
- **M2 動画書き出し 4B**: 15/30/60秒、写真保存、共有シート（`expo-sharing`）、動画フレームの進行ドット、失敗時リトライ。
- **UI（30秒体験）**: ホーム/エディタの導線整理、共通部品 `PrimaryButton` / `EmptyState`。
- **管理者アンロック**: `src/config/admin.ts` を `ADMIN_UNLOCK = __DEV__` にガード化（production では必ず false）。回帰テスト `src/config/__tests__/admin.test.ts` あり。
- 検証: `npx tsc --noEmit` / `npx jest`（90 pass）/ `npx expo lint` すべて OK。

## 2. 本日のマイルストーン = M3（課金 & Pro コンテンツ）
`docs/release-plan.md` の M3。現状:
- Pro ゲート自体は `src/lib/entitlements.ts` の `isLocked()` 経由で概ね動作（コード/プリセットのロック表示・paywall 遷移あり）。
- **購入・復元の実処理が未配線**（`src/app/paywall.tsx` の購入ボタンに `onPress` 無し、`src/services/billing/index.ts` に purchase/restore 無し）。← M3 の主眼。

### 確定済みの実装方針（デフォルト）
**RevenueCat の APIキー / App Store Connect の非消費型商品(Palette Pro ¥490)はまだ無い前提**で、まず以下を実装する:
- 課金の **Provider 抽象（Strategy/Provider パターン）** ＋ **Mock 購入/復元** ＋ **paywall 配線**（購入→entitlement 解放→ロック解除、復元）。
- 実 `react-native-purchases` は後日 APIキー/商品用意後に **差し替え**（その時に EAS 再ビルド必須）。
- 層分離厳守（課金は Service 経由、画面に直書きしない。client 申告を信用しない設計は Phase 4 の Convex サーバ検証で恒久化）。

> ※「本番 RC をいきなり配線する」に変更したい場合はユーザーに確認すること（未回答の確認事項）。

## 3. 追加のご要望（重要）：音楽監修（Music Supervisor）役割の新設
既存のカルテット（planner→generator→designer→evaluator）に、新役割 **音楽監修（Music Supervisor）** を組み込む。
- ペルソナ: **音楽理論の専門家かつ現役ミュージシャン（編曲/プロデュース経験者）**。
- 責務: 音・音楽に関わる変更（ボイシング / 伴奏 / ドラム / テンション / プリセット / 音色）の **実装前レビュー** と **実装後の聴感評価**。designer=見た目、evaluator=契約/QA、music-supervisor=音楽的魅力、と責務分離。
- 目的: 「コアスペック＝音の良さ」をさらに引き上げ、コードパレットを"より魅力的なアプリ"にトータルプロデュースする。

## 4. 新チャットで最初にやること
1. 本ファイル（`docs/handoff-m3.md`）と `docs/release-plan.md` を読む。
2. サブエージェントを起動（新チャットなら起動できるはず）:
   - **音楽監修**（`generalPurpose` に §3 のペルソナを与える）: 下記ファイルを監査し、優先度付き(P0/P1/P2)の具体改善案（症状→音楽的理由→ファイル/関数/パラメータまで踏み込んだ変更→担当(@generator/@designer)→実機検証方法）＋「着手TOP3」を出す。コードは修正しない。
   - **@planner**: 現状〜残マイルストーン（M3→M6/提出）のトータル計画を最新化し、`docs/sprints/sprint-5.md`（M3課金・Mock先行）と `docs/sprints/sprint-6.md`（音質・音楽的魅力の向上／音楽監修の監査結果を差し込む枠）を作成。music-supervisor をどのステップで挟むかも明記。
3. 計画・監査がまとまったら、順序厳守で `@generator`（実装）→ 音楽監修/designer レビュー → `@evaluator`（QA）。

### 音楽監修が読むべき主要ファイル
- `src/lib/voicing.ts`（低音2オクターブ重ね、INTERVALS、CHORD_ROOT_MIDI=48固定）
- `src/data/music.ts`（DEGREE_VARIATION_SUFFIX / availableVariations / variationChord）
- `modules/chord-audio/ios/AudioEngineController.swift`（buildChordStrikes、humanize/timingSway/ringCap/emitGroup/emitGrid）
- `modules/chord-audio/ios/DrumProvider.swift`（7グルーヴ合成ドラム）
- `src/data/presets.ts`（プリセット進行）
- 課金関連: `src/app/paywall.tsx`, `src/services/billing/index.ts`, `src/lib/entitlements.ts`, `src/app/presets.tsx`, `src/app/editor.tsx`(addChord の `isLocked` ゲート)
- 正典: `Chord_Palette_iOS_MVP_Requirements_v1.md`（§5.11 課金 / §10.4 / §5.8 プリセット / §5.7 音色）

## 5. 運用ルール（厳守）
- 日本語で応対。
- 大きな変更の前に「今から行うこと / 変更対象ファイル / 技術的理由 / 期待される結果」を提示し、**承認を待つ**。
- 層分離・拡張性重視（新規ファイル優先、既存改変は最小＆理由明記、Strategy/Provider/Repository）。
- 承認前に大量ファイルを一括変更しない。型エラーを暫定無視しない。
- サブエージェントはスプリント順を飛ばさない。evaluator 合格まで次スプリントに進まない。

## 6. 未回答の確認事項（新チャットでユーザーに確認）
1. 課金は「Mock 先行（推奨）」か「本番 RevenueCat 配線」か。
2. 買い切り価格 ¥490 の確定可否。
3. プリセットの法務リネーム（曲名由来→一般名称）を今スプリントで行うか。
4. Pro 音色（アコギ/エレキ/ストリングス）は V2 送りでよいか（推奨: V2）。

## 7. 既知の技術メモ
- サブエージェント起動が `Timeout waiting for bubble creation` で失敗する場合＝会話肥大が主因。新チャットで解消。
- `.env` の `ANTHROPIC_API_KEY` は `.gitignore` 済み・コミットに混入しない。
- 過去の evaluator 指摘で残る観察点: リアルタイム経路の `chordSampleValue` が全 strike 線形走査（16小節×16beat で高負荷の可能性）、rock16×sixteenthBeat での音割れ有無 → 実機で顕在化したら @generator に最適化を差し戻し。
