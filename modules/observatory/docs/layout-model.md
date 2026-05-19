# Layout Model

Phase A4 defines deterministic, serializable world and layout models.

## Coordinate System

- Coordinates are grid-first.
- `tileSize` converts grid coordinates to world pixels.
- `gridToWorld` returns a tile origin.
- `gridToWorldCenter` returns a tile center.
- `worldToGrid` floors world coordinates into a grid cell.

## Schema

The layout document contains:

- `schemaVersion`
- `world`
- `world.grid`
- `world.maps`
- map `rooms`
- map `objects`
- map `agents`

The MVP sample layout has one map, three rooms, three objects, and three agents. Multi-map
support is represented in the schema now, but rendering remains a later phase.

## Validation

Validation checks:

- Supported schema version.
- Lowercase IDs.
- Positive map, grid, room, and object sizes.
- Non-negative grid positions.
- Unique IDs within each collection.
- Supported room kinds and agent statuses.
- Room references from objects and agents.

Invalid layouts return issues instead of throwing.
