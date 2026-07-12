# Design Tokens — Chord Palette

ダークテーマ。深いネイビー／チャコール／ブラック基調、プライマリは紫〜青、
虹色は控えめ（コード機能・選択状態・Pro の識別に補助的に使用）。

> 実装上の正典（source of truth）は `src/theme/tokens.ts`。
> 本ファイルは Claude Design モックアップ（`Chord Palette.dc.html`）から抽出した値を
> ハーネスの Designer / Evaluator 向けに要約したもの。

## Colors

### App / 背景
- `appBg`: #070a12
- `screenBg`: #0d1422（各画面の基本背景）
- 画面上部グロー（paywall）: #1a1338 → #0d1422

### サーフェス
- `surface`（カード）: #141c2b
- `surfaceRaised`（ヘッダーピル/アイコンボタン）: #151d2c
- `surfacePanel`（再生・音量パネル）: #101828
- `surfaceInput`（インナー選択/セグメント軌道）: #0f1626
- `surfaceLocked`（Proロックタイル）: #10151f
- `surfaceChip`（メタチップ）: #1e293c

### ボーダー
- 標準: rgba(255,255,255,0.07)
- 強: rgba(255,255,255,0.10) / 弱: rgba(255,255,255,0.06)

### テキスト
- bright: #f4f6fb ／ primary: #eef1f6 ／ heading: #e6eaf2
- secondary: #cdd4e2 ／ tertiary: #b9c2d4 ／ muted: #9aa3b5
- dim: #8a94a8 ／ faint: #6b7688 ／ faintest: #525c70

### プライマリ（紫〜青）
- `primary`: #7c5cff ／ `primaryDeep`: #7c4dff
- `primaryBlue`: #5b8cff ／ blue: #3b82f6
- CTA/選択グラデーション: 135deg #7c5cff → #5b8cff
- スライダーグラデーション: 90deg #5b8cff → #7c4dff

### コード機能色
- トニック: #22c55e（text #7fd99b）
- サブドミナント: #eab308（text #ecc94b）
- ドミナント: #ef4444（text #f0918f）

### アクセント / Pro
- pink: #d6409f（text #c99ad8 / #f0a3d0）
- gold（ロック）: #c8a24a ／ purple text: #b9a6ff / #c9bbff
- 虹色: #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6（+ #d6409f）

## Typography
- フォント: Noto Sans JP（`@expo-google-fonts/noto-sans-jp`、実機はシステムフォントにフォールバック）
- ウェイト: 400 / 500 / 600 / 700 / 800 / 900
- 主なサイズ（pt）: 9〜11（キャプション）, 12〜14（本文/ラベル）, 15〜18（見出し）, 20〜30（大見出し）, 58（動画の大コード名）

## Spacing（pt）
4 / 7 / 10 / 14 / 18 / 20 / 26

## Radius（pt）
- sm 7 / md 9 / lg 11 / xl 14 / 2xl 16 / 3xl 18 / 4xl 20 / pill 999

## Shadow / Glow
- プライマリボタン: color #7c5cff, opacity ~0.7, radius 18–20, offset (0,12)

## デバイス基準
- モックの内側画面は 390×842 pt（iPhone 12/13/14 論理解像度と一致）。
- px 値はそのまま RN の pt 値として使用可能。SafeArea を尊重すること。
