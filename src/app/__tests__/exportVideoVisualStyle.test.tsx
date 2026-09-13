import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

import type { VideoVisualStyle } from '@/services/videoExport/videoVisualStyle';
import ExportScreen from '../export';

const mockExportAndSave = jest.fn<
  Promise<void>,
  [Record<string, unknown>, Record<string, unknown>]
>(async () => undefined);
const mockExportAndShare = jest.fn<
  Promise<void>,
  [Record<string, unknown>, Record<string, unknown>]
>(async () => undefined);
const mockUseVideoVisualStylePreference = jest.fn();

jest.mock('react', () => {
  const actual = jest.requireActual<typeof import('react')>('react');
  return { ...actual, useEffect: jest.fn() };
});
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('@/components/ChordKeyboard', () => ({ ChordKeyboard: () => null }));
jest.mock('@/components/GradientText', () => ({
  GradientText: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/Icon', () => ({ Icon: () => null }));
jest.mock('@/components/ScreenScaffold', () => ({
  ScreenScaffold: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/features/editor/playback', () => ({ chordPreviewMidiNotes: () => [] }));
jest.mock('@/features/editor/session', () => ({
  useEditorSession: () => ({
    title: 'Style test',
    key: 'C',
    tempoBpm: 120,
    progression: [
      {
        id: 'c',
        chordId: 'c',
        rootOffset: 0,
        suffix: '',
        displayName: 'C',
        degreeLabel: 'I',
        function: 'tonic',
        durationBeats: 4,
        isPro: false,
      },
    ],
    grooveId: 'straight',
    accompanimentPattern: 'whole',
    accompanimentVariant: undefined,
    accompanimentEnergy: 'build',
    instrumentId: 'piano',
    releaseCut: false,
    octaveShift: 0,
    drumMode: 'off',
    drumBeat: '8',
    instrumentEffect: 'sustain',
  }),
}));
jest.mock('@/features/export/useMidiExport', () => ({
  useMidiExport: () => ({ exporting: false, run: jest.fn() }),
}));
jest.mock('@/features/videoExport/VideoVisualStyleSelector', () => ({
  VideoVisualStyleSelector: () => null,
}));
jest.mock('@/features/videoExport/useVideoVisualStylePreference', () => ({
  useVideoVisualStylePreference: () => mockUseVideoVisualStylePreference(),
}));
jest.mock('@/lib/exportCycleTiming', () => ({ progressionCycleDurationSec: () => 2 }));
jest.mock('@/lib/performance/rhythms', () => ({ beatsPerBarFor: () => 4 }));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/billing', () => ({ getTier: () => 'free' }));
jest.mock('@/services/videoExport', () => ({
  videoExportService: {
    exportAndSave: (input: Record<string, unknown>, options: Record<string, unknown>) =>
      mockExportAndSave(input, options),
    exportAndShare: (input: Record<string, unknown>, options: Record<string, unknown>) =>
      mockExportAndShare(input, options),
  },
}));

async function renderWithStyle(visualStyle: VideoVisualStyle) {
  mockUseVideoVisualStylePreference.mockReturnValue({
    visualStyle,
    selectVisualStyle: jest.fn(),
  });
  const view = render(<ExportScreen />);
  await act(
    () =>
      new Promise<void>((resolve) => {
        setImmediate(resolve);
      }),
  );
  return view;
}

describe('ExportScreen video visual style propagation', () => {
  beforeEach(() => {
    mockExportAndSave.mockClear();
    mockExportAndShare.mockClear();
    mockUseVideoVisualStylePreference.mockReset();
  });

  it('does not expose the retired Compare template', async () => {
    const view = await renderWithStyle('classic');

    expect(view.queryByText('聴き比べ')).toBeNull();
    expect(view.queryByText('原型＋変奏')).toBeNull();
  });

  it('passes Classic through the Save export input', async () => {
    const view = await renderWithStyle('classic');

    fireEvent.press(view.getByText('写真に保存'));

    await waitFor(() => expect(mockExportAndSave).toHaveBeenCalledTimes(1));
    expect(mockExportAndSave.mock.calls[0][0]).toMatchObject({
      visualStyle: 'classic',
    });
    expect(mockExportAndShare).not.toHaveBeenCalled();
  });

  it('passes Flow through the Share export input', async () => {
    const view = await renderWithStyle('flow');

    fireEvent.press(view.getByText('共有する'));

    await waitFor(() => expect(mockExportAndShare).toHaveBeenCalledTimes(1));
    expect(mockExportAndShare.mock.calls[0][0]).toMatchObject({
      visualStyle: 'flow',
    });
    expect(mockExportAndSave).not.toHaveBeenCalled();
  });
});
