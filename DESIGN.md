---
name: Open Agency — Wayfinder
description: Clear blue wayfinding and quiet working surfaces for configuring and supervising an agency.
colors:
  primary: hsl(221.29 70.25% 47.45%)
  primary-foreground: hsl(0 0% 100%)
  agency-primary-hover: '#1b49b1'
  agency-masthead-bg: '#163d93'
  agency-masthead-text: '#ffffff'
  agency-masthead-selected: '#2b50a2'
  background: hsl(212.73 44% 95.1%)
  foreground: hsl(214.74 55.34% 20.2%)
  card: hsl(0 0% 100%)
  card-foreground: hsl(214.74 55.34% 20.2%)
  muted: hsl(217.5 57.14% 97.25%)
  muted-foreground: hsl(213.96 24.88% 41.76%)
  accent: hsl(218.57 100% 94.51%)
  accent-foreground: hsl(214.74 55.34% 20.2%)
  border: hsl(214.62 36.11% 85.88%)
  input: hsl(214.62 36.11% 85.88%)
  ring: hsl(221.29 70.25% 47.45%)
  agency-shell-bg: '#edf2f8'
  agency-shell-text: '#172f50'
  agency-shell-muted: '#506785'
  agency-shell-border: '#ced9e8'
  agency-surface-subtle: '#f4f7fc'
  agency-active-bg: '#e3edff'
  agency-success-bg: '#e2f4e9'
  agency-success-text: '#166346'
  agency-warning-bg: '#fff0ce'
  agency-warning-text: '#875000'
  agency-danger-bg: '#ffe8e6'
  agency-danger-text: '#9f3439'
  destructive: hsl(357.2 50.71% 41.37%)
  destructive-foreground: hsl(0 0% 100%)
  dark-primary: hsl(220.54 100% 85.49%)
  dark-primary-foreground: hsl(216.73 53.85% 17.84%)
  dark-agency-primary-hover: '#c9dbff'
  dark-agency-masthead-bg: '#102752'
  dark-agency-masthead-text: '#ffffff'
  dark-agency-masthead-selected: '#2b50a2'
  dark-background: hsl(217.5 47.06% 13.33%)
  dark-foreground: hsl(220 100% 96.47%)
  dark-card: hsl(216.59 44.09% 18.24%)
  dark-card-foreground: hsl(220 100% 96.47%)
  dark-muted: hsl(214.47 40.87% 22.55%)
  dark-muted-foreground: hsl(215.71 36.84% 77.65%)
  dark-accent: hsl(218 38.46% 30.59%)
  dark-accent-foreground: hsl(220 100% 96.47%)
  dark-border: hsl(213.75 27.27% 34.51%)
  dark-input: hsl(213.75 27.27% 34.51%)
  dark-ring: hsl(220.54 100% 85.49%)
  dark-agency-shell-bg: '#121e32'
  dark-agency-shell-text: '#edf3ff'
  dark-agency-shell-muted: '#b1c2db'
  dark-agency-shell-border: '#405570'
  dark-agency-surface-subtle: '#223651'
  dark-agency-active-bg: '#30466c'
  dark-agency-success-bg: '#253d34'
  dark-agency-success-text: '#a4e6bc'
  dark-agency-warning-bg: '#473b28'
  dark-agency-warning-text: '#ffd28c'
  dark-agency-danger-bg: '#492e3b'
  dark-agency-danger-text: '#ffb9bc'
  dark-destructive: hsl(357.43 100% 86.27%)
  dark-destructive-foreground: hsl(216.73 53.85% 17.84%)
typography:
  headline:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 1.85rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  headline-compact:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 1.75rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  headline-wide:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 2rem
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '-0.025em'
  title:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.5rem
    letterSpacing: '-0.02em'
  body:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.25rem
  body-reading:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5rem
  label:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.25rem
  label-small:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1rem
  caption:
    fontFamily: var(--font-agency), 'Public Sans', ui-sans-serif, system-ui, sans-serif
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.25rem
rounded:
  sm: calc(0.75rem - 4px)
  md: calc(0.75rem - 2px)
  lg: 0.75rem
  xl: 0.75rem
  2xl: 1rem
  agency-radius-control: 0.5rem
  agency-radius-panel: 0.75rem
