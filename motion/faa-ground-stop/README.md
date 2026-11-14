# CWB / File 013 / Why the FAA grounded every U.S. flight

A 70.8 s vertical (1080×1920, 60 fps) motion graphic cut to Ben's recorded
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

## How the voiceover was cut

From the original 83.8 s voice memo:

- the first 0.55 s of room tone is trimmed;
- the first take of "Was it a hack? No evidence so far." (46.0 to 49.5 s) is
  removed and the second take, with the pause after the question, is kept;
- the 9.5 s of dead air before the sign-off is removed.

The track is then high-passed, lightly de-noised and levelled to about
-15 LUFS. No music or effects.

## Timing

Scene lengths and cue times are the `SCENES` list at the top of the script in
`index.html`, in seconds from each scene's start. `land` is when the yellow
phrase is revealed; it is set to the moment Ben says it. For a new take,
change those numbers and re-render. The file number is `FILE_NO`.

The bottom quarter of the frame (below y 1480) is left empty for captions and
the platform's own buttons.

| # | Starts | Length | On screen | Yellow phrase lands |
|---|--------|--------|-----------|---------------------|
| 1 | 0:00.0 | 5.8 s | Busy route map. EVERY U.S. TAKEOFF. Airports get hold rings and the sky starts to drain. | "stopped." at 0:03.0 |
| 2 | 0:05.8 | 8.35 s | Clock arc sweeps 3:54 PM to 8:15 PM ET while the counter runs up to 4H 21M. | "on the ground." at 0:12.8 |
| 3 | 0:14.15 | 6.7 s | Timeline: 2001 Sept 11, 2023 safety-notice outage, 2026. ONLY THE 3RD. | "ever." at 0:15.9 |
| 4 | 0:20.85 | 7.5 s | A plane climbs, cruises and lands, handed from one en route center to the next. | "between airports." at 0:23.3 |
| 5 | 0:28.35 | 8.5 s | Data piles into a router until the load bar hits 100% and turns red; the links break. | "overloaded." at 0:31.7 |
| 6 | 0:36.85 | 8.3 s | Route map again: departures held, planes in the air land. NO NEW TAKEOFFS. | "by design." at 0:39.3 |
| 7 | 0:45.15 | 7.7 s | CYBERATTACK? Four findings: cyberattack ✕, new AI traffic tool ✕, old overloaded gear ✓, exact root cause ?. | "no evidence so far." at 0:47.1 |
| 8 | 0:52.85 | 7.7 s | Counter to 15,000+ over a grid of 150 planes (1 plane = 100 flights). | "delayed or canceled." at 0:55.6 |
| 9 | 1:00.55 | 6.25 s | CIA triad draws on; AVAILABILITY lights up as it is said. ONE WEAK LINK. | "grounds a nation." at 1:02.0 |
| 10 | 1:06.8 | 4.0 s | Logo, CYBER WITH BEN, @CyberWithBen, File 013 closed. | "plain talk, open files." at 1:08.0 |

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
