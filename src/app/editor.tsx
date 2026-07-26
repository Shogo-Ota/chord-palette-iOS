import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import {
  CPChordContextMenu,
  CPCoachMarks,
  CPSettingChip,
  CPSuggestionBar,
  CPTransportBar,
  CPVariationPills,
  type CPVariationPill,
} from '@/components/cp';
import { SegTrack } from '@/components/controls';
import { ScreenScaffold } from '@/components/ScreenScaffold';
import { UpsellToast, useUpsellToast } from '@/components/UpsellToast';
import { Wordmark } from '@/components/Wordmark';
import { GROOVE_LABELS, INSTRUMENT_LABELS } from '@/data/labels';
import {
  ALL_VARIATIONS,
  availableVariations,
  chromaticBassNotes,
  degreeIndexFromRootOffset,
  extendedVariations,
  diatonicLibrary,
  diatonicSeventhLibrary,
  MAJOR_KEYS,
  modalInterchange,
  secondaryDominants,
  slashChord,
  variationChord,
  type VariationId,
} from '@/data/music';
import { loadAdminMode, useAdminMode } from '@/features/admin/adminMode';
import { chordPreviewRequest, sessionToPlaybackRequest } from '@/features/editor/playback';
import * as session from '@/features/editor/session';
import { getSession, useEditorSession } from '@/features/editor/session';
import { useAutosave } from '@/features/editor/useAutosave';
import { useChordSuggestions } from '@/features/editor/useChordSuggestions';
import { useEditorActions } from '@/features/editor/useEditorActions';
import { isLocked } from '@/lib/entitlements';
import { isKeyLocked } from '@/lib/keyAccess';
import { distinctKeys, eventKey, isMultiKey, keyColorSlots } from '@/lib/keyColor';
import { hapticError, hapticSelection, hapticSoft, hapticSuccess } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import {
  MAX_BARS,
  chordIndexAtBeat,
  durationLabel,
  totalBars as calcTotalBars,
} from '@/lib/progression';
import type { ProgressionSuggestion } from '@/lib/theory/progression/suggestNext';
import { getEditorTutorialSeen, setEditorTutorialSeen } from '@/repositories/sessionPrefsRepository';
import { track } from '@/services/analytics';
import { audioService } from '@/services/audio';
import type { PlaybackState } from '@/services/audio/types';
import { useEntitlements } from '@/services/billing';
import { colors, font, functionColor, keyTintSolids, motion, playNeonColor, radius, spacing, typeSize } from '@/theme/tokens';
import type { ChordDuration, ChordFunction, LibraryChord, MajorKey } from '@/types';

const H_PAD = 16;