spacing:
  '1': 0.25rem
  '2': 0.5rem
  '3': 0.75rem
  '4': 1rem
  '5': 1.25rem
  '6': 1.5rem
  '7': 1.75rem
  '8': 2rem
  '9': 2.25rem
  '12': 3rem
  '14': 3.5rem
  '28': 7rem
  '1.5': 0.375rem
  '2.5': 0.625rem
  '3.5': 0.875rem
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 1rem
    height: 2.5rem
  button-primary-hover:
    backgroundColor: '{colors.agency-primary-hover}'
  button-outline:
    backgroundColor: '{colors.card}'
    textColor: '{colors.agency-shell-text}'
    typography: '{typography.label}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 1rem
    height: 2.5rem
  button-outline-hover:
    backgroundColor: '{colors.agency-surface-subtle}'
  button-secondary:
    backgroundColor: '{colors.agency-surface-subtle}'
    textColor: '{colors.foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 1rem
    height: 2.5rem
  button-secondary-hover:
    backgroundColor: '{colors.accent}'
  button-ghost:
    typography: '{typography.label}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 1rem
    height: 2.5rem
  button-ghost-hover:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-foreground}'
  button-destructive:
    backgroundColor: '{colors.destructive}'
    textColor: '{colors.destructive-foreground}'
    typography: '{typography.label}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 1rem
    height: 2.5rem
  button-link:
    textColor: '{colors.primary}'
    typography: '{typography.label}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 1rem
    height: 2.5rem
  input:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 0.75rem
    height: 2.5rem
    width: 100%
  workspace-search:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 0.75rem 0.5rem 2.25rem
    height: 2.5rem
    width: 100%
  native-select:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.5rem 0.75rem
    height: 2.5rem
    width: 100%
  card:
    backgroundColor: '{colors.card}'
    textColor: '{colors.card-foreground}'
    rounded: '{rounded.xl}'
  card-header:
    padding: 1.25rem
  tab-trigger:
    textColor: '{colors.muted-foreground}'
    typography: '{typography.label}'
    padding: 0.625rem 0.75rem
  tab-trigger-active:
    textColor: '{colors.primary}'
  nav-group:
    textColor: '{colors.agency-masthead-text}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: 0.75rem
  nav-group-current:
    backgroundColor: '{colors.agency-masthead-selected}'
  nav-destination:
    textColor: '{colors.muted-foreground}'
    typography: '{typography.body}'
    padding: 0 0.5rem
    height: 3rem
  nav-destination-current:
    textColor: '{colors.primary}'
  directory:
    backgroundColor: '{colors.card}'
    rounded: '{rounded.xl}'
  directory-current:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.primary}'
    rounded: '{rounded.agency-radius-control}'
    padding: 0.75rem
  workspace-toolbar:
    backgroundColor: '{colors.card}'
    rounded: '{rounded.xl}'
    padding: 0.75rem
  form-section:
    backgroundColor: '{colors.card}'
    rounded: '{rounded.xl}'
  badge-default:
    backgroundColor: '{colors.agency-active-bg}'
    textColor: '{colors.primary}'
    typography: '{typography.label-small}'
    rounded: '{rounded.md}'
    padding: 0.125rem 0.625rem
  badge-secondary:
    backgroundColor: '{colors.muted}'
    textColor: '{colors.agency-shell-text}'
    typography: '{typography.label-small}'
    rounded: '{rounded.md}'
    padding: 0.125rem 0.625rem
  badge-outline:
    backgroundColor: '{colors.card}'
    textColor: '{colors.agency-shell-text}'
    typography: '{typography.label-small}'
    rounded: '{rounded.md}'
    padding: 0.125rem 0.625rem
  badge-successful:
    backgroundColor: '{colors.agency-success-bg}'
    textColor: '{colors.agency-success-text}'
    typography: '{typography.label-small}'
    rounded: '{rounded.md}'
    padding: 0.125rem 0.625rem
  badge-failed:
    backgroundColor: '{colors.agency-danger-bg}'
    textColor: '{colors.agency-danger-text}'
    typography: '{typography.label-small}'
    rounded: '{rounded.md}'
    padding: 0.125rem 0.625rem
---

# Design System: Open Agency — Wayfinder

## Overview

**Creative North Star: "Wayfinder"**

A blue masthead groups destinations above quiet working surfaces. Public Sans, compact controls, cool ground, and consistent borders keep configuration and execution evidence readable. Selection and operational state have distinct, labeled roles.

This document records the source implementation. Concept boards are design references; live browser and viewport verification remain pending because the browser URL policy blocked localhost. The retained Open Agency SVG mark is the only product artwork. CSS variables in app/globals.css are the runtime authority; frontmatter records their light/dark values, and .impeccable/design.json carries depth, motion, breakpoints, and core examples.

