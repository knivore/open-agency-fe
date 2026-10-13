# Open Agency website refinement QA

Source visual truth: the user-approved Capability Studio implementation,
`C:/Users/chink/.codex/visualizations/2026/10/13/01a1331a-6d84-7f10-8fef-cdb0335fb5b1/integrations-refinement-audit/11-capability-studio-desktop-final.png`.
Supporting concept: selected option 2,
`C:/Users/chink/.codex/generated_images/01a1331a-6d84-7f10-8fef-cdb0335fb5b1/exec-0945b0aa-1533-4814-a9eb-1cf32ac65a90.png`.

Evidence directory:
`C:/Users/chink/.codex/visualizations/2026/10/13/01a1331a-6d84-7f10-8fef-cdb0335fb5b1/website-refinement`. All filenames
below are relative to this directory. The previous Integrations report is preserved as `integrations-design-qa.md`.

Scope: extend the approved design through the existing site, preserving each feature's content and workflow. Shared
headers, spacing, navigation selection, tabs, checkbox and button geometry, and loading states apply across the
protected workspaces. Agents gains a searchable directory and focused inspector; Models gains search; Goals and
Operators use consistent list/inspector surfaces; chat uses calmer message surfaces; Memory and graph chrome use the
same layout rules. Monitor requests retain their full evidence behind an explicit review disclosure.

## State and normalization

Desktop: 1488 × 1056 CSS px, density 1. Approved implementation and new desktop captures use the same dimensions. Phone:
390 × 844. Tablet: 1024 × 900. Light theme. Authenticated local workspace, real existing records. Comparisons evaluate
shared typography, chrome, surfaces, spacing and interaction hierarchy; operations and content retain their
domain-specific meaning.

No live grants, workflows, model presets, persona publications, Operator authority, messages or approvals were changed.
Browser checks used navigation, temporary drafts canceled without saving, filters, selections, review disclosures and
temporary viewport overrides. Canonical tool identifiers, capability ownership, mutation payloads and approval callbacks
are unchanged. The main agent remains harness-managed with all enabled capabilities.

## Iteration findings and fixes

| Finding                                                                              | Resolution and evidence                                                                                                                                                                                                                                                                                                   |
|--------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| P2: Phone agent directory pushed the focused agent below the fold.                   | Retain search and use a compact labelled phone selector; retain the desktop rail. Before: `agents-mobile-pass1.png`. After: `after-agents-mobile.png`; main-agent capability explanation appears in the first viewport, document width 390px.                                                                             |
| P1: Tablet model rows clipped editing controls.                                      | Row/header grids, labels, alignment and spanning fields now switch together at 87.5rem. Narrow views stack into one or two columns. Before: `models-tablet-pass1.png`, Edit preset x=1165–1259 in a 1024px viewport. After: `after-models-tablet.png`, x=349–443. Phone: `after-models-mobile.png`, document width 390px. |
| P2: Selected sidebar destinations reverted to a neutral hover surface.               | Explicit active hover colors retain the violet selection indicator. Final desktop captures show matching destination and directory selection states.                                                                                                                                                                      |
| P2: Long Monitor request summaries dominated the review queue.                       | Clamp the request title and put full summary, distinct diff and existing decisions in a native Review request disclosure. `after-monitor-desktop.png`. Closed requests expose no visible decision controls; opening one exposes its Approve and Reject controls. Neither was clicked in the browser.                      |
| P2: Mobile chat submit button lacked a name because its text is hidden at that size. | Add the same dynamic accessible label as the desktop text. `after-assistant-mobile.png`; Send right=348px, bottom=798px inside 390 × 844. Chat suite: 40 tests passed.                                                                                                                                                    |
| P2: Profile and Diagnostics duplicated the shell's page inset.                       | Remove redundant outer padding. Profile post-fix evidence: `after-profile-desktop.png`; Diagnostics affected suite passed.                                                                                                                                                                                                |

No actionable P0, P1 or P2 visual findings remain in the inspected states.

## Required fidelity surfaces

- Fonts/typography: retain Inter, 40px desktop titles and approximately 30px phone titles, 14px controls, readable 12px
  metadata and explicit line heights. Long objectives clamp in lists; full content remains available in detail views and
  title text.
- Spacing/layout: 24px desktop inset, compact contextual breadcrumb, unboxed heading and inline actions, 12px panels,
  and 16–24px section spacing. Existing tables, graphs and editors remain appropriate to their tasks.
- Colors/tokens: neutral page/card surfaces; violet identifies selection and primary action. Warning, error, approval
  and run-status colors retain their existing semantics.
- Assets/icons: reuse the Open Agency brand SVG and installed Lucide vector icons. No placeholder imagery, decorative
  raster asset or new icon system.
