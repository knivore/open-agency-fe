# Open Agency

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Open Agency serves a mix of experienced builders and operators, teams coordinating
agents and operational reviews, and first-time users who need guided setup. The
user confirmed that all three audiences matter to this redesign.

## Product Purpose

Configure and supervise an agency of AI agents, workflows, operators, and durable
goals. Help users discover a growing capability catalog, assign suitable capabilities
to focused agents, inspect execution evidence, and make explicit approval decisions.

## Operating Context

The existing Next.js frontend accompanies the Open Agency backend. Core surfaces
include Integrations, Agents, Workflows, Operators, Goals, Persona, Runs, Models,
Assistant, Profile, FAQ, Memory Ops, Monitor, and Agency Graph.

## Capabilities and Constraints

- The main harness agent continues to own all available capabilities.
- Focused agents receive configurable capability assignments; presentation must not
  create authority or bypass feature-owned permission checks.
- Preserve existing workflows, approval boundaries, confirmations, and execution evidence.
- Agent editing remains inline where the current page already contains the fields.
- Compose pages and forms from reusable, configurable components.
- Support a capability catalog with hundreds of operations and continued growth.
- Preserve Open Agency branding and stable backend protocol identifiers.
- The user selected Wayfinder and authorized implementation across the frontend.

## Evidence on Hand

The existing application at http://localhost:3000 and its frontend source provide
the current content, terminology, workflows, and interaction constraints. Concept
screens may use explicitly labeled illustrative records; they must not imply live
configuration changes, real results, or new capabilities.

## Product Principles

- Make powerful capabilities discoverable without presenting every operation at once.
- Provide guidance progressively while keeping frequent tasks efficient.
- Make ownership, saved state, approval requirements, and execution state legible.
- Preserve original evidence while leading with readable summaries.
- Keep shared interface patterns consistent across configuration and operations.

## Open Decisions

Wayfinder is the selected visual direction: grouped top navigation, Public Sans,
blue wayfinding, white working surfaces, and contextual discovery. Existing theme
preferences remain available. Team collaboration roles or new permission models
are outside this visual redesign unless separately requested.