## Colors

Primary blue identifies navigation, selection, focus, and primary actions. The masthead retains white text in both themes. Working surfaces use card; ground, supporting ink, borders, and hover surfaces use the agency-shell and neutral semantic variables. Dark-prefixed frontmatter entries are snapshots; components consume the unprefixed runtime variables.

Success, warning, and danger pair a state background with legible text. Always include a state label, icon, or evidence. Existing graph, chat, and AppState feature colors remain specialized exceptions. Shared form feedback uses semantic danger and success text.

Theme selection follows saved agency-theme preference, then system preference. Preserve both the root dark class and data-agency-theme attribute.

## Typography

Public Sans is self-hosted with next/font/local from app/fonts/PublicSans.ttf (100–900, swap); retain its OFL license. Use the established headline, title, body, label, and caption roles. PageHeader handles responsive headline sizing, CardTitle supplies heading semantics, and evidence/code views keep their platform monospace stack. Prefer readable wrapping over truncating consequential text.

## Layout

AppShell owns Build, Operate, Knowledge, and Workspace groups, a destination rail, and global discovery. Active nested routes select their parent destination. Mobile uses the existing focus-trapped Sheet; it returns focus on dismissal and closes when the desktop navigation becomes available at 1024px.

Compose pages from PageHeader, WorkspaceDirectory, WorkspaceSearch, WorkspaceToolbar, AppState, FormSection, FormFieldGroup, and FormField. Keep feature-specific widgets data-driven through labels, options, disabled states, slots, and callbacks. Directories keep selected records available when filtering; forms wrap and collapse columns on smaller screens. Integrations places catalog and access review side by side on laptops; Agents edits inline; Monitor pairs the queue with selected evidence.

## Elevation & Depth

Working panels and controls are flat at rest. Tone and quiet borders establish hierarchy; agency-elevation-2 lifts the assistant launcher. Dialogs, Sheets, and popovers retain their library shadows and scrims. Shared primitive state transitions consume agency-motion-fast (140ms); overlays retain their existing animation durations. Reduced-motion styles shorten animations and remove moving graph packets. Details live in the sidecar.

## Shapes

Shared controls consume agency-radius-control (8px). Card, FormSection, and WorkspaceDirectory consume agency-radius-panel (12px); other library panels retain the equivalent rounded-xl shape. Library radius steps remain available for feature overrides. Destination rails and tabs have square outer edges and a current underline. Badges use the medium library radius; checkboxes keep compact corners.

## Components

Use the existing Button variants and sizes for actions, including asChild for links. Default and brand share the primary appearance. Maintain visible focus, accessible names on icon actions, disabled/busy states, and native control semantics.

PageHeader accepts title, description, breadcrumbs, metadata, actions, tone, compact, and children. Do not pass obsolete eyebrow or icon props. Card and FormSection compose surfaces; FormFieldGroup handles repeated columns. FormField associates its label with the control ID and links direct controls to description/error/success feedback. Repeated instances need unique IDs; compound controls explicitly connect their trigger and feedback. Required/optional copy does not add validation rules. Use Input, Textarea, and NativeSelect for ordinary controls, and keep canvas interactions in their feature module.

CapabilityCatalog and CapabilityStudio separate discovery, operation selection, draft specialist access, and saved access. Unavailable selected IDs remain visible. The main agent reads “All enabled capabilities / Harness managed”; ownership remains harness-managed. Switching specialists with unsaved changes uses the existing discard guard.

ApprovalCard displays selected evidence in an explicit Review request disclosure before Approve/Reject controls. Changing requests resets disclosure state. Permission checks, API calls, save handlers, execution authority, and approval decisions remain in feature workspaces/services. Shared controls report intent through callbacks.

Reuse AppDialog, AppDrawer, ConfirmActionDialog, and existing overlay primitives for modal work. Preserve title/description semantics, focus restoration, scrolling, busy state, draft guards, and confirmation. AppState/AppInlineState supply reusable loading, empty, offline, partial, error, permission, and success feedback.

## Do's and Don'ts

- Do reuse shared composition and semantic tokens before adding components or files.
- Do preserve labels, unique IDs, feedback, selected values, keyboard access, and focus visibility.
- Do keep drafts, saved state, main-agent ownership, and explicit approvals legible.
- Don't turn navigation, selection, or shared UI into a capability grant.
- Don't hide consequential evidence while exposing its decision actions elsewhere.
- Don't treat concept boards or source tests as rendered visual verification.
