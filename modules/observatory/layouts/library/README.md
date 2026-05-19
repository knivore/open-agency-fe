# Observatory Layout Library

This directory stores named repo-backed layout snapshots created from the builder's
`Layout management` section.

Each JSON file is a valid `ObservatoryLayoutDocument` draft snapshot. The active runtime
deployment target remains [publishedLayout.json](/Users/kehchinleong/Documents/Personal/Agency/agency-fe/modules/observatory/layouts/publishedLayout.json).

Recommended flow:

1. Save or update named snapshots here while iterating.
2. Load the snapshot you want to ship in `/observatory/builder`.
3. Use `Deploy current layout` to overwrite `publishedLayout.json`.
