# Global Codex Guidelines

## Inline Comments And Developer Context

- When building or changing code, add concise inline comments, docstrings, or function-level notes where names and structure alone do not explain the purpose.
- Explain why the code exists and what constraint it protects, especially for domain rules, adapter boundaries, agent orchestration, guardrails, non-obvious async flows, caching, retries, or workarounds.
- Do not comment obvious line-by-line mechanics. Prefer comments that preserve reasoning future maintainers would otherwise have to rediscover.
- Keep comments close to the logic they clarify, and update or remove them when the behavior changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Smart Home Naming And Boundaries

- Treat `modules/smart-home` as the only canonical frontend namespace for Smart Home feature code.
- Keep Next.js route files under `app/`, but place Smart Home implementation components, capability metadata, and feature-local logic under `modules/smart-home`.
- If Smart Home files need to be renamed or moved, update callers and delete the old path. Do not preserve `home-module` compatibility files, re-export shims, or duplicate trees.

## Open Agency Identity

- Use **Open Agency** for user-facing product copy and `open-agency` / `open-agency-fe` for repository names and sibling paths.
- Keep `AGENCY_*` environment variables, `x-agency-*` headers, `agency.*` tool identifiers, and `agency.runtime-event.v1` stable unless a coordinated backend protocol migration is explicitly requested.
- Treat `modules/observatory/assets` and its generated catalog/registry files as one versioned open-source asset pack. Never copy paid/private assets from another repository, and do not commit generated registries that reference files absent from the tracked Open Agency FE inventory.
