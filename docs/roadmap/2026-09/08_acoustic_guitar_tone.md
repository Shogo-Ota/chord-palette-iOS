# 08. Acoustic Guitar Tone - 開発設計仕様書

## 1. 目的
高需要音色であるAcoustic Guitarを追加。ただしPiano sample差し替えではなく、ギター固有の発音・voicingを成立させる。

## 2. 必須要素
- Guitar-specific voicing / range
- Down/Up strum onset spread
- muted/dead note optional layer
- picking pattern support
- open-string / playable-shape policy（完全物理シミュレーションは不要）

## 3. 対象外
- TAB editor
- Fretboard manual fingering
- ギター音源プラグイン級の詳細設定

## 4. アーキテクチャ
Instrument toneとPerformance articulationを分離。
- `instrumentId = acoustic_guitar`
- `articulationProfile = strum | picking`

Piano voicingをそのまま流用しない。

## 5. Hard Gate
ギター対応のために既存Piano/Ballad Engineを汚染しない。必要ならinstrument-specific adapterを新設。

## 6. Acceptance Criteria
- 代表open/closed chordで不自然な超広音程なし。
- strum順序がdown/upで反転。
- onset spreadがBPM追従。
- 音切れ/重複発音なし。

## 7. KPI
- Guitar tone利用率
- Guitar動画Export率
- Guitar系Shorts performance

## 8. Cursor実装指示
先にprototype branchで1 Styleのみ実装。USER_LISTENING合格後に他Styleへ拡張。Piano voicingの単純転用は禁止。
