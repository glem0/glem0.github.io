# Apple CVE Search (iOS & macOS)

A fast, searchable database of Apple security CVEs for iOS/iPadOS and macOS, compiled from
[Apple's security releases](https://support.apple.com/en-us/100100).

**Live:** https://glennmcgui.re/apple-cve/

- Search by component, CVE ID, or description (e.g. `Kernel`, `WebKit`, `CVE-2026-…`).
- Filter by platform, OS version, or year; sort any column.
- The most frequent components appear as toggleable chips ("Top components"); any of the
  ~420 components can be added as a chip from the "+ Add component…" dropdown.
  Component filters are multi-select and combine freely with search; selected chips
  stay at the left of the row. A chip matches its whole family (WebKit → WebKit Canvas, …).
- Light / dark / system theme (follows the OS by default; choice saved in localStorage).
- Hovering a CVE highlights the same CVE across other releases.

A single self-contained `index.html` — the CVE data is embedded, so it works offline.

## Updating

`update.py` discovers new iOS/iPadOS/macOS releases on Apple's security releases index,
scrapes their advisories, and appends the entries to `index.html` (no-op when nothing is new):

```
python3 update.py
```

The `update-apple-cve` GitHub Action runs it daily and commits only when a new release appeared.

Data compiled from Apple security advisories. CVE identifiers © MITRE.
