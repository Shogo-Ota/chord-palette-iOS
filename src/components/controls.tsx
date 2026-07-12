import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { colors, font, primaryGradient, radius, sliderGradient } from '@/theme/tokens';

/* ------------------------------------------------------------------ */
/* Section title                                                       */
/* ------------------------------------------------------------------ */
export function SectionTitle({
  children,
  right,
  style,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented track (inset, selected = primary gradient pill)           */
/* ------------------------------------------------------------------ */
export type SegOption = { key: string; label: string };

export function SegTrack({
  options,
  value,
  onChange,
  style,
  itemStyle,
}: {
  options: SegOption[];
  value: string;
  onChange?: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  itemStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.segTrack, style]}>
      {options.map((opt) => {
        const active = opt.key === value;
        const label = (
          <Text style={[styles.segLabel, active ? styles.segLabelActive : undefined]}>{opt.label}</Text>
        );
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange?.(opt.key)}
            style={[styles.segItem, itemStyle]}>
            {active ? (
              <LinearGradient
                colors={primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.segItemActive}>
                {label}
              </LinearGradient>
            ) : (
              label
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Chip group (separate cards; selected = purple/blue tint + border)   */
/* ------------------------------------------------------------------ */
export type ChipOption = { key: string; label: string; locked?: boolean };

export function Chip({
  label,
  active,
  locked,
  onPress,
  style,
  textStyle,
}: {
  label: string;
  active?: boolean;
  locked?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const content = (
    <>
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : undefined,
          locked ? styles.chipTextLocked : undefined,
          textStyle,
        ]}>
        {label}
      </Text>
      {locked && (
        <View style={styles.chipLock}>
          <Icon name="lock" size={11} color={colors.gold} strokeWidth={2.4} />
        </View>
      )}
    </>
  );

  if (active) {
    return (
      <Pressable onPress={onPress} style={[styles.chipBase, style]}>
        <LinearGradient
          colors={['rgba(124,92,255,0.22)', 'rgba(91,140,255,0.22)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.chipActiveFill]}
        />
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chipBase, locked ? styles.chipLocked : styles.chipIdle, style]}>
      {content}
    </Pressable>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
  gap = 8,
  style,
  chipStyle,
}: {
  options: ChipOption[];
  value: string;
  onChange?: (key: string) => void;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  chipStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', gap }, style]}>
      {options.map((o) => (
        <Chip
          key={o.key}
          label={o.label}
          active={o.key === value}
          locked={o.locked}
          onPress={() => onChange?.(o.key)}
          style={[{ flex: 1 }, chipStyle]}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Select field (label + value + chevron)                              */
/* ------------------------------------------------------------------ */
export function SelectField({
  label,
  value,
  onPress,
  flex,
  right,
  style,
}: {
  label: string;
  value: string;
  onPress?: () => void;
  flex?: number;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.field, flex != null ? { flex } : undefined, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Text style={styles.fieldValue}>{value}</Text>
        {right ?? <Icon name="chevronDown" size={13} color="#7f8aa0" strokeWidth={2.5} />}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle switch                                                       */
/* ------------------------------------------------------------------ */
export function Toggle({
  value,
  onValueChange,
  width = 42,
  height = 25,
}: {
  value: boolean;
  onValueChange?: (v: boolean) => void;
  width?: number;
  height?: number;
}) {
  const knob = height - 5;
  const body = (
    <View
      style={{
        position: 'absolute',
        top: 2.5,
        left: value ? width - knob - 3 : 3,
        width: knob,
        height: knob,
        borderRadius: knob / 2,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.4,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
      }}
    />
  );
  return (
    <Pressable onPress={() => onValueChange?.(!value)}>
      {value ? (
        <LinearGradient
          colors={sliderGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width, height, borderRadius: height / 2 }}>
          {body}
        </LinearGradient>
      ) : (
        <View style={{ width, height, borderRadius: height / 2, backgroundColor: '#2f3849' }}>{body}</View>
      )}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Volume slider (visual)                                              */
/* ------------------------------------------------------------------ */
export function VolumeSlider({ label, percent }: { label: string; percent: number }) {
  return (
    <View style={styles.volRow}>
      <Text style={styles.volLabel}>{label}</Text>
      <View style={styles.volTrack}>
        <LinearGradient
          colors={sliderGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.volFill, { width: `${percent}%` }]}
        />
        <View style={[styles.volKnob, { left: `${percent}%` }]} />
      </View>
      <Text style={styles.volValue}>{percent}%</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Meta pill (C Major / 120 BPM / tags)                                */
/* ------------------------------------------------------------------ */
export function MetaPill({ label }: { label: string }) {
  return (
    <View style={styles.metaPill}>
      <Text style={styles.metaPillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: { fontSize: 14, fontFamily: font.bold, fontWeight: '700', color: colors.textHeading },

  segTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.surfaceInput,
    borderRadius: radius.lg,
    padding: 4,
  },
  segItem: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  segItemActive: { borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segLabel: {
    textAlign: 'center',
    paddingVertical: 7,
    fontSize: 12,
    fontFamily: font.semibold,
    fontWeight: '600',
    color: colors.textDim,
  },
  segLabelActive: { color: colors.white, fontFamily: font.bold, fontWeight: '700' },

  chipBase: {
    borderRadius: radius.lg,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipActiveFill: { borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary },
  chipIdle: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  chipLocked: { backgroundColor: colors.surfaceLocked, borderWidth: 1, borderColor: colors.borderFaint },
  chipText: { fontSize: 12.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textMuted },
  chipTextActive: { color: colors.white, fontFamily: font.bold, fontWeight: '700' },
  chipTextLocked: { color: colors.textFaint },
  chipLock: { position: 'absolute', top: 6, right: 7 },

  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  fieldLabel: {
    fontSize: 10.5,
    color: colors.textFaint,
    fontFamily: font.semibold,
    fontWeight: '600',
    marginBottom: 4,
  },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValue: { fontSize: 15, fontFamily: font.bold, fontWeight: '700', color: colors.textPrimary },

  volRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  volLabel: { fontSize: 12, color: colors.textTertiary, fontFamily: font.semibold, fontWeight: '600', width: 56 },
  volTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#2a3346', justifyContent: 'center' },
  volFill: { position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3 },
  volKnob: {
    position: 'absolute',
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  volValue: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: font.bold,
    fontWeight: '700',
    width: 34,
    textAlign: 'right',
  },

  metaPill: { backgroundColor: colors.surfaceChip, paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.sm },
  metaPillText: { fontSize: 11.5, fontFamily: font.semibold, fontWeight: '600', color: colors.textTertiary },
});
