# アプリアイコンのアセット

パレット＋鍵盤のアイコンは 3 つの形で持っている。**用途ごとにマスクの掛かり方が違う**ため、
形の違うファイルを 1 つにまとめてはいけない。

| ファイル | 形式 | マスクを掛けるのは誰か | 使う場所 |
|---|---|---|---|
| `assets/icon/app-icon.png` | 1024², 不透明 RGB, 角丸なしの全面塗り | iOS（squircle） | `app.json` の `icon` / `ios.icon` |
| `assets/icon/app-store-icon-1024.png` | 同上（`app-icon.png` と同一） | App Store Connect | ストア掲載 |
| `assets/icon/icon.png` | 1024², RGBA, 角丸を焼き込み・外側は透過 | アセット自身 | `Wordmark`, 書き出し画面, スプラッシュ, Android adaptive foreground |
| `assets/icon/app-icon-pro.png` | 同上（金枠 + PRO リボン） | アセット自身 | paywall のヒーロー |
| `modules/chord-video-export/ios/assets/cp-watermark.png` | 512², 不透明 RGB, 全面塗り | `FrameRenderer.swift`（`cornerRadius = 辺 × 0.24`） | 動画のウォーターマーク |
| `assets/icon/subscription-promo-1024.png` | 1024², 不透明 RGB | — | App Store のサブスク訴求画像。paywall のヒーローと同じ構図（Pro アイコン + Palette Pro + タグライン） |

## 守ること

- **App Store 用は透過を持たせない。** Apple がアルファ付きアイコンを弾く。角丸も焼き込まない。
  iOS が独自の squircle を後から掛けるので、アートの丸みとずれて四隅に地色の三日月が出る。
- **アプリ内表示に `borderRadius` を重ね掛けしない。** `icon.png` と `app-icon-pro.png` は
  角丸が焼き込み済みで、外側は透過。上から RN の `borderRadius` を当てると絵柄を削る。
  paywall のヒーローだけは例外で、`borderRadius: 20` を残している。これは絵柄を削るためではなく、
  紫のグローが正方形にならないよう影の輪郭をアートの角に合わせるため。アートの角丸比は
  約 0.213（92pt なら 19.6pt）なので、これを大きく超える値にしないこと。
- **paywall の背景は紺一色ではない。** `ScreenScaffold variant="paywall"` が上端に紫のグラデーションを
  敷いているので、ヒーローのアイコンに地色の角が残っていると必ず見える。透過が要るのはこのため。

## 出自

2026-07 にオーナーから支給された比較シート（無料版 / 有料版の 2 枚並び）から切り出した。
シートは両アイコンをアプリと同じ紺（#0e1623）の上に置いていたため、角丸矩形は幾何的に復元している
（辺は画素から実測、角丸半径は上端付近の弧のインセットからフィット。無料版 R/辺 ≒ 0.229、
Pro 版 ≒ 0.213）。全面塗り版の四隅は、境界に厳密に一致させるため拡散補間で外挿した。
