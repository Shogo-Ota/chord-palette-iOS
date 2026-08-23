/* eslint-disable import/first */

const mockDb = {
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(async () => mockDb),
}));

import { createProject, getProject } from '@/repositories/projectRepository';

const LEGACY_ROW = {
  id: 'legacy',
  title: 'Legacy',
  key: 'C',
  tempo_bpm: 100,
  time_signature: '4/4',
  instrument_id: 'piano',
  groove_id: 'pop8',
  accompaniment_pattern: 'natural',
  accompaniment_variant: 'natural.type1',
  accompaniment_energy: 'build',
  voicing_position: null,
  chord_events: JSON.stringify([
    {
      id: 'event-1',
      chordId: 'C',
      displayName: 'C',
      degreeLabel: 'I',
      function: 'tonic',
      durationBeats: 4,
      isPro: false,
      rootOffset: 0,
      suffix: '',
    },
  ]),
  created_at: 1,
  updated_at: 2,
};

describe('project voicing persistence', () => {
  beforeEach(() => {
    mockDb.getFirstAsync.mockReset();
    mockDb.runAsync.mockReset().mockResolvedValue(undefined);
  });

  it('migrates a legacy or invalid row to root position', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(LEGACY_ROW);
    await expect(getProject('legacy')).resolves.toMatchObject({ voicingPosition: 'root' });

    mockDb.getFirstAsync.mockResolvedValueOnce({
      ...LEGACY_ROW,
      voicing_position: 'not-a-position',
    });
    await expect(getProject('legacy')).resolves.toMatchObject({ voicingPosition: 'root' });
  });

  it('promotes a legacy Project position into every chord and retires the column', async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      ...LEGACY_ROW,
      voicing_position: 'first',
    });
    const loaded = await getProject('legacy');

    expect(loaded).toMatchObject({
      voicingPosition: 'root',
      chordEvents: [{ voicingPosition: 'first' }],
    });
  });

  it('writes new per-chord positions in chord_events while the old column stays root', async () => {
    const chordEvents = JSON.parse(LEGACY_ROW.chord_events);
    const created = await createProject({ voicingPosition: 'first', chordEvents });

    expect(created).toMatchObject({
      voicingPosition: 'root',
      chordEvents: [{ voicingPosition: 'first' }],
    });
    expect(mockDb.runAsync).toHaveBeenCalledTimes(1);
    const values = mockDb.runAsync.mock.calls[0]?.[1] as unknown[];
    expect(values[10]).toBe('root');
    expect(JSON.parse(String(values[11]))).toMatchObject([{ voicingPosition: 'first' }]);
  });

  it('defaults a new Project to root', async () => {
    const created = await createProject();

    expect(created.voicingPosition).toBe('root');
    expect(mockDb.runAsync.mock.calls[0]?.[1]).toContain('root');
  });
});
