import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { SegTrack, Toggle } from '@/components/controls';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { Wordmark } from '@/components/Wordmark';
import { GROOVE_LABELS, INSTRUMENT_LABELS } from '@/data/labels';
import {
  CHORD_VARIATIONS,
  chromaticBassNotes,
  diatonicLibrary,
  MAJOR_KEYS,
  modalInterchange,
  secondaryDominants,
  slashChord,
  variationChord,
  type VariationId,
} from '@/data/music';
import * as session from '@/features/editor/session';
import { useEditorSession } from '@/features/editor/session';
import { isLocked } from '@/lib/entitlements';
import { logger } from '@/lib/logger';
import { MAX_BARS, durationLabel, totalBars as calcTotalBars } from '@/lib/progression';
import { useEntitlements } from '@/services/billing';
import { colors, font, functionColor, primaryGradient, radius } from '@/theme/tokens';
import type { ChordDuration, ChordFunction, LibraryChord, MajorKey } from '@/types';

const H_PAD = 16;

const DURATION_OPTIONS = [
  { key: '4', label: '1小節' },
  { key: '2', label: '1/2小節' },
  { key: '1', label: '1/4小節' },
];

const FUNCTION_BADGE: Record<ChordFunction, string> = {
  tonic: 'T',
  subdominant: 'SD',
  dominant: 'D',
};

type LibraryTab = 'diatonic' | 'advanced' | 'slash';

function rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Map a library pick to a placeable chord event (id assigned by the session). */
function libToEvent(c: LibraryChord, durationBeats: ChordDuration = 4) {
  return {
    chordId: c.id,
    displayName: c.displayName,
    degreeLabel: c.degreeLabel,
    function: c.function,
    durationBeats,
    isPro: !!c.isPro,
    rootOffset: c.rootOffset,
    suffix: c.suffix,
    bassOffset: c.bassOffset,
    bassNote: c.bassNote,
    variation: c.variation,
    category: c.category,
  };
}

