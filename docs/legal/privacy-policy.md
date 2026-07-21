<!--
  Chord Palette — Privacy Policy (bilingual: 日本語 / English)

  公開手順:
   1. 下の ［ ］ プレースホルダ（事業者名・連絡先・住所・施行日）を実値に置換する。
   2. HTML等に変換し、src/config/legal.ts の PRIVACY_POLICY_URL
      (現状 https://chordpalette.app/privacy) で到達できる場所にホストする。
   3. App Store Connect の「Appのプライバシー」および「プライバシーポリシーURL」に
      同じURLを登録する（末尾の「開発者向けメモ」を参照）。

  本文は 2026-07 時点の実装（アカウント無し・匿名分析・PII/コンテンツ非送信・
  広告/クロスアプリ追跡なし）に基づく。実装を変更したら本文も更新すること。
-->

# プライバシーポリシー（日本語）

**最終更新日 / 施行日：2026年7月21日**

Shogo Ota（以下「当方」といいます）は、当方が提供するモバイルアプリケーション「Chord Palette」（以下「本アプリ」といいます）における利用者の情報の取扱いについて、本プライバシーポリシー（以下「本ポリシー」といいます）を定めます。本アプリを利用された場合、本ポリシーに同意いただいたものとみなします。

## 1. 事業者情報
- 事業者：Shogo Ota（個人開発者）
- 連絡先（お問い合わせ・開示等請求の窓口）：shogoota07@gmail.com

## 2. 基本方針
本アプリはアカウント登録を必要とせず、氏名・住所・電話番号・メールアドレスといった情報を利用者から直接収集しません。利用者が作成したコード進行・プロジェクト名・メモ等の制作データは、原則として端末内にのみ保存され、当方のサーバーへ送信されることはありません。当方は広告を配信せず、他社アプリやWebサイトをまたいだ行動追跡（トラッキング）も行いません。

## 3. 取得する情報と利用目的
本アプリは、以下の情報を取得することがあります。

### (1) 端末内にのみ保存される情報（当方は取得しません）
- 作成したコード進行、プロジェクト名、メモ、各種設定
- これらは端末内のローカルストレージ（SQLite）に保存され、当方や第三者へ送信されません。本アプリを削除すると消去されます。

### (2) 匿名の利用状況データ（プロダクト分析：PostHog）
- 内容：アプリの起動、機能の利用状況（コードの追加・削除、再生、伴奏・音色の選択、書き出し操作、課金画面の表示、購入導線のイベント等）、および端末の種類・OSバージョン・アプリバージョン・言語設定などの技術情報。ランダムに生成される匿名IDに紐づきます。
- 取得しないもの：氏名等の個人情報や、プロジェクト名・メモ・具体的なコード進行・書き出した動画などの制作コンテンツは送信しません。
- 利用目的：本アプリの品質改善、機能の利用状況の把握、不具合の傾向分析。

### (3) クラッシュ・エラー診断情報（Sentry）
- 内容：アプリがクラッシュ／エラーを起こした際の診断情報（エラーメッセージ、発生箇所、端末モデル、OS・アプリのバージョン等）。
- 設定：IPアドレスや利用者識別子の付与は無効化しています。制作コンテンツは含めません。
- 利用目的：不具合の検知・原因調査・修正による安定性向上。

### (4) 購入・サブスクリプション情報（Apple／RevenueCat）
- 内容：サブスクリプション（Palette Pro）の購入・更新・解約・復元の状態、取引を識別する情報、RevenueCatが発行する匿名の利用者ID。
- 決済：決済はApple（App Store）が処理します。当方はクレジットカード番号等の決済情報を受け取りません。
- 利用目的：サブスクリプションの提供・状態管理、購入の復元、不正利用の防止。

### (5) 写真（カメラロール）へのアクセス
- 内容：利用者が動画を書き出す際、許可を得たうえで作成した動画をカメラロールへ保存します。
- 当方は利用者の写真・動画を閲覧・収集・アップロードしません。

## 4. 第三者（委託先・情報処理者）への提供
当方は、上記の目的の達成に必要な範囲で、以下の外部サービスを利用します。これらはサービス提供のための業務委託先（情報処理者）であり、当方は取得情報を販売しません。

| サービス | 目的 | 提供事業者 | プライバシーポリシー |
|---|---|---|---|
| App Store / StoreKit | 決済・サブスクリプション | Apple Inc. | https://www.apple.com/legal/privacy/ |
| RevenueCat | 購入状態の管理 | RevenueCat, Inc. | https://www.revenuecat.com/privacy/ |
| PostHog | 匿名の利用状況分析 | PostHog, Inc. | https://posthog.com/privacy |
| Sentry | クラッシュ・エラー診断 | Functional Software, Inc. (Sentry) | https://sentry.io/privacy/ |

## 5. 外国にある第三者への提供・越境移転
上記の外部サービスの一部は、米国その他日本国外に所在するサーバーで情報を処理・保存します。したがって、取得した情報が日本国外へ移転される場合があります。当方は、これらの委託先が適切な安全管理措置を講じていることを確認したうえで利用します。各国の制度の詳細は、上記各社のプライバシーポリシーをご参照ください。

## 6. 保管期間
- 端末内データ：利用者が削除するか本アプリをアンインストールするまで保管されます。
- 分析・診断データ：利用目的の達成に必要な期間、または各委託先の保管方針に従って保管され、その後削除または匿名化されます。
- 購入情報：サブスクリプションの管理および法令上必要な期間、保管されます。

## 7. 安全管理
当方は、取得する情報の漏えい・滅失・毀損の防止その他の安全管理のために、通信の暗号化、アクセス制限、識別子の最小化（匿名ID・PII送信の抑制）等の合理的な措置を講じます。

## 8. 利用者の権利
利用者は、当方が保有する自己の情報について、開示・訂正・利用停止・消去等を求めることができます。ご請求は第1条の連絡先までご連絡ください。本人確認のうえ、法令に従い対応します。なお、匿名化されたデータについては特定の個人を識別できないため、ご本人のデータとして特定・対応できない場合があります。

## 9. お子さまのプライバシー
本アプリは13歳未満のお子さまを対象としていません。当方は、13歳未満のお子さまから意図的に個人情報を収集することはありません。

## 10. 本ポリシーの変更
当方は、法令の変更や本アプリの機能変更に応じて本ポリシーを改定することがあります。重要な変更を行う場合は、本アプリ内または本ページ上で告知します。改定後に本アプリを利用された場合、変更後の本ポリシーに同意いただいたものとみなします。

## 11. お問い合わせ
本ポリシーに関するご質問・開示等のご請求は、以下までご連絡ください。
- Shogo Ota（個人開発者）
- shogoota07@gmail.com

---

# Privacy Policy (English)

**Last updated / Effective date: July 21, 2026**

This Privacy Policy ("Policy") explains how Shogo Ota ("we", "us", or "our") handles information in connection with the mobile application "Chord Palette" (the "App"). By using the App, you agree to this Policy.

## 1. Who we are
- Operator: Shogo Ota (individual developer)
- Contact (inquiries and data requests): shogoota07@gmail.com

## 2. Our approach
The App does not require an account and does not directly collect your name, address, phone number, or email address. Content you create — chord progressions, project names, and memos — is stored only on your device and is not sent to our servers. We do not serve advertising and we do not track you across other apps or websites.

## 3. Information we process and why

### (1) On-device only (we do not collect it)
- Your chord progressions, project names, memos, and settings.
- These are stored locally on your device (SQLite) and are not transmitted to us or any third party. They are removed when you delete the App.

### (2) Anonymous usage analytics (PostHog)
- What: app launches, feature usage (adding/removing chords, playback, selecting accompaniment/instruments, export actions, paywall views, purchase-funnel events), and technical information such as device type, OS version, app version, and language. This is linked only to a randomly generated anonymous ID.
- What we do NOT send: any personal identifiers, and no created content (project names, memos, specific chord progressions, or exported videos).
- Purpose: to improve the App, understand feature usage, and analyze issues.

### (3) Crash and error diagnostics (Sentry)
- What: diagnostic data when the App crashes or errors (error messages, location in code, device model, OS and app version).
- Settings: IP addresses and user identifiers are disabled; no created content is attached.
- Purpose: to detect, investigate, and fix problems and improve stability.

### (4) Purchases and subscriptions (Apple / RevenueCat)
- What: the status of your Palette Pro subscription (purchase, renewal, cancellation, restore), transaction identifiers, and an anonymous RevenueCat app user ID.
- Payments: processed by Apple (App Store). We do not receive your payment card details.
- Purpose: to provide and manage the subscription, restore purchases, and prevent fraud.

### (5) Photos (Camera Roll) access
- What: when you export a video, with your permission we save the created video to your Camera Roll.
- We do not view, collect, or upload your photos or videos.

## 4. Service providers (processors)
We use the following third-party services strictly as processors to operate the App. We do not sell your information.

| Service | Purpose | Provider | Privacy policy |
|---|---|---|---|
| App Store / StoreKit | Payments & subscriptions | Apple Inc. | https://www.apple.com/legal/privacy/ |
| RevenueCat | Subscription management | RevenueCat, Inc. | https://www.revenuecat.com/privacy/ |
| PostHog | Anonymous usage analytics | PostHog, Inc. | https://posthog.com/privacy |
| Sentry | Crash & error diagnostics | Functional Software, Inc. (Sentry) | https://sentry.io/privacy/ |

## 5. International transfers
Some of these providers process and store information on servers located in the United States or other countries outside Japan. Your information may therefore be transferred outside Japan. We use these providers on the basis that they maintain appropriate safeguards. Please refer to each provider's privacy policy for details.

## 6. Retention
- On-device data: kept until you delete it or uninstall the App.
- Analytics and diagnostics: retained for as long as necessary for the stated purposes or per each provider's retention policy, then deleted or anonymized.
- Purchase data: retained to manage your subscription and as required by law.

## 7. Security
We take reasonable measures to protect information against loss, misuse, and unauthorized access, including encryption in transit, access controls, and minimizing identifiers (anonymous IDs, suppressing PII transmission).

## 8. Your rights
You may request access to, correction of, restriction of, or deletion of your information. Contact us at the address in Section 1 and we will respond in accordance with applicable law after verifying your identity. Because much of the data is anonymized and cannot be linked to an individual, we may be unable to identify data as yours.

## 9. Children's privacy
The App is not directed to children under 13, and we do not knowingly collect personal information from children under 13.

## 10. Changes to this Policy
We may update this Policy to reflect changes in law or the App. For material changes we will provide notice in the App or on this page. Continued use of the App after changes take effect constitutes acceptance of the updated Policy.

## 11. Contact
For questions or data requests regarding this Policy, contact:
- Shogo Ota (individual developer)
- shogoota07@gmail.com

---

<!--
==================================================================
 開発者向けメモ（公開ページには含めない）
==================================================================

App Store Connect「Appのプライバシー（App Privacy）」の申告目安（2026-07時点の実装）:

- Data Used to Track You（トラッキング）: なし（IDFA/ATT未使用、クロスアプリ追跡なし）
- Data Linked to You（本人に紐づく）: なし（アカウント無し・匿名ID運用）
- Data Not Linked to You（本人に紐づかない）:
    • Usage Data（Product Interaction）           … PostHog（匿名）
    • Diagnostics（Crash Data / Performance Data） … Sentry
    • Purchases（Purchase History）               … Apple / RevenueCat（匿名IDに紐づく購入状態）
- Identifiers: RevenueCatの匿名App User IDは広告目的に使わず、本人特定にも用いない前提。
  ASC上は "Not Linked to You" の Identifiers として扱うか、運用実態に合わせて申告。

注意:
- PostHog / Sentry / RevenueCat のキーを本番に投入しない場合、これらのデータ収集は
  一切発生しない（コード上、キー未設定時はno-op）。実際に投入する構成に合わせて
  上記申告を増減させること。
- 本文中の外部サービス一覧・越境移転の記載は、投入したサービスに合わせて調整する。
-->
