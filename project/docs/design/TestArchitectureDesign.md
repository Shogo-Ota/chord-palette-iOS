# テスト構成設計（Phase 8）

---

## 1. 目標カバレッジ

| 領域 | 自動テスト |
|---|---|
| 全12キー | スペリング・displayName |
| コード名 | symbol / buttonLabel / displayName |
| 構成音 | pitch class set |
| MIDI | `chordMidiNotes` |
| テンション | degree カタログ全件 |
| 移調 | transpose / rebase 不変条件 |
| ボイシング | intervals 一致、将来 voice-lead |
| 伴奏 | GrooveEngine.compile のスナップショット |
| UI | 契約テスト / Evaluator（手動+Playwright） |
| 回帰 | fixtures + golden |

---

## 2. 提案ディレクトリ

```text
src/lib/theory/definitions/__tests__/
  catalog.test.ts
  catalog.12keys.test.ts
  tension.degree.test.ts
src/lib/performance/__tests__/
  feelEngine.test.ts
  microtiming.test.ts
  strum.test.ts
fixtures/
  chords/c-major.golden.json
  groove/pop8.strikes.golden.json
```

開発オラクル（CI optional job）:

- Tonal / music21 で期待 pitch class を生成し、自前カタログと差分検出

---

## 3. 不変条件テスト例

```ts
for (const key of MAJOR_KEYS) {
  for (const def of catalog) {
    const r = resolve(def, key, degree);
    expect(pcs(r.midiNotes)).toEqual(pcs(def.intervals));
    expect(r.displayName).toBe(`${spell(key, degree)}${def.symbol}`);
  }
}
```

未知 definition → **throw**（triad フォールバック禁止を段階導入）。

---

## 4. 伴奏テスト戦略

| 段階 | 内容 |
|---|---|
| 今 | JS スケジュール数学のみ |
| 次 | PatternDoc → strikes を TS で黄金比較 |
| 後 | native は「strikes 再生」の統合テスト（少量） |

Humanize はシード固定で決定論アサート。

---

## 5. UI / 回帰

- ユニット: ライブラリに出る候補 ID 集合
- Evaluator: 実機チェックリスト（既存）
- 回帰: golden JSON を PR で diff

---

## 6. CI 提案

```text
pr → jest (music + groove pure)
optional nightly → oracle (music21/tonal) diff report
```

Expo Go を壊すネイティブ依存はテストのためだけに追加しない。

---

## 7. Phase 8 完了条件（設計）

- [x] 対象領域とディレクトリ案を文書化
- [ ] （実装フェーズ）カタログ全件 × 12キーテストの導入
