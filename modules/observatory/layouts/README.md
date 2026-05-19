# Observatory Layouts

`publishedLayout.json` is the repo-backed published layout consumed by `/runs` and `/observatory/embed` when no browser-local published override exists.

Workflow:

1. Edit visually in `/observatory/builder`.
2. Use `Export JSON`.
3. Run `node modules/observatory/scripts/save-layout-to-repo.mjs <exported-layout.json>`.
4. Commit the updated JSON with the module for lift-and-shift deployments.

The browser-local draft/publish buttons remain useful for quick previews, but this JSON file is the portable source of truth.
