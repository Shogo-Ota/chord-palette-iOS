# 実機確認（低コスト運用）

審査中でも、**開発中の最新**は TestFlight ではなく Dev Client + Metro で見る。  
方針: **EAS ビルドは最小回数**、普段は無料の Metro 接続だけ使う。

---

## 前提

- 開発 PC: Windows
- Chord Palette はカスタムネイティブ（`chord-audio` 等）あり → **Expo Go 不可**
- 必要なのは `eas.json` の `development` プロファイルで作った **Development Build（Dev Client）**

---

## A. いま Dev Client が iPhone にある場合（追加コストほぼゼロ）

Windows PC のプロジェクトルートで:

```bash
npm install
npm run dev:client
```

1. PC と iPhone を同じ Wi‑Fi にする  
2. iPhone で Chord Palette の Dev Client を起動  
3. ターミナルの QR / URL で接続  
4. `src/` の変更は保存するだけで実機に反映される  

EAS ビルドは不要。

---

## B. Dev Client が無い / ネイティブ変更後（ビルド 1 回だけ）

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

- Apple ログイン・端末 UDID 登録は対話で進める（`eas device:create`）
- 完了後の QR / URL から iPhone にインストール
- その後は **A** だけ繰り返す

### 再ビルドが必要なときだけ

- `modules/chord-audio` / `modules/chord-video-export` など Swift・ネイティブ変更
- ネイティブ依存の追加・更新（`expo-media-library` 等）
- Dev Client を消した / 別端末に入れ直す

TS / UI / 理論ロジックだけの変更 → **再ビルド不要**。

---

## 使わないもの（コスト・手間が増える）

| 手段 | 理由 |
|---|---|
| 毎回 `eas build --profile production` | 高い・審査用。日常確認向きでない |
| 毎回 `preview` | Dev Client より重い運用になりがち |
| Expo Go | ネイティブ音声が動かない |
| 審査提出ビルドの差し替え | 開発確認用ではない |

---

## トラブル時

| 症状 | 対処 |
|---|---|
| 実機がサーバーを見つけない | 同一 Wi‑Fi を確認。だめなら `npx expo start --dev-client --tunnel`（遅いので最終手段） |
| 音声が無い / モジュール null | Dev Client が古い → **B** で再ビルド |
| 変更が反映されない | Dev Client を一度殺して再接続。必要なら `r` で reload |

---

## コマンド早見

```bash
# 日常（無料）
npm run dev:client

# ネイティブ変更時のみ（ビルド 1 回）
eas build --profile development --platform ios
```
