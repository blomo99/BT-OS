"""Tight cut of the voiceover: keep only the spoken phrases, with short fixed pauses,
then derive scene lengths and cue times for index.html from where the words land."""
import subprocess, sys, json
SRC, OUT_AUDIO, HTML = sys.argv[1], sys.argv[2], sys.argv[3]

# (start, end, scene) of each kept phrase in the original recording, from the level trace
P = [
    (0.76, 4.29, 1), (4.53, 5.93, 1),
    (6.74, 7.40, 2), (8.27, 11.79, 2), (12.13, 14.10, 2),
    (15.06, 17.01, 3), (18.15, 20.95, 3),
    (21.81, 24.90, 4), (25.26, 27.91, 4),
    (29.30, 33.40, 5), (34.10, 35.63, 5), (36.01, 37.05, 5),
    (37.79, 40.53, 6), (42.40, 45.43, 6),
    (49.71, 50.42, 7), (51.29, 52.33, 7), (53.55, 56.51, 7),
    (57.43, 60.82, 8), (61.10, 63.11, 8),
    (65.12, 67.26, 9), (67.63, 70.62, 9),
    (80.85, 83.11, 10),
]
PRE, POST = 0.05, 0.10          # breathing room kept around each phrase
GAP_IN, GAP_SCENE = 0.06, 0.20  # silence added between phrases / between scenes
GAP = {(6.74, 7.40): 0.0, (49.71, 50.42): 0.22}   # mid-sentence hesitation closed; a beat after the question

segs, t, first = [], 0.08, {}
for i, (a, b, sc) in enumerate(P):
    a2, b2 = a - PRE, b + POST
    segs.append((a2, b2, t))
    first.setdefault(sc, t + PRE)
    t += b2 - a2
    if i + 1 < len(P):
        t += GAP.get((a, b), GAP_SCENE if P[i + 1][2] != sc else GAP_IN)
speech_end = t

def out(orig):                   # original-recording time -> time in the tight cut
    for a2, b2, o in segs:
        if a2 <= orig <= b2: return o + orig - a2
    raise ValueError(orig)

LEAD = 0.15                      # a scene opens this long before its first word
starts = {sc: max(0, first[sc] - LEAD) for sc in first}
total = round(speech_end + 0.9, 2)
ends = {sc: (starts[sc + 1] if sc < 10 else total) for sc in starts}
loc = lambda sc, orig, shift=0.0: round(out(orig) - starts[sc] + shift, 2)
dur = {sc: round(ends[sc] - starts[sc], 2) for sc in starts}
R = -0.3                         # the bar starts 0.3 s before the word shows

s2land = loc(2, 13.33, R)
s7land = loc(7, 51.29, R)
scenes = [
    f"  {{ id: 's1',  dur: {dur[1]}, land: {loc(1, 3.55, R)} }},",
    f"  {{ id: 's2',  dur: {dur[2]}, land: {s2land}, sweep: {round(s2land - 2.2, 2)} }},",
    f"  {{ id: 's3',  dur: {dur[3]}, land: {loc(3, 16.47, R)}, rows: [{loc(3, 18.15)}, {loc(3, 19.55)}, {round(loc(3, 19.55) + 0.8, 2)}] }},",
    f"  {{ id: 's4',  dur: {dur[4]}, land: {loc(4, 23.82, R)} }},",
    f"  {{ id: 's5',  dur: {dur[5]}, land: {loc(5, 32.21, R)}, static: {loc(5, 34.10)}, screens: {loc(5, 36.01)} }},",
    f"  {{ id: 's6',  dur: {dur[6]}, land: {loc(6, 39.85, R)}, held: {loc(6, 39.85, 0.6)}, air: {loc(6, 42.40)} }},",
    f"  {{ id: 's7',  dur: {dur[7]}, land: {s7land}, rows: [{round(s7land + 0.75, 2)}, {round(s7land + 1.15, 2)}, {loc(7, 53.55, 0.1)}, {loc(7, 55.18)}] }},",
    f"  {{ id: 's8',  dur: {dur[8]}, land: {loc(8, 59.72, R)} }},",
    f"  {{ id: 's9',  dur: {dur[9]}, land: {loc(9, 66.14, R)}, avail: {loc(9, 67.85, -0.1)} }},",
    f"  {{ id: 's10', dur: {dur[10]}, land: 0.7 }},",
]
block = ("const SCENES = [\n"
         "  // dur: scene length. land: when the yellow phrase is revealed. Other keys are cues inside that scene.\n"
         "  // These values are cut to assets/voiceover.m4a (the tight cut).\n" + "\n".join(scenes) + "\n];")
print(block); print("total", total)

h = open(HTML).read()
a = h.index("const SCENES = ["); b = h.index("];", a) + 2
open(HTML, "w").write(h[:a] + block + h[b:])

parts, labels = [], []
for i, (a2, b2, o) in enumerate(segs):
    d = b2 - a2
    parts.append(f"[0:a]atrim={a2:.3f}:{b2:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={d - 0.06:.3f}:d=0.06,adelay={int(round(o * 1000))}:all=1[s{i}]")
    labels.append(f"[s{i}]")
fc = ";".join(parts) + ";" + "".join(labels) + f"amix=inputs={len(segs)}:normalize=0,highpass=f=70,afftdn=nr=8:nf=-45,loudnorm=I=-15:TP=-1.5:LRA=9,apad=whole_dur={total}[o]"
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", SRC, "-filter_complex", fc, "-map", "[o]", "-t", str(total), "-ar", "48000", "-c:a", "aac", "-b:a", "192k", OUT_AUDIO], check=True)
print("audio written")
