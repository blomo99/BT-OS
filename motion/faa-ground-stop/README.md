# CWB / File 013 / Why the FAA grounded every U.S. flight

A 52.7 s vertical (1080×1920, 60 fps) motion graphic cut to Ben's recorded
voiceover, in the Cyber with Ben "Declassified" identity: wide caps for the
fact, one yellow serif phrase for what it means, mono labels and sources, and
the 36° yellow slash for every reveal and scene change.

- `out/faa-ground-stop.mp4` is the render, voiceover included.
- `assets/voiceover.m4a` is the edited voiceover (see below).
- `voiceover.md` is the script.
- `index.html` is the film. Open it in a browser to preview the picture: click
  or space pauses, arrow keys step a second, the bar at the bottom scrubs.
- `node render.mjs` re-renders with the voiceover (`--audio none` for a silent
  picture, `--fps 30` for a faster pass). Needs Playwright's Chromium and
  ffmpeg.
- `tools/cut-voiceover.py` is the script that makes the tight cut and writes
  the scene timings into `index.html` (it needs the original voice memo, which
  is not in the repo). The gap lengths are the constants at its top.

## How the voiceover was cut

The original voice memo runs 83.8 s. The cut keeps only the 21 good spoken
phrases (about 50 s of speech) and butts them together:

- each phrase keeps 0.03 s before and 0.04 s after it, so the pause between
  two lines is under a tenth of a second, plus 0.02 s more at a scene change;
- the quiet tail after "stopped." is trimmed;
- the false start "At three fif..." before "At 3:54 Eastern" is removed;
- the first take of "Was it a hack? No evidence so far." is removed and the
  second take kept, with a short beat (about 0.15 s) after the question;
- stray sounds in the pauses and the 9.5 s of dead air before the sign-off
  are gone.

Each cut has a short fade so it does not click. The track is then high-passed,
lightly de-noised and levelled to about -16 LUFS. No music or effects.

## Timing

Scene lengths and cue times are the `SCENES` list at the top of the script in
`index.html`, in seconds from each scene's start. `land` is when the yellow
phrase is revealed; it is set to the moment Ben says it. Scene changes are a
0.4 s wipe and each heading comes in with the wipe. The file number is
`FILE_NO`.

The bottom quarter of the frame (below y 1480) is left empty for captions and
the platform's own buttons.

| # | Starts | Length | On screen | Yellow phrase lands |
|---|--------|--------|-----------|---------------------|
| 1 | 0:00.0 | 4.8 s | Busy route map. EVERY U.S. TAKEOFF. Airports get hold rings and the sky starts to drain. | "stopped." at 0:02.9 |
| 2 | 0:04.8 | 5.65 s | Clock arc sweeps 3:54 PM to 8:15 PM ET while the counter runs up to 4H 21M. | "on the ground." at 0:09.7 |
| 3 | 0:10.45 | 4.85 s | Timeline: 2001 Sept 11, 2023 safety-notice outage, 2026. ONLY THE 3RD. | "ever." at 0:12.0 |
| 4 | 0:15.3 | 5.8 s | A plane climbs, cruises and lands, handed from one en route center to the next. | "between airports." at 0:17.4 |
| 5 | 0:21.1 | 6.9 s | Data piles into a router until the load bar hits 100% and turns red; the links break. | "overloaded." at 0:24.1 |
| 6 | 0:28.0 | 5.9 s | Route map again: departures held, planes in the air land. NO NEW TAKEOFFS. | "by design." at 0:30.2 |
| 7 | 0:33.9 | 4.9 s | CYBERATTACK? Four findings: cyberattack ✕, new AI traffic tool ✕, old overloaded gear ✓, exact root cause ?. | "no evidence so far." at 0:34.9 |
| 8 | 0:38.8 | 5.5 s | Counter to 15,000+ over a grid of 150 planes (1 plane = 100 flights). | "delayed or canceled." at 0:41.2 |
| 9 | 0:44.35 | 5.25 s | CIA triad draws on; AVAILABILITY lights up as it is said. ONE WEAK LINK. | "grounds a nation." at 0:45.5 |
| 10 | 0:49.6 | 3.1 s | Logo, CYBER WITH BEN, @CyberWithBen, File 013 closed. | "plain talk, open files." at 0:50.6 |

## What each claim rests on (as of Nov 14, 2026)

- **3:54 PM to 8:15 PM ET, Fri Nov 13, all U.S. airports; "communication
  issues impacting multiple Air Route Traffic Control Centers."** FAA statement.
- **Third nationwide ground stop** after Sept 11, 2001 and the January 2023
  NOTAM outage. Al Jazeera.
- **Old equipment, routers overloaded with data; static on voice lines,
  screens flashing.** Transportation Secretary Duffy, reported by CNN, CBS and
  ABC. This is the official explanation, not a finished investigation, and the
  scene is labelled that way.
- **3,500+ planes in the air, allowed to land.** FAA and news reports.
- **No evidence of a cyberattack.** DHS Secretary Mullin via Axios; the White
  House said no sign of a "nefarious act" (CBS). One outlet (Deadline) reported
  he would not rule it out, which is why the frame says "so far".
- **Not linked to the FAA's new AI airspace tool (SMART).** Duffy, via ABC.
- **15,000+ U.S. flights delayed or canceled on Friday.** FlightAware via CNN.
- The route map and the router diagram are simplified illustrations, not the
  real network topology.

Reports were still moving when this was made. Re-check the cause and the
flight totals before publishing.
