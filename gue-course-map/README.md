# GUE Course Map

The [GUE class schedule](https://www.gue.com/diver-training/gue-class-schedule) on an
interactive world map: https://glennmcgui.re/gue-course-map/

Filter by course type, instructor, date range or keyword. Markers cluster as you zoom
out; click one for class details and a link to the official listing. Dark, light and
system themes. Not affiliated with GUE.

Plain HTML/JS, no build step. Open index.html, or if your browser blocks the
cross-origin fetch, serve the folder:

    python3 -m http.server 8000

## Data

The schedule is fetched and parsed in the browser on load, then cached in localStorage
for 24 hours; the header button forces a refresh. Coordinates come from geo.js, a
generated location -> [lat, lng] table. Locations missing from the table are geocoded
live via Nominatim (1 req/s) and remembered per browser.

geo.js is rebuilt by update_geo.py, which runs daily via GitHub Actions: it geocodes
new schedule locations, checks each hit forward and reverse against the location's
stated country, reuses known coordinates for obvious misspellings ("High Springd"),
and commits whatever changed. geocode_cache.json is append-only, so hand fixes stick.
Run it manually with `python3 update_geo.py`; `--validate` audits the whole DB.

Map data © OpenStreetMap contributors & CARTO. Course data © GUE.
