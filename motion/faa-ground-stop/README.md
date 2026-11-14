# CWB / File 013 / Why the FAA grounded every U.S. flight

A 59.5 s vertical (1080×1920, 60 fps, silent) motion graphic for a voiceover,
in the Cyber with Ben "Declassified" identity: wide caps for the fact, one
yellow serif phrase for what it means, mono labels and sources, and the 36°
yellow slash for every reveal and scene change.

- `out/faa-ground-stop.mp4` is the render.
- `index.html` is the film. Open it in a browser to preview: click or space
  pauses, arrow keys step a second, the bar at the bottom scrubs.
- `node render.mjs` re-renders (`--fps 30` for a faster pass). Needs
  Playwright's Chromium and ffmpeg.

## Fitting it to the voiceover

Scene lengths are the `SCENES` list at the top of the script in `index.html`.
Change a `dur`, re-render, and everything inside that scene keeps its timing
from the scene's start and holds longer. The file number is `FILE_NO`.

The bottom quarter of the frame (below y 1480) is left empty for captions and
the platform's own buttons.

## Beat sheet

Word budgets assume about 2.6 spoken words per second. "Lands" is when the
yellow phrase is revealed, the moment to hit with the matching word.

| # | Time | Length | On screen | Yellow phrase lands | Words |
|---|------|--------|-----------|---------------------|-------|
| 1 | 0:00 | 5.5 s | Busy route map. EVERY U.S. TAKEOFF. Airports get hold rings and the sky starts to drain. | "stopped." at 0:02.3 | ~14 |
| 2 | 0:05.5 | 6.0 s | Clock arc sweeps 3:54 PM to 8:15 PM ET while the counter runs up to 4H 21M. | "on the ground." at 0:09.0 | ~15 |
| 3 | 0:11.5 | 5.0 s | Timeline: 2001 Sept 11, 2023 safety-notice outage, 2026. ONLY THE 3RD. | "ever." at 0:14.0 | ~13 |
| 4 | 0:16.5 | 7.5 s | Flight profile: a plane climbs, cruises and lands, handed from one en route center to the next over a voice + data link. | "between airports." at 0:19.1 | ~19 |
| 5 | 0:24.0 | 8.0 s | Data piles into a router until the load bar hits 100% and turns red; the links to planes and centers break. | "overloaded." at 0:27.9 | ~21 |
| 6 | 0:32.0 | 6.5 s | Route map again: planes in the air land, departures are held. NO NEW TAKEOFFS. | "by design." at 0:34.4 | ~17 |
| 7 | 0:38.5 | 7.0 s | CYBERATTACK? Four findings: cyberattack ✕, new AI traffic tool ✕, old overloaded gear ✓, exact root cause ?. | "no evidence so far." at 0:40.0 | ~18 |
| 8 | 0:45.5 | 5.5 s | Counter to 15,000+ over a grid of 150 planes (1 plane = 100 flights). | "delayed or canceled." at 0:48.0 | ~14 |
| 9 | 0:51.0 | 5.0 s | CIA triad draws on; AVAILABILITY lights up. ONE WEAK LINK. | "grounds a nation." at 0:52.5 | ~13 |
| 10 | 0:56.0 | 3.5 s | Logo, CYBER WITH BEN, @CyberWithBen, File 013 closed. | "plain talk, open files." at 0:56.9 | ~8 |

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
