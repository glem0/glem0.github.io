# GUE Course Map

The [GUE class schedule](https://www.gue.com/diver-training/gue-class-schedule) on an
interactive world map: https://glennmcgui.re/gue-course-map/

Filter by course type, instructor, date range or keyword. Markers cluster as you zoom
out; click one for class details and a link to the official listing. Dark, light and
system themes. Not affiliated with GUE.

Plain HTML/JS, no build step. To run locally, serve the folder:

    python3 -m http.server 8000

## Data

A GitHub Action fetches the GUE schedule a few times a day and publishes it as
schedule.json, which is what the site renders — the browser never scrapes gue.com.
The map shows upcoming classes only. The last good copy is kept in localStorage
so the map paints instantly on return visits.

Coordinates come from geo.js, a generated location -> [lat, lng] table maintained by
the same Action (update_geo.py): it geocodes new schedule locations, checks each hit
forward and reverse against the location's stated country, and reuses known
coordinates for obvious misspellings ("High Springd"). geocode_cache.json is
append-only, so hand fixes stick. Anything still missing from the table is geocoded
live in the browser as a stopgap until the next run. Run it manually with
`python3 update_geo.py`; `--validate` audits the whole DB.

Map data © OpenStreetMap contributors & CARTO. Course data © GUE.
