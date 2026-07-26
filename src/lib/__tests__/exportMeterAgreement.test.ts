/**
 * The exported video and the audition must agree on when each chord changes.
 *
 * They reach that answer by different routes: the audio remeters voice-led
 * `PerfChord`s (`remeterChords`), while the drawn segments scale the stored
 * `durationBeats` (`remeterScale`). Nothing in the types forces those two to
 * stay in step, and a drift only shows up as a video whose chord captions slide
 * off the sound — which is expensive to notice by ear and easy to miss in the
 * 3-beat and 6-pulse rhythms where the scale factor is not 1.
 */

import { buildExportPlan } from '@/lib/exportPlan';
import { remeterChords } from '@/lib/performance/meter';
import { progressionToPerfChords } from '@/lib/performance/progressionInput';
import { RHYTHMS, beatsPerBarFor } from '@/lib/performance/rhythms';
import { secondsPerBeat } from '@/services/audio/schedule';
import type { ChordEvent } from '@/types';

function ev(
  displayName: string,
  rootOffset: number,
  durationBeats: number,
): ChordEvent {
  return {
    id: `${displayName}-${rootOffset}`,
    chordId: displayName,
    displayName,
    degreeLabel: 'I',
    function: 'tonic',
    rootOffset,
    suffix: '',
    durationBeats,
    isPro: false,
  } as ChordEvent;
}

// Uneven lengths on purpose: a uniform progression would pass even if the two
// paths scaled by different constants.
const PROG: ChordEvent[] = [
  ev('C', 0, 4),
  ev('Am', 9, 2),
  ev('F', 5, 2),
  ev('G', 7, 4),
];
const BPM = 120;
const KEY = 'C' as const;

/** Where the audio actually changes chord, in seconds from the top. */
function audioOnsets(beatsPerBar: number): number[] {
  const chords = remeterChords(progressionToPerfChords(PROG, KEY, 0), beatsPerBar);
  return chords.map((c) => c.startBeat * secondsPerBeat(BPM));
}

/** Where the drawn caption changes chord, in seconds from the top. */
function videoOnsets(beatsPerBar: number, durationSec: number): number[] {
  const plan = buildExportPlan({
    progression: PROG,
    key: KEY,
    bpm: BPM,
    title: 't',
    durationSec,
    audioUri: 'file://a.m4a',
    watermark: false,
    beatsPerBar,
  });
  return plan.segments.map((s) => s.startSec);
}

describe('export and playback agree on the meter', () => {
  it.each(RHYTHMS.map((r) => [r.id, r.label] as const))(
    '%s (%s) draws its chord changes where the audio makes them',
    (id) => {
      const beatsPerBar = beatsPerBarFor(id);
      const audio = audioOnsets(beatsPerBar);
      // One pass of the progression, so the tiling loop does not truncate it.
      const oneCycleSec = audio[audio.length - 1] + 1;
      const video = videoOnsets(beatsPerBar, oneCycleSec).slice(0, audio.length);

      expect(video).toHaveLength(audio.length);
      video.forEach((sec, i) => expect(sec).toBeCloseTo(audio[i], 6));
    },
  );

  it('counts a stored bar as one bar in every meter', () => {
    // 12 stored beats = 3 bars of 4/4. That has to stay 3 bars in 3/4 and 6/8,
    // or the waltz oom-pah restarts mid-harmony.
    for (const r of RHYTHMS) {
      const beatsPerBar = beatsPerBarFor(r.id);
      const plan = buildExportPlan({
        progression: PROG,
        key: KEY,
        bpm: BPM,
        title: 't',
        durationSec: 60,
        audioUri: 'file://a.m4a',
        watermark: false,
        beatsPerBar,
      });
      expect(plan.bars).toBe(3);
      expect(plan.beatsPerBar).toBe(beatsPerBar);
    }
  });

  it('keeps the waltz and 6/8 bars shorter in wall-clock than a 4/4 bar', () => {
    // A 3-beat bar at a fixed tempo is audibly shorter. If this ever comes out
    // equal, remetering has silently stopped applying.
    const fourFour = audioOnsets(4);
    const waltz = audioOnsets(3);
    const sixEight = audioOnsets(6);
    expect(waltz[1]).toBeLessThan(fourFour[1]);
    expect(sixEight[1]).toBeGreaterThan(fourFour[1]);
  });
});
