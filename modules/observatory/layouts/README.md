# Observatory Layouts

`publishedLayout.json` is the portable bundled office. `/runs` and `/observatory/embed` load the server's
deployment and use this layout when no deployment exists.

Workflow:

1. Edit visually in `/observatory/builder`.
2. Use `Export JSON`.
3. Run `node modules/observatory/scripts/save-layout-to-repo.mjs <exported-layout.json>`.
4. Commit the updated JSON with the module for lift-and-shift deployments.

Builder drafts autosave in the browser; saved layouts and deployments live in writable server storage.

## Furnished office

The default library entry and published layout contain the same two-floor office. Room names and bounds are retained.
Furniture choices and pairings are checked from the visible artwork. Legacy filenames do not reliably describe
complete objects or their orientation, and a collision check alone does not establish visual correctness.

| Room                    | Furniture grouping                                                                                            | Work points / seats           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Reception               | Warm floor and brick; intake counter, visitor chair, complete side table, tall plant and notices              | 1 work point + 1 visitor seat |
| Common Work Area        | Beige and white rows of three desks, with matched chairs, varied computers, lamps, papers and drinks          | 6 work points                 |
| Executive Work Room     | White corner desk with angled monitor and task lamp; companion laptop desk and white storage                  | 2 work points                 |
| Runtime Lab             | Blue finish, dual-monitor engineering desk, gray console, dark server racks and runtime displays              | 2 work points                 |
| Pantry / Level 2 Pantry | Coffee machine, microwave and sink on one kitchenette; two-door fridge, water dispenser and dining set         | 2 dining seats each           |
| Planning Lounge         | Warm tan floor, orange chairs, long wood table, wood sideboard, review papers and planning board              | 4 planning seats              |
| Medium Meeting          | One complete conference table with three inward-facing chairs on each side, papers and wood storage          | 6 meeting seats               |
| Small Meeting A / B     | Green/tan planning room and gray/white review room; paired computer desks, differentiated storage and notices | 2 work points each            |
| Runtime War Room        | Gray execution consoles and white incident-review desks, runtime wall, phone and control-server rack          | 5 work points                 |
| Corridors               | Consistent neutral floor and clear circulation; second-floor rooms have openings onto the corridor            | No floor furniture            |

Variety follows room purpose and desk groups. All 20 work points remain available. Small surface details reference
their parent through `runtime.targetObjectId`, so they are associated with the furniture they belong to. The executive
corner desk puts its monitor and keyboard on the lower horizontal surface, with its chair one row farther south.
Floor choices were checked on the rendered canvas: some legacy palette labels do not accurately describe the tile color.

### Sprite pairing and placement

- Furniture PNGs have a padded 96×144 source canvas. `render.sourceCrop` uses the manifest's alpha bounds;
  `render.sizePx` preserves the source aspect ratio, and `render.offsetPx` cancels the crop origin. The visible
  sprite therefore aligns to `position`, while `size` reserves its usable grid footprint. Linked `surface-trim`
  parts may crop a smaller region within those alpha bounds to complete a matching desktop apron. Agent collision handling
  uses that explicit footprint for cropped objects and retains source-canvas collision offsets for older objects.
- A wide desk front pairs with `blue-screen-monitor-front` and `low-keyboard-dark`, or with `compact-gray-laptop`.
  `dual-monitor-workstation-wide` already contains a keyboard and peripherals; adding another keyboard duplicates them.
  Equipment and chairs reference their surface through `runtime.targetObjectId`; work points use `runtime.role: workstation`.
- North-facing chairs use the `office-chair-front` export below the desk; its artwork shows the outside of the
  backrest. The legacy `back` export faces away from a desk placed above it. Planning seats use `chair-side-right`
  on the left and `chair-side-left` on the right, with their seat cushions aligned to the tabletop.
- Wide desk fronts are complementary pieces, rather than finished desktops. `completeOfficeDeskFront` attaches
  the matching right apron and leg. Presets and the bundled layout use the same pairing and keep it in the editable setup.
- `wide-beige-platform-with-drawer` is a table surface, not a sofa. Several `runtime-server-tower` variants look like
  overhead seating; the default office uses the visibly identifiable network rack and Open Runtime Server instead.
  `computer-mouse-*` artwork resembles angled desk lamps. Modular surface panels require matching edges and are not
  standalone desks. Do not scatter these fragments as complete room props.
- The kitchenette and refrigerator are original Open Agency pixel SVGs in `public/observatory-assets`, registered
  with the office pack v2. The kitchenette includes its appliances and cupboards as a coherent unit. Their one-row
  floor footprint is separate from the vertical cabinet artwork, keeping the pantry entrance and serving aisle open.