export default function EditorScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ent = useEntitlements();
  const s = useEditorSession();

  useEffect(() => {
    if (id) {
      session
        .load(id)
        .catch((e) => logger.error('Failed to load project', { error: String(e) }));
    } else {
      session.startNew();
    }
  }, [id]);

  /* ---- session-backed state (aliased for the render below) ------ */
  const key = s.key;
  const progression = s.progression;
  const selected = s.selected;
  const history = s.history;
  const bpm = s.tempoBpm;
  const title = s.title;
  const saved = !s.dirty;

  /* ---- UI-only local state -------------------------------------- */
  const [metronome, setMetronome] = useState(true);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(true);
  const [tab, setTab] = useState<LibraryTab>('diatonic');
  const [varDegree, setVarDegree] = useState(0);
  const [slashTarget, setSlashTarget] = useState(0);

  const tapsRef = useRef<number[]>([]);

  /* ---- derived library ------------------------------------------ */
  const diatonic = useMemo(() => diatonicLibrary(key), [key]);
  const secDoms = useMemo(() => secondaryDominants(key), [key]);
  const modals = useMemo(() => modalInterchange(key), [key]);
  const bassNotes = useMemo(() => chromaticBassNotes(key), [key]);

  const totalBars = calcTotalBars(progression);
  const selectedEvent = selected >= 0 ? progression[selected] : undefined;

  const colW = (cols: number) => Math.floor((width - H_PAD * 2 - 8 * (cols - 1)) / cols);
  const wDia = colW(4);
  const wAdv = colW(3);
  const wBass = colW(6);

  /* ---- actions (delegate to the shared session) ----------------- */
  const setSelected = session.setSelected;
  const duplicateSelected = session.duplicateSelected;
  const moveSelected = session.moveSelected;
  const deleteSelected = session.deleteSelected;
  const undo = session.undo;

  function addChord(c: LibraryChord) {
    if (isLocked(c.isPro, ent)) {
      router.push('/paywall');
      return;
    }
    session.addChord(libToEvent(c));
  }

  function setDuration(beats: ChordDuration) {
    session.setDuration(beats);
  }

  function save() {
    session.save().catch((e) => logger.error('Failed to save project', { error: String(e) }));
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  function changeKey(k: MajorKey) {
    session.setKey(k);
    setKeyPickerOpen(false);
  }

  function tapTempo() {
    const now = Date.now();
    const taps = tapsRef.current.filter((t) => now - t < 2000);
    taps.push(now);
    tapsRef.current = taps;
    if (taps.length >= 2) {
      let sum = 0;
      for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
      session.setTempo(60000 / (sum / (taps.length - 1)));
    }
  }

  /* ---- render --------------------------------------------------- */
  return (
    <ScreenScaffold padH={H_PAD}>
      {/* ── Compact header ─────────────────────────────── */}
      <View style={styles.header}>
        <Wordmark size={14} withIcon iconSize={26} />
        <View style={styles.headerActions}>
          <Pressable style={styles.keyChip} onPress={() => setKeyPickerOpen(true)} hitSlop={4}>
            <Text style={styles.keyChipLabel}>KEY</Text>
            <Text style={styles.keyChipValue}>{key}</Text>
            <Icon name="chevronDown" size={12} color={colors.textMuted} strokeWidth={2.4} />
          </Pressable>
          <IconBtn icon="rewind" onPress={undo} disabled={history.length === 0} />
          <IconBtn
            icon={saved ? 'check' : 'download'}
            onPress={save}
            tint={saved ? colors.success : colors.textMuted}
          />
          <IconBtn icon="close" onPress={close} />
        </View>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.projectTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.savedText, { color: saved ? colors.success : colors.textFaint }]}>
          {saved ? '保存済み' : '未保存'}
        </Text>
      </View>

      {/* ── Transport & settings bar ───────────────────── */}
      <View style={styles.transportBar}>
        <View style={styles.bpmBox}>
          <Text style={styles.bpmValue}>{bpm}</Text>
          <Text style={styles.bpmUnit}>BPM</Text>
          <Pressable style={styles.tapBtn} onPress={tapTempo} hitSlop={4}>
            <Text style={styles.tapBtnText}>TAP</Text>
          </Pressable>
        </View>
        <View style={styles.transportToggles}>
          <ToggleField label="ﾒﾄﾛﾉｰﾑ" value={metronome} onValueChange={setMetronome} />
          <ToggleField label="ループ" value={loop} onValueChange={setLoop} />
        </View>
        <Pressable onPress={() => setPlaying((p) => !p)}>
          <LinearGradient
            colors={primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.playBtn, playing && styles.playBtnActive]}>
            <Icon name="play" size={22} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* tone / drum summary → /groove */}
      <View style={styles.summaryRow}>
        <SummaryChip
          icon="dots"
          label="音色"
          value={INSTRUMENT_LABELS[s.instrumentId]}
          onPress={() => router.push('/groove')}
        />
        <SummaryChip
          icon="dots"
          label="ドラム"
          value={GROOVE_LABELS[s.grooveId]}
          onPress={() => router.push('/groove')}
        />
      </View>

      {/* ── Progression strip ──────────────────────────── */}
      <View style={styles.stripHeader}>
        <Text style={styles.stripKey}>KEY: {key}</Text>
        <Text style={styles.barCount}>
          {totalBars} / {MAX_BARS}小節
        </Text>
      </View>

      {progression.length === 0 ? (
        <View style={styles.emptyStrip}>
          <Text style={styles.emptyHint}>下のコードから選んで追加 ↓</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stripScroll}>
          <View style={styles.stripRow}>
            {progression.map((ev, i) => (
              <React.Fragment key={ev.id}>
                <Pressable onPress={() => setSelected(i)}>
                  <View
                    style={[
                      styles.timeCard,
                      { borderLeftColor: functionColor[ev.function] },
                      i === selected && styles.timeCardSelected,
                    ]}>
                    <View style={styles.timeTop}>
                      <Text style={styles.timeName} numberOfLines={1}>
                        {ev.displayName}
                      </Text>
                      <Text style={styles.timeDegree} numberOfLines={1}>
                        {ev.degreeLabel}
                      </Text>
                    </View>
                    <View style={styles.timeDur}>
                      <Text style={styles.timeDurText}>{durationLabel(ev.durationBeats)}</Text>
                    </View>
                  </View>
                </Pressable>
                {i < progression.length - 1 && <Text style={styles.arrow}>→</Text>}
              </React.Fragment>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Inline actions (only when selected) ────────── */}
      {selectedEvent && (
        <View style={styles.inlinePanel}>
          <View style={styles.inlineHeadRow}>
            <Text style={styles.inlineLabel} numberOfLines={1}>
              選択中：{selectedEvent.displayName}
            </Text>
            <View style={styles.inlineBtns}>
              <ActionBtn icon="duplicate" onPress={duplicateSelected} />
              <ActionBtn icon="chevronLeft" onPress={() => moveSelected(-1)} />
              <ActionBtn icon="chevronRight" onPress={() => moveSelected(1)} />
              <ActionBtn icon="trash" danger onPress={deleteSelected} />
            </View>
          </View>
          <SegTrack
            options={DURATION_OPTIONS}
            value={String(selectedEvent.durationBeats)}
            onChange={(k) => setDuration(Number(k) as ChordDuration)}
          />
        </View>
      )}

      {/* ── Chord library (collapsible, the star) ──────── */}
      <View style={styles.libHeader}>
        <Text style={styles.libTitle}>コードライブラリ</Text>
        <Pressable onPress={() => setLibOpen((o) => !o)} hitSlop={10} style={styles.chevronBtn}>
          <View style={{ transform: [{ rotate: libOpen ? '0deg' : '-90deg' }] }}>
            <Icon name="chevronDown" size={18} color={colors.textMuted} strokeWidth={2.4} />
          </View>
        </Pressable>
      </View>

      {libOpen && (
        <>
          <SegTrack
            options={[
              { key: 'diatonic', label: 'ダイアトニック' },
              { key: 'advanced', label: '応用' },
              { key: 'slash', label: 'オンコード' },
            ]}
            value={tab}
            onChange={(k) => setTab(k as LibraryTab)}
            style={styles.tabTrack}
          />

          {tab === 'diatonic' && (
            <View>
              <View style={styles.grid}>
                {diatonic.map((c) => (
                  <LibraryCard key={c.id} chord={c} width={wDia} onPress={() => addChord(c)} />
                ))}
              </View>

              <Text style={styles.subHint}>度数を選んでバリエーション適用</Text>
              <View style={styles.degreeRow}>
                {diatonic.map((c, i) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setVarDegree(i)}
                    style={[styles.degreeChip, i === varDegree && styles.degreeChipActive]}>
                    <Text
                      style={[
                        styles.degreeChipText,
                        i === varDegree && styles.degreeChipTextActive,
                      ]}>
                      {c.degreeLabel}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.varRow}>
                {CHORD_VARIATIONS.map((v) => (
                  <Pressable
                    key={v.id}
                    style={styles.varPill}
                    onPress={() => addChord(variationChord(key, varDegree, v.id as VariationId))}>
                    <Text style={styles.varPillText}>{v.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {tab === 'advanced' && (
            <View>
              <Text style={styles.groupTitle}>SECONDARY DOMINANT</Text>
              <View style={styles.grid}>
                {secDoms.map((c) => (
                  <LibraryCard key={c.id} chord={c} width={wAdv} onPress={() => addChord(c)} />
                ))}
              </View>
              <Text style={[styles.groupTitle, { marginTop: 8 }]}>MODAL INTERCHANGE</Text>
              <View style={styles.grid}>
                {modals.map((c) => (
                  <LibraryCard key={c.id} chord={c} width={wAdv} onPress={() => addChord(c)} />
                ))}
              </View>
            </View>
          )}

          {tab === 'slash' && (
            <View>
              <Text style={styles.subHint}>対象コード</Text>
              <View style={styles.degreeRow}>
                {diatonic.map((c, i) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setSlashTarget(i)}
                    style={[styles.targetChip, i === slashTarget && styles.degreeChipActive]}>
                    <Text
                      style={[
                        styles.degreeChipText,
                        i === slashTarget && styles.degreeChipTextActive,
                      ]}>
                      {c.displayName}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.slashPreviewBox}>
                <Text style={styles.slashPreview}>
                  {diatonic[slashTarget]?.displayName}
                  <Text style={styles.slashPreviewDim}>/ベース</Text>
                </Text>
                <Text style={styles.slashPreviewNote}>ベース音を選んで追加</Text>
              </View>

              <Text style={styles.subHint}>ベース音</Text>
              <View style={styles.grid}>
                {bassNotes.map((n) => (
                  <Pressable
                    key={n}
                    style={[styles.bassChip, { width: wBass }]}
                    onPress={() =>
                      diatonic[slashTarget] &&
                      addChord(slashChord(key, diatonic[slashTarget], n))
                    }>
                    <Text style={styles.bassChipText}>/{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {/* ── Export CTA ─────────────────────────────────── */}
      <Pressable onPress={() => router.push('/export')} style={styles.exportCta}>
        <Icon name="video" size={18} color={colors.purpleSoft} strokeWidth={2} />
        <Text style={styles.exportCtaText}>動画を書き出す</Text>
      </Pressable>

      {/* ── Key picker modal ───────────────────────────── */}
      <Modal
        visible={keyPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setKeyPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setKeyPickerOpen(false)}>
          <View style={styles.keyPicker}>
            <Text style={styles.keyPickerTitle}>キーを選択</Text>
            <View style={styles.keyGrid}>
              {MAJOR_KEYS.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => changeKey(k)}
                  style={[styles.keyOption, k === key && styles.keyOptionActive]}>
                  <Text style={[styles.keyOptionText, k === key && styles.keyOptionTextActive]}>
                    {k}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScreenScaffold>
  );
}

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function IconBtn({
  icon,
  onPress,
  disabled,
  tint,
}: {
  icon: IconName;
  onPress?: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.iconBtn, disabled && styles.iconBtnDisabled]}
      hitSlop={4}>
      <Icon
        name={icon}
        size={15}
        color={disabled ? colors.textFaintest : tint ?? colors.textMuted}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

function ToggleField({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleField}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Toggle value={value} onValueChange={onValueChange} width={38} height={22} />
    </View>
  );
}

function SummaryChip({
  icon,
  label,
  value,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.summaryChip} onPress={onPress}>
      <Icon name={icon} size={13} color={colors.textFaint} />
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>
        {value}
      </Text>
      <Icon name="chevronRight" size={12} color={colors.textFaint} strokeWidth={2.4} />
    </Pressable>
  );
}

function ActionBtn({
  icon,
  onPress,
  danger,
}: {
  icon: IconName;
  onPress?: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.actionBtn, danger && styles.actionBtnDanger]}>
      <Icon
        name={icon}
        size={15}
        color={danger ? colors.dangerText : colors.textMuted}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

function LibraryCard({
  chord,
  width,
  onPress,
}: {
  chord: LibraryChord;
  width: number;
  onPress: () => void;
}) {
  const accent = functionColor[chord.function];
  const locked = !!chord.isPro;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.libCard, { width }, locked && styles.libCardLocked]}>
      <View style={styles.libTop}>
        <Text style={styles.libDegree} numberOfLines={1}>
          {chord.degreeLabel}
        </Text>
        <View style={[styles.libDot, { backgroundColor: accent }]} />
      </View>
      <Text style={[styles.libName, locked && styles.libNameLocked]} numberOfLines={1}>
        {chord.displayName}
      </Text>
      <View style={styles.libBottom}>
        {chord.subLabel ? (
          <View style={styles.libPill}>
            <Text style={styles.libPillText} numberOfLines={1}>
              {chord.subLabel}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
        <View style={[styles.libBadge, { backgroundColor: rgba(accent, 0.16) }]}>
          <Text style={[styles.libBadgeText, { color: accent }]}>
            {FUNCTION_BADGE[chord.function]}
          </Text>
        </View>
      </View>
      {locked && (
        <View style={styles.libLock}>
          <Icon name="lock" size={11} color={colors.gold} strokeWidth={2.4} />
        </View>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  keyChipLabel: { fontSize: 8.5, color: colors.textFaint, fontFamily: font.bold, fontWeight: '700' },
  keyChipValue: { fontSize: 13, color: colors.textPrimary, fontFamily: font.bold, fontWeight: '700' },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: { opacity: 0.4 },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 12,
  },
  projectTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  savedText: { fontSize: 11, fontFamily: font.semibold, fontWeight: '600' },

  /* transport */
  transportBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius['2xl'],
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  bpmBox: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  bpmValue: { fontSize: 20, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  bpmUnit: { fontSize: 10, color: colors.textFaint, fontFamily: font.semibold, fontWeight: '600' },
  tapBtn: {
    marginLeft: 4,
    backgroundColor: '#243149',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tapBtnText: { fontSize: 9.5, color: '#94a0b5', fontFamily: font.bold, fontWeight: '700' },
  transportToggles: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  toggleField: { alignItems: 'center', gap: 4 },
  toggleLabel: { fontSize: 8.5, color: colors.textDim, fontFamily: font.semibold, fontWeight: '600' },
  playBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  playBtnActive: { opacity: 0.85 },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  summaryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  summaryLabel: { fontSize: 10.5, color: colors.textFaint, fontFamily: font.semibold, fontWeight: '600' },
  summaryValue: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: font.bold,
    fontWeight: '700',
  },

  /* progression strip */
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
    paddingHorizontal: 2,
  },
  stripKey: { fontSize: 13, fontFamily: font.bold, fontWeight: '700', color: colors.textHeading },
  barCount: { fontSize: 10.5, color: colors.textFaint },
  stripScroll: { marginBottom: 12 },
  stripRow: { flexDirection: 'row', alignItems: 'stretch', gap: 5 },
  emptyStrip: {
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyHint: { fontSize: 13, color: colors.textDim, fontFamily: font.semibold, fontWeight: '600' },
  timeCard: {
    width: 82,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderLeftWidth: 4,
    borderRadius: radius.xl,
    paddingVertical: 9,
    paddingHorizontal: 8,
  },
  timeCardSelected: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderLeftWidth: 4,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  timeTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 },
  timeName: { flexShrink: 1, fontSize: 14, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  timeDegree: { fontSize: 9, color: colors.textDim },
  timeDur: {
    marginTop: 8,
    alignItems: 'center',
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.sm,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  timeDurText: { fontSize: 9.5, color: colors.textTertiary },
  arrow: { alignSelf: 'center', color: colors.textArrow, fontSize: 15 },

  /* inline actions */
  inlinePanel: {
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.xl,
    padding: 10,
    marginBottom: 18,
    gap: 10,
  },
  inlineHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inlineLabel: { flex: 1, fontSize: 11.5, color: colors.textTertiary, fontFamily: font.semibold, fontWeight: '600' },
  inlineBtns: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDanger: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },

  /* library */
  libHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  libTitle: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.textHeading },
  chevronBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabTrack: { marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  libCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 74,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  libCardLocked: { backgroundColor: colors.surfaceLocked, borderColor: colors.borderFaint },
  libTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  libDegree: { flexShrink: 1, fontSize: 9.5, color: colors.textDim, fontFamily: font.semibold, fontWeight: '600' },
  libDot: { width: 7, height: 7, borderRadius: 4 },
  libName: {
    fontSize: 17,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
    marginVertical: 2,
  },
  libNameLocked: { color: colors.textFaint },
  libBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  libPill: {
    flexShrink: 1,
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  libPillText: { fontSize: 8.5, color: colors.textTertiary, fontFamily: font.semibold, fontWeight: '600' },
  libBadge: { marginLeft: 'auto', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  libBadgeText: { fontSize: 8.5, fontFamily: font.bold, fontWeight: '700' },
  libLock: { position: 'absolute', top: 6, right: 7 },

  /* variation / degree pickers */
  subHint: {
    fontSize: 11.5,
    color: colors.textDim,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginBottom: 8,
    marginHorizontal: 2,
  },
  groupTitle: {
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.textFaint,
    fontFamily: font.bold,
    fontWeight: '700',
    marginBottom: 8,
    marginHorizontal: 2,
  },
  degreeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  degreeChip: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  degreeChipActive: { backgroundColor: rgba(colors.primary, 0.2), borderColor: colors.primary },
  degreeChipText: { fontSize: 12, color: colors.textMuted, fontFamily: font.semibold, fontWeight: '600' },
  degreeChipTextActive: { color: colors.textBright, fontFamily: font.bold, fontWeight: '700' },
  targetChip: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  varRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  varPill: {
    backgroundColor: rgba(colors.pink, 0.12),
    borderWidth: 1,
    borderColor: rgba(colors.pink, 0.4),
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  varPillText: { fontSize: 13, color: colors.pinkText, fontFamily: font.bold, fontWeight: '700' },

  /* slash */
  slashPreviewBox: {
    backgroundColor: colors.surfacePanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.lg,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14,
  },
  slashPreview: { fontSize: 22, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },
  slashPreviewDim: { fontSize: 15, color: colors.textFaint, fontFamily: font.semibold, fontWeight: '600' },
  slashPreviewNote: { fontSize: 10.5, color: colors.textFaint, marginTop: 4 },
  bassChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
  },
  bassChipText: { fontSize: 13, color: colors.textSecondary, fontFamily: font.bold, fontWeight: '700' },

  /* export */
  exportCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: 'rgba(124,92,255,0.55)',
    borderRadius: radius['2xl'],
    paddingVertical: 15,
    marginTop: 20,
  },
  exportCtaText: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.purpleSoft },

  /* key picker modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  keyPicker: {
    width: '100%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius['2xl'],
    padding: 18,
  },
  keyPickerTitle: {
    fontSize: 14,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textHeading,
    marginBottom: 14,
  },
  keyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keyOption: {
    width: '22%',
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  keyOptionActive: { backgroundColor: rgba(colors.primary, 0.22), borderColor: colors.primary },
  keyOptionText: { fontSize: 14, color: colors.textSecondary, fontFamily: font.bold, fontWeight: '700' },
  keyOptionTextActive: { color: colors.textBright },
});
