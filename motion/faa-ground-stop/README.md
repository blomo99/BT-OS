# CWB / File 013 / Why the FAA grounded every U.S. flight

A 58.4 s vertical (1080×1920, 60 fps) motion graphic cut to Ben's recorded
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
- `tools/cut-voiceover.py` is the script that made the tight cut and wrote the
  scene timings (it needs the original voice memo, which is not in the repo).

## How the voiceover was cut

The original voice memo runs 83.8 s. The tight cut keeps only the 22 spoken
phrases (51.5 s of speech) and sets every pause to a fixed short length:

- about 0.2 s between sentences inside a scene, about 0.35 s between scenes;
- the hesitation inside "At 3:54 ... Eastern" is closed up;
- a slightly longer beat (about 0.4 s) is kept after "Was it a hack?";
- the first take of "Was it a hack? No evidence so far." is removed, and the
  second take is kept;
- the stray sounds in the pauses and the 9.5 s of dead air before the sign-off
  are gone.

Each cut has a short fade so it does not click. The track is then high-passed,
lightly de-noised and levelled to about -16 LUFS. No music or effects.

## Timing

Scene lengths and cue times are the `SCENES` list at the top of the script in
`index.html`, in seconds from each scene's start. `land` is when the yellow
phrase is revealed; it is set to the moment Ben says it. For a new take,
change those numbers and re-render. The file number is `FILE_NO`.

The bottom quarter of the frame (below y 1480) is left empty for captions and
the platform's own buttons.

| # | Starts | Length | On screen | Yellow phrase lands |
|---|--------|--------|-----------|---------------------|
| 1 | 0:00.0 | 5.5 s | Busy route map. EVERY U.S. TAKEOFF. Airports get hold rings and the sky starts to drain. | "stopped." at 0:02.9 |
| 2 | 0:05.5 | 6.9 s | Clock arc sweeps 3:54 PM to 8:15 PM ET while the counter runs up to 4H 21M. | "on the ground." at 0:11.4 |
| 3 | 0:12.3 | 5.3 s | Timeline: 2001 Sept 11, 2023 safety-notice outage, 2026. ONLY THE 3RD. | "ever." at 0:13.9 |
| 4 | 0:17.6 | 6.3 s | A plane climbs, cruises and lands, handed from one en route center to the next. | "between airports." at 0:19.8 |
| 5 | 0:23.9 | 7.4 s | Data piles into a router until the load bar hits 100% and turns red; the links break. | "overloaded." at 0:27.0 |
| 6 | 0:31.4 | 6.3 s | Route map again: departures held, planes in the air land. NO NEW TAKEOFFS. | "by design." at 0:33.6 |
| 7 | 0:37.7 | 5.6 s | CYBERATTACK? Four findings: cyberattack ✕, new AI traffic tool ✕, old overloaded gear ✓, exact root cause ?. | "no evidence so far." at 0:38.9 |
| 8 | 0:43.4 | 6.0 s | Counter to 15,000+ over a grid of 150 planes (1 plane = 100 flights). | "delayed or canceled." at 0:45.8 |
| 9 | 0:49.3 | 5.7 s | CIA triad draws on; AVAILABILITY lights up as it is said. ONE WEAK LINK. | "grounds a nation." at 0:50.5 |
| 10 | 0:55.0 | 3.4 s | Logo, CYBER WITH BEN, @CyberWithBen, File 013 closed. | "plain talk, open files." at 0:56.0 |

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