- Runtime screens, coffee, kitchen and server SVGs use Phaser's SVG loader with explicit dimensions before WebGL upload.
  Keep scaled display sizes proportional to avoid distorted fixtures.

The published-layout checks cover both floors: blocking overlaps, visible room containment, paired work points,
valid target IDs, portable library parity, and an actual walkable path from the corridor to every work point.


## Builder workflow and saved layouts

The builder places cropped sprites at native proportions. Office presets include a desktop, laptop,
dual-monitor desk, four-seat meeting table, and engineering workbench, with beige or white desk finishes.
Use **Place setup on canvas** or **Place on canvas** to preview a setup on the grid: green permits placement,
red explains why it cannot fit. Escape cancels. Existing `runtime.targetObjectId` links form editable setups;
the inspector can move, duplicate, or remove the complete setup or just the selected part.

Undo/redo retains up to 50 edits, including room changes and placements. A drag commits once on release.
Ctrl/Cmd Z undoes; Ctrl/Cmd Shift Z or Ctrl Y redoes. Text fields keep their normal text undo behavior.
Choosing **Add to** changes the target room without adding anything. Use **Place on canvas** for visual placement,
or explicitly choose **Auto-place in room**. Both methods include the matching desktop apron when needed.
The floor selector works with no runtime demo. Canvas selection, tools, counters, blank-floor reset,
and prompt generation target that floor without reordering or clearing the other maps.

Browser drafts autosave after editing. **Save as new**, **Save changes**, and **Deploy** use server storage;
**Export JSON** creates a portable copy. Save state compares content rather than timestamps. The Runs viewer
loads the server's deployment through `/api/observatory/published-layout` and falls back to the bundled office
if no deployment exists. Saves use atomic replacement, and removed library entries retain recoverable snapshots.

Set `AGENCY_OBSERVATORY_DATA_DIR` to a writable persistent volume in a deployment. The default is
`.next/observatory-data`, which works with the local Docker setup's writable `.next` volume and read-only source.
This directory must be backed up; cleaning `.next` removes saves when the default path is used. Bundled layouts
remain versioned seed documents: builder saves do not rewrite repository files. Export and intentionally update
those seeds when distributing a new office pack.

**Layout checks** reports blocking overlaps, missing asset/interaction targets, blocked room entrances,
visible sprites crossing room bounds, and workstations disconnected from the largest walkable aisle network.
Click an issue to inspect its object; **Show walkable tiles** overlays navigation cells. Errors prevent deployment;
warnings remain reviewable, and draft saving remains available. Checks use the same collision geometry as agent navigation.


## Movement verification (v4)

The Runtime Lab console and its attached equipment move one tile east, leaving a continuous aisle down
column 3. Its storage/circuit display moves to the north-west wall so the area behind the server rack
stays connected. The workbench and executive chairs move forward by half a tile visually; their
interaction points now fit inside the room's walkable interior. All 20 workstations remain available.

In the builder, **Run office walkthrough** animates the chosen agent through every room and workstation
on the selected floor. Progress and visited coordinates come from actual tween completion, rather than
an elapsed-time estimate. Stop cancels the preview. The walkthrough does not change the saved layout or
execute agency tools. JSON exports can be loaded through **Import JSON**, then saved/deployed normally.

Idle agents roam automatically in the builder. **Pause roaming** lets their current walks finish and
pauses new background activity while arranging furniture; **Resume roaming** restarts it. Sample
runtime events run only when requested, so demo room assignments cannot claim idle office agents on load.

Workstation interactions resolve small props back to their parent surface, prefer a reachable linked
chair, avoid occupied destination tiles and overlapping visible foot positions, and face the desk.
Fallback approaches share an edge with the surface so agents do not interact from a diagonal corner.
The tracked character sheet has no north/south
sitting poses, so north-facing workstations use the supported idle pose instead of a sideways sit.
Character feet are anchored to their navigation tile; resting offsets align the sprite to its chair.
Unreachable interaction points return no target. Room changes cannot retain a target from another room.

Regression checks cover every room pair on both floors, all 142 room-to-workstation routes, chair
alignment, disconnected-room rejection, occupied interaction points, and both walkthrough sequences.
The live inspector additionally flags isolated walkable pockets and chairs outside usable interaction areas.

## Furnishing correction (v6)

Wide desktop aprons are complete, workstation chairs face their screens, and the six-seat meeting room uses one
table instead of three disconnected fragments. Pantry fixtures are recognizable kitchen equipment rather than
storage cabinets used as fridge stand-ins. Misidentified devices, unfinished floor panels and the refreshment-like
lab bench were removed. Juno starts in front of the pantry worktop, on a walkable tile. The lab chair was pulled
closer to its replacement engineering desk. Regression checks cover inward-facing seating, desktop completion,
kitchen fixtures on both floors, safe agent starts, and the existing routes to all twenty workstations.
