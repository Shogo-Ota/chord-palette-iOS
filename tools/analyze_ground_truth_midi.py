"""Extract abstract groove features from a ground-truth MIDI (no phrase copy)."""

from __future__ import annotations

import json
import os
import statistics
import sys
from collections import defaultdict

import mido


def find_default_midi() -> str:
    raise SystemExit("Pass an absolute path to the .mid file as argv[1]")


def summarize(arr: list[float]) -> dict | None:
    if not arr:
        return None
    arr = sorted(arr)
    return {
        "n": len(arr),
        "min": round(min(arr), 3),
        "p25": round(statistics.quantiles(arr, n=4)[0] if len(arr) >= 4 else arr[0], 3),
        "median": round(statistics.median(arr), 3),
        "p75": round(statistics.quantiles(arr, n=4)[2] if len(arr) >= 4 else arr[-1], 3),
        "max": round(max(arr), 3),
        "mean": round(statistics.mean(arr), 3),
    }


def band(n: int) -> str:
    if n < 48:
        return "bass"
    if n < 60:
        return "mid_low"
    if n < 72:
        return "mid"
    return "high"


def main() -> None:
    path = sys.argv[1] if len(sys.argv) > 1 else find_default_midi()
    print("file:", path)
    print("size:", os.path.getsize(path))

    mid = mido.MidiFile(path)
    tpb = mid.ticks_per_beat
    print("type", mid.type, "ticks_per_beat", tpb, "tracks", len(mid.tracks))
    print("length_sec", round(mid.length, 2))

    notes: list[dict] = []
    for ti, track in enumerate(mid.tracks):
        t = 0
        active: dict[tuple[int, int], tuple[int, int]] = {}
        for msg in track:
            t += msg.time
            if msg.type == "note_on" and msg.velocity > 0:
                active[(msg.channel, msg.note)] = (t, msg.velocity)
            elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
                key = (msg.channel, msg.note)
                if key in active:
                    st, vel = active.pop(key)
                    notes.append(
                        {
                            "start": st,
                            "end": t,
                            "note": msg.note,
                            "vel": vel,
                            "track": ti,
                            "dur": t - st,
                        }
                    )

    print("notes", len(notes))
    if not notes:
        raise SystemExit("no notes")

    tempo = 500000
    for track in mid.tracks:
        for msg in track:
            if msg.type == "set_tempo":
                tempo = msg.tempo
                break
        else:
            continue
        break
    bpm = mido.tempo2bpm(tempo)
    print("tempo_bpm", round(bpm, 2))

    def tick_to_beat(tick: float) -> float:
        return tick / tpb

    def beat_to_ms(beats: float) -> float:
        return beats * (60000.0 / bpm)

    def nearest_grid(beat: float, grid: float = 0.25) -> tuple[float, float]:
        q = round(beat / grid) * grid
        return q, beat - q

    roles: dict[str, list[float]] = defaultdict(list)
    offsets_ms: dict[str, list[float]] = defaultdict(list)
    durs_beats: dict[str, list[float]] = defaultdict(list)
    vel_all: list[float] = []
    onset_beats: list[float] = []

    notes_sorted = sorted(notes, key=lambda n: n["start"])
    for n in notes_sorted:
        b = tick_to_beat(n["start"])
        onset_beats.append(b)
        vel_all.append(n["vel"])
        bar_beat = b % 4
        nearest_beat = round(bar_beat * 2) / 2
        rem = abs(bar_beat - nearest_beat)
        if rem < 0.05 and nearest_beat == int(nearest_beat):
            role = "downbeat"
        elif rem < 0.05:
            role = "upbeat"
        else:
            role = "sixteenth_off"
        roles[role].append(n["vel"])
        _, off_beats = nearest_grid(b, 0.25)
        offsets_ms[band(n["note"])].append(beat_to_ms(off_beats))
        durs_beats[band(n["note"])].append(tick_to_beat(n["dur"]))

    print("\n=== Velocity by role ===")
    for role in ["downbeat", "upbeat", "sixteenth_off"]:
        print(role, summarize(roles[role]))
    print("\n=== Velocity overall ===")
    print(summarize(vel_all))

    print("\n=== Timing offset ms from 16th grid by band ===")
    for bname in ["bass", "mid_low", "mid", "high"]:
        print(bname, summarize(offsets_ms[bname]))

    print("\n=== Duration beats by band ===")
    for bname in ["bass", "mid_low", "mid", "high"]:
        print(bname, summarize(durs_beats[bname]))

    win_beats = 0.040 * bpm / 60.0
    win_ticks = win_beats * tpb
    clusters: list[list[dict]] = []
    i = 0
    while i < len(notes_sorted):
        cluster = [notes_sorted[i]]
        j = i + 1
        while j < len(notes_sorted) and notes_sorted[j]["start"] - cluster[0]["start"] <= win_ticks:
            cluster.append(notes_sorted[j])
            j += 1
        if len(cluster) >= 2:
            clusters.append(cluster)
            i = j
        else:
            i += 1

    spreads_ms: list[float] = []
    bass_first = 0
    for c in clusters:
        c_sorted = sorted(c, key=lambda n: n["start"])
        span_beats = tick_to_beat(c_sorted[-1]["start"] - c_sorted[0]["start"])
        spreads_ms.append(beat_to_ms(span_beats))
        by_pitch = sorted(c, key=lambda n: n["note"])
        if c_sorted[0]["note"] == by_pitch[0]["note"]:
            bass_first += 1

    print("\n=== Chord clusters (>=2 notes within 40ms) ===")
    print("count", len(clusters))
    print("spread_ms", summarize(spreads_ms))
    print("low_note_first_ratio", round(bass_first / len(clusters), 3) if clusters else None)

    strum_delays: dict[str, list[float]] = {
        "bass_to_mid": [],
        "mid_to_high": [],
        "low_to_high": [],
    }
    for c in clusters:
        by_pitch = sorted(c, key=lambda n: n["note"])
        low, high = by_pitch[0], by_pitch[-1]
        low_t = min(n["start"] for n in c if n["note"] == low["note"])
        high_t = min(n["start"] for n in c if n["note"] == high["note"])
        strum_delays["low_to_high"].append(beat_to_ms(tick_to_beat(high_t - low_t)))
        mids = [n for n in c if 48 <= n["note"] < 72]
        if mids:
            mid_t = statistics.mean(n["start"] for n in mids)
            strum_delays["bass_to_mid"].append(beat_to_ms(tick_to_beat(mid_t - low_t)))
            strum_delays["mid_to_high"].append(beat_to_ms(tick_to_beat(high_t - mid_t)))

    print("\n=== Strum delays ms ===")
    for k, v in strum_delays.items():
        print(k, summarize(v))

    sync_slots: dict[int, int] = defaultdict(int)
    for b in onset_beats:
        slot = int(round((b % 4) * 4)) % 16
        sync_slots[slot] += 1
    total_on = sum(sync_slots.values())
    on_beat = sum(sync_slots[s] for s in range(0, 16, 4))
    and_beat = sum(sync_slots[s] for s in range(2, 16, 4))
    ea = total_on - on_beat - and_beat
    print("\n=== Onset distribution ===")
    print("slots", dict(sorted(sync_slots.items())))
    print("pct_on_beat", round(100 * on_beat / total_on, 1))
    print("pct_and", round(100 * and_beat / total_on, 1))
    print("pct_e_a", round(100 * ea / total_on, 1))

    gaps: list[float] = []
    prev = None
    for b in sorted({round(x, 6) for x in onset_beats}):
        if prev is not None:
            gaps.append(b - prev)
        prev = b
    long_gaps = [g for g in gaps if g >= 0.5]
    print("\n=== Inter-onset gaps (beats) ===")
    print("gap", summarize(gaps))
    print(
        "gaps>=0.5beat",
        len(long_gaps),
        "median_long",
        statistics.median(long_gaps) if long_gaps else None,
    )

    pitches = [n["note"] for n in notes]
    print("\n=== Pitch ===")
    print("min", min(pitches), "max", max(pitches), "median", statistics.median(pitches))
    print("bass_pct", round(100 * sum(1 for p in pitches if p < 48) / len(pitches), 1))

    bass_vs_body: list[float] = []
    for c in clusters:
        bass_n = [n for n in c if n["note"] < 48]
        body_n = [n for n in c if n["note"] >= 48]
        if bass_n and body_n:
            bt = statistics.mean(n["start"] for n in bass_n)
            ot = statistics.mean(n["start"] for n in body_n)
            bass_vs_body.append(beat_to_ms(tick_to_beat(ot - bt)))
    print("\n=== Body relative to bass (ms) ===")
    print(summarize(bass_vs_body))

    out = {
        "id": "GT-001",
        "file": os.path.basename(path),
        "source_hint": "Reo - 日もすがら音楽と / 125BPM_allday_Piano.mid",
        "bpm_tempo_meta": round(bpm, 2),
        "length_sec": round(mid.length, 2),
        "note_count": len(notes),
        "velocity_by_role": {k: summarize(v) for k, v in roles.items()},
        "velocity_overall": summarize(vel_all),
        "timing_offset_ms_by_band": {k: summarize(v) for k, v in offsets_ms.items()},
        "duration_beats_by_band": {k: summarize(v) for k, v in durs_beats.items()},
        "cluster_count": len(clusters),
        "cluster_spread_ms": summarize(spreads_ms),
        "low_note_first_ratio": round(bass_first / len(clusters), 3) if clusters else None,
        "strum_ms": {k: summarize(v) for k, v in strum_delays.items()},
        "onset_pct": {
            "on_beat": round(100 * on_beat / total_on, 1),
            "and": round(100 * and_beat / total_on, 1),
            "e_a": round(100 * ea / total_on, 1),
        },
        "body_minus_bass_ms": summarize(bass_vs_body),
        "pitch": {
            "min": min(pitches),
            "max": max(pitches),
            "bass_pct": round(100 * sum(1 for p in pitches if p < 48) / len(pitches), 1),
        },
        "gaps_beats": summarize(gaps),
        "long_gap_count_ge_0_5": len(long_gaps),
    }

    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "midi-references")
    os.makedirs(out_dir, exist_ok=True)
    json_path = os.path.join(out_dir, "GT-001_125BPM_allday_Piano.features.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("\nWrote", json_path)


if __name__ == "__main__":
    main()
