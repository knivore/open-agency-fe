# Frontend App Shell

## Purpose

The protected frontend now behaves like an authenticated application shell rather than a set of disconnected pages.

## Public Routes

Routes accessible without authentication:

- `/login`

Notes:

- the root route `/` still redirects into the protected app flow

## Protected Routes

Routes behind the authenticated dev session:

- `/workflows`
- `/assistant`
- `/profile`
- existing crew detail/kickoff routes and other protected pages under `app/(protected)`

Protection mechanism:

- `proxy.ts` checks the NextAuth session via `/api/auth/session`
- unauthenticated users are redirected to `/login`

## Layout Structure

Protected pages are wrapped by:

- `app/(protected)/layout.tsx`
- `components/AppShell/AppShell.tsx`

Shell structure:

- desktop sidebar
- mobile drawer navigation
- sticky top header
- current user context in the shell
- logout entry through the user menu
- cached backend health indicator in the shell header/sidebar

## Navigation Mapping

The shell navigation uses existing frontend pages but labels them to better align with the backend's app-centric domains.

### Workspace

- `Workflows` -> `/workflows`
  - canonical workflow management landing page

- `Assistant` -> `/assistant`
  - main-agent chat, workflow proposals, approvals, and operational actions

### Account

- `Profile` -> `/profile`

## Backend Health Behavior

Backend health is surfaced through:

- `components/AppShell/BackendHealthIndicator.tsx`

Behavior:

- calls the backend health endpoint through `healthApi.getHealth()`
- shows `checking`, `online`, or `offline`
- uses React Query caching
- does not refetch aggressively
- supports manual refresh

Current query behavior:

- `staleTime`: 60 seconds
- `gcTime`: 5 minutes
- `refetchOnWindowFocus`: disabled
- `retry`: 1

## Current User And Logout

The shell displays:

- current user name
- current user email
- avatar/menu

Logout behavior:

- handled through NextAuth `signOut`
- redirects back to `/login`

## Migration Note

The shell now presents the app as an authenticated workspace aligned to backend domains. `/studio`, protected `/crew/*` product routes, and frontend-local `/api/crew/*` routes have been removed. Workflow runtime calls now use canonical backend workflow/execution routes, and frontend CRUD ownership lives under `/workflows/*`.