const BPM_PRESETS = [60, 70, 80, 90, 100, 110, 120, 130, 140, 160, 180, 200];

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
    definitionId: c.definitionId,
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
  const upsell = useUpsellToast();
  const chordSuggestions = useChordSuggestions();

  // First-run coach marks: shown once, persisted in app_meta. Kept UI-only here;
  // the overlay component is presentational and self-dismissing.
  const [showTutorial, setShowTutorial] = useState(false);
  useEffect(() => {
    let active = true;
    getEditorTutorialSeen()
      .then((seen) => {
        if (active && !seen) setShowTutorial(true);
      })
      .catch((e) => logger.error('Tutorial flag read failed', { error: String(e) }));
    return () => {
      active = false;
    };
  }, []);
  const dismissTutorial = useCallback(() => {
    setShowTutorial(false);
    setEditorTutorialSeen().catch((e) =>
      logger.error('Tutorial flag write failed', { error: String(e) }),
    );
  }, []);

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
  const bpm = s.tempoBpm;
  const title = s.title;

  /* ---- UI-only local state -------------------------------------- */
  const [loop, setLoop] = useState(true);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const [keyMode, setKeyMode] = useState<'change' | 'transpose'>('change');
  const [bpmPickerOpen, setBpmPickerOpen] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  /** Collapsed on open — progression strip is the main stage; library on demand. */
  const [libOpen, setLibOpen] = useState(false);
  const [tab, setTab] = useState<LibraryTab>('diatonic');
  const [chordSize, setChordSize] = useState<'triad' | 'seventh'>('triad');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [showMoreTensions, setShowMoreTensions] = useState(false);
  const isAdmin = useAdminMode();
  const playLift = useRef(new Animated.Value(0)).current;
  const stripScrollRef = useRef<ScrollView>(null);
  const stripViewportW = useRef(0);
  const cardLayoutsRef = useRef<Record<number, { x: number; width: number }>>({});
  const saveToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tapsRef = useRef<number[]>([]);

  const showSaveToast = useCallback(() => {
    setSaveToast(true);
    if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
    saveToastTimer.current = setTimeout(() => setSaveToast(false), 1800);
  }, []);

  useEffect(
    () => () => {
      if (saveToastTimer.current) clearTimeout(saveToastTimer.current);
    },
    [],
  );

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => setReduceMotion(!!v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => {
      setReduceMotion(!!v);
    });
    return () => {
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    loadAdminMode();
  }, []);

  const prepareAudio = useCallback(() => {
    setAudioError(null);
    audioService
      .prepare()
      .then(() => {
        if (__DEV__) void audioService.logDiagnostics('editor: after prepare');
      })
      .catch((e) => {
        logger.error('Audio prepare failed', { error: String(e) });
        setAudioError('音源の準備に失敗しました。再試行してください。');
        hapticError();
      });
  }, []);

  /* Progression ref so the position listener always sees the latest cards
     without re-subscribing (native chordIndex is a PE note index — unusable). */
  const progressionRef = useRef(progression);
  progressionRef.current = progression;

  /* ---- audio engine lifecycle (mount → prepare, unmount → release) */
  useEffect(() => {
    prepareAudio();
    const stateSub = audioService.addStateListener((e) => {
      setPlaybackState(e.state);
      if (e.state === 'stopped' || e.state === 'idle' || e.state === 'ready') setPlayingIndex(-1);
    });
    const posSub = audioService.addPositionListener((e) => {
      setPlayingIndex(chordIndexAtBeat(progressionRef.current, e.beat));
    });
    return () => {
      stateSub?.remove();
      posSub?.remove();
      audioService.teardown().catch(() => undefined);
    };
  }, [prepareAudio]);

  /* Playhead delight: lift active card; Reduce Motion → border/opacity only. */
  useEffect(() => {
    const active = playingIndex >= 0;
    if (reduceMotion) {
      playLift.setValue(active ? 1 : 0);
      return;
    }
    Animated.timing(playLift, {
      toValue: active ? 1 : 0,
      duration: motion.cardMs,
      useNativeDriver: true,
    }).start();
  }, [playingIndex, playLift, reduceMotion]);

  /* Keep the sounding card centered in the horizontal strip. */
  useEffect(() => {
    if (playingIndex < 0) return;
    const layout = cardLayoutsRef.current[playingIndex];
    const vw = stripViewportW.current;
    if (!layout || vw <= 0) return;
    const targetX = layout.x + layout.width / 2 - vw / 2;
    stripScrollRef.current?.scrollTo({ x: Math.max(0, targetX), animated: true });
  }, [playingIndex]);

  /* ---- editing invalidates playback: stop so the next ▶ rebuilds --- */
  const didMountRef = useRef(false);
  const playbackStateRef = useRef(playbackState);
  playbackStateRef.current = playbackState;
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    // Only edits (progression/tempo/key/loop) trigger this — not transport state
    // changes — so starting playback never stops itself.
    if (playbackStateRef.current === 'playing' || playbackStateRef.current === 'paused') {
      audioService.stop().catch(() => undefined);
    }
  }, [progression, bpm, key, loop]);

  /* Sound settings (instrument / groove / accompaniment) are changed on the
     Groove screen; live re-apply lives in `useLiveSoundReapply` there so it
     still runs while this screen may be frozen underneath the stack. */

  /* ---- Auto-save (sprint-7 Phase C: Remove Save button) ----------
     Debounce + persistence live in the useAutosave hook (§4); it calls the
     existing session.save() only — Data Model unchanged. */
  useAutosave();

  /* ---- derived library ------------------------------------------ */
  const diatonicGrid = useMemo(
    () => (chordSize === 'seventh' ? diatonicSeventhLibrary(key) : diatonicLibrary(key)),
    [key, chordSize],
  );
  const secDoms = useMemo(() => secondaryDominants(key), [key]);
  const modals = useMemo(() => modalInterchange(key), [key]);
  const bassNotes = useMemo(() => chromaticBassNotes(key), [key]);

  /* Multi-key (modulation) visualization: color each chord by its key context.
   * Only shown when the progression actually spans >1 key (single-key unchanged). */
  const multiKey = useMemo(() => isMultiKey(progression, key), [progression, key]);
  const keySlots = useMemo(() => keyColorSlots(progression, key), [progression, key]);
  const keyLegend = useMemo(() => distinctKeys(progression, key), [progression, key]);
  const slotColor = (slot: number): string =>
    slot <= 0 ? colors.textFaint : keyTintSolids[(slot - 1) % keyTintSolids.length];

  const totalBars = calcTotalBars(progression);
  const selectedEvent = selected >= 0 ? progression[selected] : undefined;
  const selectedDegree = selectedEvent
    ? degreeIndexFromRootOffset(selectedEvent.rootOffset ?? 0)
    : -1;

  /**
   * The two tiers of variation pills for the selected degree. The core tier is the
   * short familiar row; the extended tier holds the richer colours and stays folded
   * away until asked for, so the default view does not grow.
   */
  const buildPills = useCallback(
    (ids: string[]): CPVariationPill[] =>
      ids.map((id) => {
        const variationId = id as VariationId;
        const meta = ALL_VARIATIONS.find((v) => v.id === variationId)!;
        const preview = variationChord(key, selectedDegree, variationId);
        return {
          id,
          label: meta.label,
          preview: preview.displayName,
          active:
            selectedEvent?.variation === id || selectedEvent?.suffix === preview.suffix,
          locked: isLocked(meta.isPro, ent),
        };
      }),
    [key, selectedDegree, selectedEvent, ent],
  );

  const corePills = useMemo(
    () => (selectedDegree < 0 ? [] : buildPills(availableVariations(selectedDegree))),
    [selectedDegree, buildPills],
  );
  const extendedPills = useMemo(
    () => (selectedDegree < 0 ? [] : buildPills(extendedVariations(selectedDegree))),
    [selectedDegree, buildPills],
  );

  const colW = (cols: number) => Math.floor((width - H_PAD * 2 - 8 * (cols - 1)) / cols);
  const wDia = colW(4);
  const wAdv = colW(3);
  const wBass = colW(6);

  /* ---- actions (delegate to the shared session) ----------------- */
  /** Tap again on the selected card clears highlight → library appends at the end. */
  const setSelected = (i: number) => {
    hapticSelection();
    session.setSelected(getSession().selected === i ? -1 : i);
  };
  const undo = session.undo;

  const isPlaying = playbackState === 'playing';

  function togglePlayback() {
    const s = getSession();
    if (isPlaying) {
      audioService.pause().catch((e) => logger.error('Audio pause failed', { error: String(e) }));
      return;
    }
    if (playbackState === 'paused') {
      audioService.resume().catch((e) => logger.error('Audio resume failed', { error: String(e) }));
      return;
    }
    if (s.progression.length === 0) return;
    track('playback_started', { chords: s.progression.length, loop });
    audioService
      .play(sessionToPlaybackRequest(s, loop, ent.palettePro ? 'pro' : 'free'))
      .catch((e) => logger.error('Audio play failed', { error: String(e) }));
  }

  /* ---- visibleActions view-model (sprint-7 §3/§6) ----------------
     Single source of truth for Undo/Loop/Play/Metronome visibility + state
     and chord-context capability. The View renders these declaratively
     (no inline can-do checks). */
  const actions = useEditorActions({
    playbackState,
    onTogglePlayback: togglePlayback,
  });
  const { visibleActions, chordContext } = actions;

  /* Long Press on a strip card selects it and opens the Context Menu (§4/§2 L2).
     Tap keeps its existing "select" behavior so the Core Loop is unchanged. */
  const openChordMenu = (i: number) => {
    session.setSelected(i);
    hapticSelection();
    setContextMenuOpen(true);
  };

  /** Apply a variation pill to the selected degree (both tiers route through here). */
  function pickVariation(id: string) {
    pickChord(variationChord(key, selectedDegree, id as VariationId));
  }

  /**
   * Library pick: with a progression card selected → replace that card in place
   * (duration kept). With nothing selected → append a new chord.
   */
  function pickChord(c: LibraryChord) {
    if (isLocked(c.isPro, ent)) {
      // Preview-only (試聴) for free users: audition the Pro chord's sound but do NOT
      // add/replace it in the progression (引用・編集 is Palette Pro). A non-blocking
      // toast keeps the upgrade path one tap away.
      if (!isPlaying) {
        const s2 = getSession();
        audioService
          .previewChord(chordPreviewRequest(c, s2.key, s2.tempoBpm, s2.instrumentId, s2.octaveShift))
          .catch(() => undefined);
      }
      upsell.show('高度なコードは Palette Pro。無料版は試聴のみ可能です');
      return;
    }
    const cur = getSession();
    const editing = cur.selected >= 0;
    if (editing) {
      const { durationBeats: _ignored, ...patch } = libToEvent(c);
      session.replaceSelected(patch);
      hapticSoft();
    } else {
      const before = cur.progression.length;
      session.addChord(libToEvent(c));
      const after = getSession().progression.length;
      track('chord_added', { category: c.category, count: after });
      if (before < 4 && after >= 4) hapticSuccess();
      else hapticSoft();
    }
    if (!isPlaying) {
      const s2 = getSession();
      audioService
        .previewChord(chordPreviewRequest(c, s2.key, s2.tempoBpm, s2.instrumentId, s2.octaveShift))
        .catch(() => undefined);
    }
  }

  /**
   * Append a one-tap "続き候補" suggestion to the end of the progression and audition
   * it. Suggestions are always additive (append mode) and are only shown when no card
   * is selected, so this never conflicts with the library's replace flow.
   */
  function pickSuggestion(sug: ProgressionSuggestion) {
    const before = getSession().progression.length;
    chordSuggestions.addSuggestion(sug);
    const after = getSession().progression.length;
    if (after <= before) return; // 16-bar cap reached — nothing added
    track('chord_added', { category: 'suggestion', count: after });
    if (before < 4 && after >= 4) hapticSuccess();
    else hapticSoft();
    if (!isPlaying) {
      const s2 = getSession();
      audioService
        .previewChord(
          chordPreviewRequest(
            { rootOffset: sug.rootOffset, suffix: sug.suffix },
            s2.key,
            s2.tempoBpm,
            s2.instrumentId,
            s2.octaveShift,
          ),
        )
        .catch(() => undefined);
    }
  }

  function close() {
    const finish = () => {
      if (router.canGoBack()) router.back();
      else router.replace('/');
    };
    if (s.dirty) {
      session
        .save()
        .catch((e) => logger.error('Failed to save project', { error: String(e) }))
        .finally(finish);
    } else {
      finish();
    }
  }

  function changeKey(k: MajorKey) {
    // Free tier is limited to C major; moving to any other key is Palette Pro.
    // Returning to C is always allowed so a free user can never get stuck.
    if (isKeyLocked(k, ent)) {
      setKeyPickerOpen(false);
      upsell.show('C以外のキーは Palette Pro で解放されます');
      return;
    }
    if (keyMode === 'transpose') session.transposeTo(k);
    else session.setKey(k);
    setKeyPickerOpen(false);
  }

  function changeTempo(next: number) {
    session.setTempo(next);
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
    <View style={styles.screenRoot}>
    <ScreenScaffold padH={H_PAD}>
      {/* ── Compact header ─────────────────────────────── */}
      <View style={styles.header}>
        <Wordmark size={14} withIcon iconSize={26} />
        <View style={styles.headerActions}>
          {isAdmin && progression.length > 0 ? (
            <IconBtn icon="bookmark" onPress={() => router.push('/admin-preset')} />
          ) : null}
          <IconBtn icon="share" onPress={() => router.push('/export')} />
          <IconBtn
            icon="save"
            onPress={() => {
              session
                .save()
                .then(() => {
                  hapticSuccess();
                  showSaveToast();
                })
                .catch((e) => {
                  logger.error('Failed to save project', { error: String(e) });
                  hapticError();
                });
            }}
          />
          <IconBtn icon="close" onPress={close} />
        </View>
      </View>
      {saveToast ? (
        <View style={styles.saveToast} accessibilityLiveRegion="polite">
          <Icon name="check" size={14} color={colors.successText} strokeWidth={2.6} />
          <Text style={styles.saveToastText}>メモリーに保存しました</Text>
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <Icon name="pencil" size={14} color={colors.textFaint} strokeWidth={2.2} />
        <TextInput
          value={title}
          onChangeText={(t) => session.setTitle(t)}
          placeholder="進行の名前"
          placeholderTextColor={colors.textFaint}
          style={styles.projectTitle}
          accessibilityLabel="進行の名前"
          accessibilityHint="タップして名前を編集"
          returnKeyType="done"
          maxLength={60}
        />
      </View>

      {/* ── Session settings: independent Key / Tempo / Style chips ─ */}
      <View style={styles.settingChips}>
        <CPSettingChip
          label="KEY"
          value={`${key} Major`}
          accessibilityLabel="キー"
          accessibilityHint="タップしてキーを変更"
          onPress={() => setKeyPickerOpen(true)}
        />
        <CPSettingChip
          label="TEMPO"
          value={`${bpm} BPM`}
          accessibilityLabel="テンポ"
          accessibilityHint="タップしてテンポを変更"
          onPress={() => setBpmPickerOpen(true)}
        />
        <CPSettingChip
          label="STYLE"
          value={`${GROOVE_LABELS[s.grooveId]} / ${INSTRUMENT_LABELS[s.instrumentId]}`}
          accessibilityLabel="スタイル"
          accessibilityHint="タップしてグルーヴと音色を変更"
          onPress={() => router.push('/groove')}
        />
      </View>

      {/* ── Transport (Undo · Play · Loop) ──────────────── */}
      <CPTransportBar
        playing={isPlaying}
        loading={visibleActions.play.state === 'loading'}
        showUndo={visibleActions.undo.state === 'ready'}
        showLoop={visibleActions.loop.state === 'ready'}
        loopOn={loop}
        onPlayPause={actions.onPlayPause}
        onUndo={undo}
        onLoop={() => setLoop((v) => !v)}
      />
      {audioError ? (
        <View style={styles.audioErrorBanner} accessibilityRole="alert">
          <Text style={styles.audioErrorText}>{audioError}</Text>
          <Pressable
            onPress={prepareAudio}
            hitSlop={8}
            style={styles.audioErrorRetry}
            accessibilityRole="button"
            accessibilityLabel="音源の再試行">
            <Text style={styles.audioErrorRetryText}>再試行</Text>
          </Pressable>
        </View>
      ) : null}

      {/* ── Progression strip (main stage) ─────────────── */}
      <View style={styles.stripStage}>
        <View style={styles.stripHeader}>
          <View style={styles.stripTitleRow}>
            <Text style={styles.stripTitle}>コード進行</Text>
            <Pressable
              onPress={() => router.push('/append-progression')}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="保存した進行を末尾に追加"
              style={styles.addProgBtn}>
              <Icon name="plus" size={12} color={colors.primary} strokeWidth={2.6} />
              <Text style={styles.addProgBtnText}>追加</Text>
            </Pressable>
            {progression.length > 0 ? (
              <Pressable
                onPress={() => session.clearProgression()}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="コードをすべて削除"
                style={styles.resetBtn}>
                <Icon name="trash" size={12} color={colors.textFaint} strokeWidth={2} />
                <Text style={styles.resetBtnText}>リセット</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.stripMeta}>
            <Text style={styles.stripKey}>KEY {key}</Text>
            <Text style={styles.barCount}>
              {totalBars} / {MAX_BARS}小節
            </Text>
          </View>
        </View>

        {multiKey && (
          <View style={styles.keyLegend}>
            {keyLegend.map((k, i) => (
              <View key={k} style={styles.keyLegendItem}>
                <View style={[styles.keyLegendDot, { backgroundColor: slotColor(i) }]} />
                <Text style={styles.keyLegendText}>
                  {k}
                  {i === 0 ? '（基準）' : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {progression.length === 0 ? (
          <View style={styles.emptyStrip}>
            <Text style={styles.emptyHint}>① 下のライブラリを開いてコードをタップ</Text>
            <Text style={styles.emptyHintSub}>② ▶ で再生 — これだけで完成</Text>
          </View>
        ) : (
          <ScrollView
            ref={stripScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stripScroll}
            contentContainerStyle={styles.stripScrollContent}
            onLayout={(e) => {
              stripViewportW.current = e.nativeEvent.layout.width;
            }}>
            <View style={styles.stripRow}>
              {progression.map((ev, i) => {
                const isActivePlay = i === playingIndex;
                const fn = functionColor[ev.function];
                const neon = playNeonColor[ev.function];
                return (
                  <React.Fragment key={ev.id}>
                    <Pressable
                      onPress={() => setSelected(i)}
                      onLongPress={() => openChordMenu(i)}
                      delayLongPress={350}
                      accessibilityRole="button"
                      accessibilityLabel={`${ev.displayName} ${ev.degreeLabel}`}
                      accessibilityHint="長押しで編集メニュー"
                      accessibilityState={{ selected: i === selected }}
                      onLayout={(e) => {
                        const { x, width } = e.nativeEvent.layout;
                        cardLayoutsRef.current[i] = { x, width };
                        // First layout after play starts may race the effect — center here too.
                        if (i === playingIndex && stripViewportW.current > 0) {
                          const targetX = x + width / 2 - stripViewportW.current / 2;
                          stripScrollRef.current?.scrollTo({
                            x: Math.max(0, targetX),
                            animated: true,
                          });
                        }
                      }}>
                      <Animated.View
                        style={[
                          styles.timeCard,
                          { borderLeftColor: fn, backgroundColor: rgba(fn, 0.1) },
                          i === selected && !isActivePlay && styles.timeCardSelected,
                          isActivePlay && styles.timeCardPlaying,
                          isActivePlay && {
                            backgroundColor: rgba(neon, 0.38),
                            borderColor: neon,
                            borderLeftColor: neon,
                            shadowColor: neon,
                          },
                          isActivePlay &&
                            !reduceMotion && {
                              transform: [
                                {
                                  translateY: playLift.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, -6],
                                  }),
                                },
                              ],
                            },
                          isActivePlay &&
                            reduceMotion && {
                              opacity: 0.96,
                            },
                        ]}>
                        <View style={styles.timeTop}>
                          <Text style={[styles.timeName, isActivePlay && styles.timeNamePlaying]}>
                            {ev.displayName}
                          </Text>
                          <Text style={[styles.timeDegree, { color: isActivePlay ? neon : fn }]}>
                            {ev.degreeLabel}
                          </Text>
                        </View>
                        <View style={styles.timeDur}>
                          <Text
                            style={[
                              styles.timeDurText,
                              isActivePlay && styles.timeDurTextPlaying,
                            ]}>
                            {durationLabel(ev.durationBeats)}
                          </Text>
                        </View>
                        {multiKey && (
                          <View
                            style={[
                              styles.keyBar,
                              { backgroundColor: slotColor(keySlots.get(eventKey(ev, key)) ?? 0) },
                            ]}
                          />
                        )}
                      </Animated.View>
                    </Pressable>
                    {i < progression.length - 1 && <Text style={styles.arrow}>→</Text>}
                  </React.Fragment>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Selected chord length switch (1 / 1/2 / 1/4 bar) */}
        {selectedEvent ? (
          <View style={styles.durationBar}>
            <Text style={styles.durationBarLabel}>
              長さ<Text style={styles.durationBarChord}> · {selectedEvent.displayName}</Text>
            </Text>
            <SegTrack
              options={DURATION_OPTIONS}
              value={String(selectedEvent.durationBeats)}
              onChange={(k) => {
                hapticSelection();
                const beats = Number(k) as ChordDuration;
                actions.setDuration(beats);
                track('chord_duration_changed', { beats });
              }}
              style={styles.durationSeg}
            />
          </View>
        ) : null}
      </View>

      {/* ── 続き候補（ワンタップ提案・末尾に追加。編集中は非表示） ── */}
      {selected < 0 ? (
        <CPSuggestionBar suggestions={chordSuggestions.suggestions} onPick={pickSuggestion} />
      ) : null}

      {/* ── Chord library (collapsible; collapsed by default) ── */}
      <View style={styles.libHeader}>
        <Text style={styles.libTitle}>コードライブラリ</Text>
        <Pressable onPress={() => setLibOpen((o) => !o)} hitSlop={10} style={styles.chevronBtn}>
          <View style={{ transform: [{ rotate: libOpen ? '0deg' : '-90deg' }] }}>
            <Icon name="chevronDown" size={18} color={colors.textMuted} strokeWidth={2.4} />
          </View>
        </Pressable>
      </View>
      {progression.length === 0 ? (
        <Text style={styles.libPlayHint}>コードを追加すると再生できます</Text>
      ) : null}

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
              <SegTrack
                options={[
                  { key: 'triad', label: '3和音' },
                  { key: 'seventh', label: 'セブンス (4和音)' },
                ]}
                value={chordSize}
                onChange={(k) => setChordSize(k as 'triad' | 'seventh')}
                style={styles.tabTrack}
              />
              {selectedEvent ? (
                <Text style={styles.editBanner}>
                  編集中：{selectedEvent.displayName}（{selectedEvent.degreeLabel}）—
                  タップで差し替え／もう一度カードをタップで解除→末尾に追加
                </Text>
              ) : (
                <Text style={styles.subHint}>未選択：ライブラリのタップで進行の末尾に追加</Text>
              )}
              <View style={styles.grid}>
                {diatonicGrid.map((c) => (
                  <LibraryCard
                    key={c.id}
                    chord={c}
                    width={wDia}
                    unlocked={ent.palettePro}
                    onPress={() => pickChord(c)}
                  />
                ))}
              </View>

              <Text style={styles.subHint}>バリエーション（飾り付け）— 選んだ進行コードに適用</Text>
              {!selectedEvent ? (
                <Text style={styles.varEmptyHint}>
                  上のコード進行でカードをタップしてから、飾り付けを選んでください
                </Text>
              ) : selectedDegree < 0 ? (
                <Text style={styles.varEmptyHint}>
                  このコードはダイアトニック以外のため、ここでの飾り付けは使えません（差し替えは上のグリッドから）
                </Text>
              ) : corePills.length === 0 && extendedPills.length === 0 ? (
                <Text style={styles.varEmptyHint}>
                  この度数（{selectedEvent.degreeLabel}）に足せるテンションはありません
                </Text>
              ) : (
                <>
                  <Text style={styles.varApplyTo}>
                    適用先： {selectedEvent.displayName}（{selectedEvent.degreeLabel}）
                  </Text>
                  {corePills.length > 0 && (
                    <CPVariationPills pills={corePills} onPress={pickVariation} />
                  )}
                  {extendedPills.length > 0 && (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded: showMoreTensions }}
                        style={styles.varMoreToggle}
                        onPress={() => setShowMoreTensions((v) => !v)}>
                        <Text style={styles.varMoreText}>
                          {showMoreTensions ? '色づけを閉じる' : `もっと色づけ（${extendedPills.length}）`}
                        </Text>
                        <View style={showMoreTensions && styles.varMoreChevronOpen}>
                          <Icon
                            name="chevronDown"
                            size={12}
                            color={colors.pinkText}
                            strokeWidth={2.4}
                          />
                        </View>
                      </Pressable>
                      {showMoreTensions && (
                        <CPVariationPills pills={extendedPills} onPress={pickVariation} />
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          )}

          {tab === 'advanced' && (
            <View>
              {selectedEvent ? (
                <Text style={styles.editBanner}>
                  編集中：{selectedEvent.displayName} — タップで差し替え
                </Text>
              ) : (
                <Text style={styles.subHint}>未選択時は末尾に追加</Text>
              )}
              <Text style={styles.groupTitle}>SECONDARY DOMINANT</Text>
              <View style={styles.grid}>
                {secDoms.map((c) => (
                  <LibraryCard
                    key={c.id}
                    chord={c}
                    width={wAdv}
                    unlocked={ent.palettePro}
                    onPress={() => pickChord(c)}
                  />
                ))}
              </View>
              <Text style={[styles.groupTitle, { marginTop: 8 }]}>MODAL INTERCHANGE</Text>
              <View style={styles.grid}>
                {modals.map((c) => (
                  <LibraryCard
                    key={c.id}
                    chord={c}
                    width={wAdv}
                    unlocked={ent.palettePro}
                    onPress={() => pickChord(c)}
                  />
                ))}
              </View>

              {/*
                Future harmony techniques (diminished passing, augmented, …) are not
                advertised until they ship — App Store Guideline 2.3.x discourages
                "coming soon" placeholders. Re-add a functional section here when live.
              */}
            </View>
          )}

          {tab === 'slash' && (
            <View>
              <Text style={styles.subHint}>オンコード — 選んだ進行コードにベースを付ける</Text>
              {!selectedEvent ? (
                <Text style={styles.varEmptyHint}>
                  上のコード進行でカードをタップしてから、ベース音を選んでください
                </Text>
              ) : (
                <>
                  <View style={styles.slashPreviewBox}>
                    <Text style={styles.slashPreview}>
                      {selectedEvent.displayName.split('/')[0]}
                      <Text style={styles.slashPreviewDim}>/ベース</Text>
                    </Text>
                    <Text style={styles.slashPreviewNote}>ベース音を選ぶと、その場で差し替え</Text>
                  </View>

                  <Text style={styles.subHint}>ベース音</Text>
                  <View style={styles.grid}>
                    {bassNotes.map((n) => {
                      const body: LibraryChord = {
                        id: selectedEvent.chordId,
                        displayName: selectedEvent.displayName.split('/')[0],
                        degreeLabel: selectedEvent.degreeLabel.split('/')[0],
                        function: selectedEvent.function,
                        rootOffset: selectedEvent.rootOffset,
                        suffix: selectedEvent.suffix,
                        category: selectedEvent.category ?? 'diatonic',
                        variation: selectedEvent.variation,
                        isPro: selectedEvent.isPro,
                      };
                      const preview = slashChord(key, body, n);
                      return (
                        <Pressable
                          key={n}
                          style={[styles.bassChip, { width: wBass }]}
                          onPress={() => pickChord(preview)}>
                          <Text style={styles.bassChipText}>/{n}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}
        </>
      )}

      {/*
        Melody presets are a planned feature. Not advertised on the shipping build
        (App Store Guideline 2.3.x — no "coming soon" placeholders). Restore this
        section with a functional entry point when the feature is live.
      */}

      {/* ── Chord Context Menu (Long Press → 編集) ───────── */}
      {chordContext.visible && selectedEvent && (
        <CPChordContextMenu
          visible={contextMenuOpen}
          chordLabel={selectedEvent.displayName}
          degreeLabel={selectedEvent.degreeLabel}
          durationBeats={selectedEvent.durationBeats}
          context={chordContext}
          onRequestClose={() => setContextMenuOpen(false)}
          onDuplicate={() => {
            actions.duplicateSelected();
            setContextMenuOpen(false);
          }}
          onMoveLeft={actions.moveSelectedLeft}
          onMoveRight={actions.moveSelectedRight}
          onDelete={() => {
            actions.deleteSelected();
            track('chord_removed');
            setContextMenuOpen(false);
          }}
          onSetDuration={(beats) => {
            actions.setDuration(beats);
            track('chord_duration_changed', { beats });
          }}
        />
      )}

      {/* ── BPM picker modal ───────────────────────────── */}
      <Modal
        visible={bpmPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBpmPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBpmPickerOpen(false)}>
          <View style={styles.keyPicker}>
            <Text style={styles.keyPickerTitle}>テンポ（BPM）</Text>
            <View style={styles.keyGrid}>
              {BPM_PRESETS.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => {
                    changeTempo(b);
                    setBpmPickerOpen(false);
                  }}
                  style={[styles.keyOption, b === bpm && styles.keyOptionActive]}>
                  <Text style={[styles.keyOptionText, b === bpm && styles.keyOptionTextActive]}>
                    {b}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.bpmFineRow}>
              <Pressable style={styles.bpmFineBtn} onPress={() => changeTempo(bpm - 1)} hitSlop={6}>
                <Text style={styles.bpmFineText}>− 1</Text>
              </Pressable>
              <Text style={styles.bpmFineValue}>{bpm} BPM</Text>
              <Pressable style={styles.bpmFineBtn} onPress={() => changeTempo(bpm + 1)} hitSlop={6}>
                <Text style={styles.bpmFineText}>+ 1</Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.sessionTap}
              onPress={tapTempo}
              accessibilityRole="button"
              accessibilityLabel="タップテンポ"
              accessibilityHint="ボタンを一定間隔で連打してテンポを設定">
              <Text style={styles.sessionTapText}>TAP TEMPO</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ── Key picker modal ───────────────────────────── */}
      <Modal
        visible={keyPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setKeyPickerOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setKeyPickerOpen(false)}>
          <View style={styles.keyPicker}>
            <Text style={styles.keyPickerTitle}>キーを選択</Text>
            <SegTrack
              options={[
                { key: 'change', label: 'キー変更' },
                { key: 'transpose', label: '移調' },
              ]}
              value={keyMode}
              onChange={(k) => setKeyMode(k as 'change' | 'transpose')}
              style={styles.keyModeTrack}
            />
            <Text style={styles.keyModeHint}>
              {keyMode === 'transpose'
                ? '曲全体を選んだキーへ移調します（配置済みコードも動きます）'
                : '配置済みコードはそのまま。ライブラリ／スケールの基準キーだけ変えます'}
            </Text>
            <View style={styles.keyGrid}>
              {MAJOR_KEYS.map((k) => {
                const locked = isKeyLocked(k, ent);
                return (
                  <Pressable
                    key={k}
                    onPress={() => changeKey(k)}
                    style={[
                      styles.keyOption,
                      k === key && styles.keyOptionActive,
                      locked && styles.keyOptionLocked,
                    ]}>
                    <Text
                      style={[
                        styles.keyOptionText,
                        k === key && styles.keyOptionTextActive,
                        locked && styles.keyOptionTextLocked,
                      ]}>
                      {k}
                    </Text>
                    {locked && (
                      <Icon name="lock" size={11} color={colors.textFaint} style={styles.keyOptionLock} />
                    )}
                  </Pressable>
                );
              })}
            </View>
            {!ent.palettePro && (
              <Text style={styles.keyFreeHint}>
                無料版はCメジャーのみ。他のキーは Palette Pro で解放されます。
              </Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </ScreenScaffold>
      <UpsellToast message={upsell.message} onPress={() => router.push('/paywall')} />
      <CPCoachMarks visible={showTutorial} onDismiss={dismissTutorial} />
    </View>
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
        size={18}
        color={disabled ? colors.textFaintest : tint ?? colors.textMuted}
        strokeWidth={2.2}
      />
    </Pressable>
  );
}

function LibraryCard({
  chord,
  width,
  onPress,
  unlocked,
}: {
  chord: LibraryChord;
  width: number;
  onPress: () => void;
  unlocked: boolean;
}) {
  const accent = functionColor[chord.function];
  const locked = !!chord.isPro && !unlocked;
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
  screenRoot: { flex: 1 },
  /* header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.s8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: { opacity: 0.4 },

  saveToast: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    backgroundColor: rgba(colors.success, 0.16),
    borderWidth: 1,
    borderColor: rgba(colors.success, 0.4),
  },
  saveToastText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.successText,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
    paddingTop: 4,
    paddingBottom: 12,
  },
  projectTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
    paddingVertical: 4,
    paddingHorizontal: 2,
    margin: 0,
  },

  settingChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s8,
    paddingBottom: spacing.s8,
  },
  sessionTap: {
    marginTop: 14,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  sessionTapText: {
    fontSize: typeSize.label,
    fontFamily: font.bold,
    color: colors.primaryBlue,
    letterSpacing: 0.5,
  },

  /* transport (BPM fine-tune, used by the BPM picker modal) */
  bpmFineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 10,
  },
  bpmFineBtn: {
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  bpmFineText: { fontSize: 14, color: colors.textSecondary, fontFamily: font.bold, fontWeight: '700' },
  bpmFineValue: { fontSize: 15, color: colors.textPrimary, fontFamily: font.bold, fontWeight: '700' },

  /* progression strip — main stage */
  stripStage: {
    marginBottom: spacing.s12,
    paddingTop: spacing.s12,
    paddingBottom: spacing.s12,
    paddingHorizontal: spacing.s12,
    borderRadius: radius['2xl'],
    backgroundColor: colors.surfacePanel,
    borderWidth: 1.5,
    borderColor: rgba(colors.primary, 0.28),
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.s8,
    paddingHorizontal: 2,
  },
  stripTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stripTitle: {
    fontSize: typeSize.label,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.purpleSoft,
    letterSpacing: 0.4,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  resetBtnText: {
    fontSize: 10,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textFaint,
  },
  addProgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: rgba(colors.primary, 0.5),
    backgroundColor: rgba(colors.primary, 0.12),
  },
  addProgBtnText: {
    fontSize: 10,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.primary,
  },
  stripMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.s8 },
  stripKey: {
    fontSize: 11,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  barCount: { fontSize: 10.5, color: colors.textFaint },
  keyLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.s12,
    marginTop: 6,
    marginBottom: 2,
  },
  keyLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  keyLegendDot: { width: 9, height: 9, borderRadius: 3 },
  keyLegendText: { fontSize: 10.5, color: colors.textDim, fontFamily: font.semibold, fontWeight: '600' },
  keyBar: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 4,
    height: 3,
    borderRadius: 2,
  },
  stripScroll: { marginBottom: 0 },
  /* Top padding absorbs the play-lift (-6) so the card isn’t clipped. */
  stripScrollContent: {
    paddingTop: 10,
    paddingBottom: 4,
    paddingHorizontal: 2,
    alignItems: 'flex-end',
  },
  stripRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  durationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.s12,
    marginTop: spacing.s12,
    paddingTop: spacing.s12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  durationBarLabel: {
    color: colors.textDim,
    fontFamily: font.semibold,
    fontWeight: '600',
    fontSize: typeSize.label,
  },
  durationBarChord: {
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  durationSeg: {
    flex: 1,
    maxWidth: 260,
  },
  emptyStrip: {
    borderWidth: 1.5,
    borderColor: rgba(colors.primary, 0.35),
    borderStyle: 'dashed',
    borderRadius: radius.xl,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rgba(colors.primary, 0.06),
  },
  emptyHint: { fontSize: typeSize.label, color: colors.textSecondary, fontFamily: font.semibold, fontWeight: '600' },
  emptyHintSub: {
    fontSize: 12,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginTop: 6,
  },
  timeCard: {
    minWidth: 72,
    minHeight: 72,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderLeftWidth: 5,
    borderRadius: radius.chordCard,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignSelf: 'flex-end',
  },
  timeCardSelected: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderLeftWidth: 5,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  timeCardPlaying: {
    borderWidth: 2.5,
    borderLeftWidth: 5,
    shadowOpacity: 0.95,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  timeNamePlaying: {
    color: colors.white,
    textShadowColor: 'rgba(255,255,255,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  timeDurTextPlaying: {
    color: colors.textBright,
  },
  audioErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.lg,
    backgroundColor: rgba(colors.danger, 0.12),
    borderWidth: 1,
    borderColor: rgba(colors.danger, 0.35),
  },
  audioErrorText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  audioErrorRetry: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    minHeight: 44,
    justifyContent: 'center',
  },
  audioErrorRetryText: {
    fontSize: typeSize.label,
    color: colors.primary,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  timeTop: { gap: 3 },
  timeName: {
    fontSize: 15,
    lineHeight: 19,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  timeDegree: { fontSize: 10, lineHeight: 13, color: colors.textDim },
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

  /* library */
  libHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  libTitle: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.textHeading },
  libPlayHint: {
    color: colors.textFaint,
    fontSize: typeSize.caption,
    fontFamily: font.medium,
    marginTop: -4,
    marginBottom: spacing.s8,
    paddingHorizontal: 2,
  },
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
    fontSize: typeSize.body,
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
  comingBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: rgba(colors.primary, 0.4),
    backgroundColor: rgba(colors.primary, 0.12),
  },
  comingBadgeText: {
    fontSize: 8.5,
    letterSpacing: 0.8,
    color: colors.purpleText,
    fontFamily: font.bold,
    fontWeight: '700',
  },
  advTechRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginHorizontal: 2,
  },
  advTechHint: {
    fontSize: 11.5,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
    lineHeight: 17,
    marginHorizontal: 2,
    marginTop: 2,
  },
  melodyCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderStyle: 'dashed',
    backgroundColor: colors.surface,
  },
  melodyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  melodyTitle: {
    fontSize: 14,
    fontFamily: font.bold,
    fontWeight: '700',
    color: colors.textHeading,
  },
  melodyHint: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
    lineHeight: 17,
  },
  degreeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  degreeChip: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.s8,
    paddingHorizontal: spacing.s12,
  },
  degreeChipActive: { backgroundColor: rgba(colors.primary, 0.2), borderColor: colors.primary },
  degreeChipText: { fontSize: 12, color: colors.textMuted, fontFamily: font.semibold, fontWeight: '600' },
  degreeChipTextActive: { color: colors.textBright, fontFamily: font.bold, fontWeight: '700' },
  targetChip: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.s8,
    paddingHorizontal: spacing.s12,
  },
  editBanner: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.purpleSoft,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginBottom: 10,
    marginHorizontal: 2,
  },
  varApplyTo: {
    fontSize: 11.5,
    color: colors.textTertiary,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginBottom: 8,
    marginHorizontal: 2,
  },
  varMoreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: spacing.s8,
    marginBottom: 6,
  },
  varMoreText: {
    fontSize: typeSize.label,
    color: colors.pinkText,
    fontFamily: font.semibold,
    fontWeight: '600',
  },
  varMoreChevronOpen: { transform: [{ rotate: '180deg' }] },
  varEmptyHint: {
    fontSize: 11.5,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginBottom: 14,
    marginHorizontal: 2,
  },

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
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    alignItems: 'center',
  },
  bassChipText: { fontSize: typeSize.label, color: colors.textSecondary, fontFamily: font.bold, fontWeight: '700' },

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
    marginBottom: 12,
  },
  keyModeTrack: { marginBottom: 8 },
  keyModeHint: {
    fontSize: typeSize.caption,
    color: colors.textFaint,
    fontFamily: font.regular,
    lineHeight: 16,
    marginBottom: 14,
  },
  keyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  keyOption: {
    width: '22%',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.surfaceInput,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.s12,
    alignItems: 'center',
  },
  keyOptionActive: { backgroundColor: rgba(colors.primary, 0.22), borderColor: colors.primary },
  keyOptionLocked: { opacity: 0.55 },
  keyOptionText: { fontSize: 14, color: colors.textSecondary, fontFamily: font.bold, fontWeight: '700' },
  keyOptionTextActive: { color: colors.textBright },
  keyOptionTextLocked: { color: colors.textFaint },
  keyOptionLock: { position: 'absolute', top: 4, right: 4 },
  keyFreeHint: {
    marginTop: 12,
    fontSize: typeSize.caption,
    color: colors.textFaint,
    fontFamily: font.regular,
    lineHeight: 16,
  },
});
