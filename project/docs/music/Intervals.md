# Intervals

半音（semitone）オフセットが Chord Palette の音響の正である。

---

## 1. 基本音程

| 名前 | 記号 | 半音 |
|---|---|---|
| Unison | P1 | 0 |
| minor 2nd | m2 | 1 |
| major 2nd | M2 | 2 |
| minor 3rd | m3 | 3 |
| major 3rd | M3 | 4 |
| Perfect 4th | P4 | 5 |
| Tritone | A4/d5 | 6 |
| Perfect 5th | P5 | 7 |
| minor 6th | m6 | 8 |
| major 6th | M6 | 9 |
| minor 7th | m7 | 10 |
| major 7th | M7 | 11 |
| Octave | P8 | 12 |

---

## 2. テンション音程（ルート基準）

| テンション | 半音（1オクターブ上を含む表記可） |
|---|---|
| b9 | 13 (1+12) |
| 9 | 14 |
| #9 | 15 |
| 11 | 17 |
| #11 | 18 |
| b13 | 20 |
| 13 | 21 |

実装の `intervals` 配列では、コンパクトボイシングのため同一ピッチクラスをオクターブ内に畳む場合がある。その場合も **構成音のピッチクラス集合は本表と一致** しなければならない。

---

## 3. 品質テンプレート（抜粋）

| Quality | intervals（例） |
|---|---|
| major triad | `[0,4,7]` |
| minor triad | `[0,3,7]` |
| dim triad | `[0,3,6]` |
| maj7 | `[0,4,7,11]` |
| m7 | `[0,3,7,10]` |
| dominant 7 | `[0,4,7,10]` |
| m7b5 | `[0,3,6,10]` |
| dim7 | `[0,3,6,9]` |

拡張形は `Extensions.md` / `Altered.md` を正とする。

---

## 4. 一致制約

任意の定義について次が同時に真であること:

1. `symbol` / `displayName` が示す構成音  
2. `intervals` のピッチクラス集合  
3. `chordMidiNotes` のピッチクラス集合（バス別扱い可）  

不一致はバグとする。