- Copy/content: preserve existing feature copy and controls. Intentional additions include the Workspace breadcrumb
  fallback, search/count/empty-state copy, harness-managed capability explanation, readable blocker summaries and review
  disclosures. Full structured blocker and approval evidence remains available.

## Comparison review

The approved source and final implementation were inspected individually and together in combined images:

- `comparison-agents-final.png` and `comparison-models-final.png`: approved Studio beside the new workspace. Both source
  captures are 1488 × 1056 at density 1, displayed at equal 732px widths in a 1504 × 650 comparison.
- `comparison-focused-final.png`: 1100 × 850 combined view of native-size crops from both source captures. Headers:
  x=304, y=80, width=520, height=170. Approved rail: x=304, y=277, width=256, height=390. Agent rail: x=304, y=254,
  width=256, height=450.

Typography, panel borders/radii, search geometry, violet selection and neutral surfaces align. Intentional adaptations:
Agents uses a two-pane record directory and inspector; Studio uses families, operations and agent access. The Agents
rail is wider to accommodate names and roles; its content starts earlier because it does not need integration sub-tabs.
Models retains connection and preset tables. These content-driven layouts preserve the approved hierarchy without
copying domain-specific content.

## Browser coverage

| Area              | Verified state and evidence                                                                                                                                                         |
|-------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Workflows         | List/search and existing Daily Agency Code Teacher detail, graph and governance entry points. `after-workflows-desktop.png`, `after-workflow-detail-desktop.png`. No run/edit/save. |
| Agents            | Main agent first, all enabled capabilities, specialist selection/search, editor opened and canceled. `after-agents-desktop.png`, `after-agents-mobile.png`.                         |
| Models            | Connection/preset search, clear/empty state, desktop/tablet/phone editing controls reachable. `after-models-desktop.png`, `after-models-tablet.png`, `after-models-mobile.png`.     |
| Goals             | Search, readable blockers, full detail disclosure, unchanged lifecycle entry points. `after-goals-desktop.png`.                                                                     |
| Operators         | Authority workspace gate retained; no workspace ID entered. Existing table/inspector logic covered by regression tests.                                                             |
| Personas and Runs | Existing published/draft setup and execution history/filter surfaces render through the shared system. `after-personas-desktop.png`, `runs-first-review.png`.                       |
| Assistant         | Restored history, normal/tool surfaces, desktop and phone composer. `after-assistant-desktop.png`, `after-assistant-mobile.png`.                                                    |
| Graph and Memory  | Graph toolbar/canvas/legend and Memory browse/filter/tabs. `after-graph-desktop.png`, `after-memory-desktop.png`.                                                                   |
| Profile and FAQ   | Shared heading/inset, existing account controls, expanded integration help. `after-profile-desktop.png`, `after-help-desktop.png`.                                                  |
| Monitor           | Compact pending queue, review opened then closed, no approval decision. `after-monitor-desktop.png`.                                                                                |
| Integrations      | Final compatibility check after shared changes; main retains all enabled capabilities and existing specialist review/save behavior. `after-integrations-desktop.png`.               |

Responsive coverage is targeted: Agents, Models and Assistant on phone; Models on tablet. This is not a claim that every
route was exhaustively exercised at every size. Dark theme, manual screen-reader use, login/bootstrap and consequential
live mutations were not browser-exercised; existing theme tokens and workflow tests remain in place.

## Validation

- Initial full frontend suite: 182 files and 1020 tests passed.
- Final full suite: 181 files, 1022 tests passed and one existing workflow test exceeded its 5000ms timeout. The exact
  failing test, persona-backed graph agent override preservation, passed on isolated retry in 1037ms. All 1023 tests
  therefore passed across the full run and retry; the full run itself was not entirely green. Evidence:
  `full-suite-final.log`, `workflow-retry.log`.
- Affected feature reruns passed: Agents 17, Models 17, AppShell 2, approval review 2, Diagnostics 2, and
  ConversationWorkspace 40 after the mobile label fix. Creation/import/deletion/access saves use mocked APIs.
- TypeScript and focused ESLint passed. Final ESLint recheck of the last edited button and chat files passed.
  `git diff --check` passed; Git emitted only existing LF/CRLF normalization notices.

Browser diagnostics retain one approval-refresh timeout at 2026-10-13T05:22:40.517Z during simultaneous dev
recompilation and test load. Later quiet Assistant rechecks restored the existing history and approval UI without
another error. Final diagnostics still show only that earlier timeout. No approval-refresh logic was changed.

## Acceptance checklist

- [x] Main capability ownership and mutation/approval API paths preserved.
- [x] Agent import review, persona adoption, workflow governance and unsaved-dialog safeguards retained in regression
  coverage.
- [x] Final desktop and targeted tablet/phone inspection complete.
- [x] Approved design and final captures compared together at full-view and focused scale.
- [x] Responsive fixes and console diagnostics rechecked.
- [x] No live access, workflow or approval changes made during QA.

final result: passed
