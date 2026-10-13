# Implementation Plan: Organiza AI MVP

## Overview

Build the approved Maringá/PR pilot as a static React application on Vercel backed by Supabase Auth and PostgreSQL. Implement the approved capability sequence: identity/access, territory map, then acts and material points. Deliver usable vertical slices with database constraints, RLS policies, UI, and focused tests together; do not start implementation until this plan is approved.

## Architecture Decisions

- **Client and hosting:** React 19, TypeScript 5, Vite 6, npm, and Vercel static hosting. Pin resolved dependency versions and commit the lockfile. Do not expose Supabase service-role credentials to the browser.
- **Verified scaffold versions:** Node 24.21 LTS, npm 11.19.0, React/React DOM 19.3.0, TypeScript 5.9.3, Vite 6.4.4, Supabase JS 2.117.3, Leaflet 1.9.4, React Leaflet 5.0.0, `@geoman-io/leaflet-geoman-free` 2.20.2 (MIT), React Vite plugin 4.7.0, Vitest 4.1.11, ESLint 10.12.0, and jsdom 30.1.2. Peer ranges accept React 19 and Vite 6. Vitest 4.1.11 is the first 4.x release outside the audited vulnerable ranges. Lock exact dependency versions and review package lifecycle scripts.
- **Identity and authorization:** Supabase Auth owns credentials. Application profile data and role assignments live in protected database records. RLS is the authorization boundary; never authorize using user-editable auth metadata. Provision the initial city leader using a trusted administrative procedure, then allow that leader to assign sector-leader roles.
- **Data API privileges:** Explicitly grant only required table/function privileges in migrations, separately from RLS. Do not assume public-schema tables will be automatically exposed; Supabase's announced 2026-10-30 change disables that default.
- **Territorial model:** PostGIS stores the approved urban perimeter, color regions, numbered subdivisions, leader-to-region assignments, and participant memberships. Validate geometry in the database. Measure areas in square meters using geography or a validated local projected CRS, not raw EPSG:4326 degree units.
- **Boundary source:** Obtain Maringá's current legal urban-perimeter geometry from the Prefeitura. Validate source, license, and CRS; do not substitute the IBGE municipal boundary, which includes rural areas. If the official vector is unavailable, stop the boundary-dependent work until an official representation and conversion are validated with the Prefeitura.
- **Map generation/editing:** Use the verified, pinned Geoman Free plugin with Leaflet for polygon editing. Before UI implementation, run a feasibility spike for automatic partitions with the approved ±15% area target. If generation cannot meet the target, block publication and show the measured deviation as specified.
- **Acts:** An act has exactly one scope: the city or a numbered subdivision. Sector leaders manage acts in assigned regions; only the city leader creates city-wide acts. Any participant may register for any act. Registration lists and WhatsApp contacts are leadership-only. No capacity, recurrence, check-in, or automatic notifications in the MVP.
- **Material points:** Points are not linked to regions. Both leadership roles manage all city points. Material/topic are free-text; weekly pickup windows allow multiple intervals per weekday. Participants can view map/list/details, with no stock or reservation features.
- **Verification:** Vitest and React Testing Library cover domain/UI; Supabase local tests cover RLS and PostGIS constraints; Playwright covers core role-based journeys. Run focused tests and a build at each slice; complete a cross-module E2E/security checkpoint before a Vercel preview.
- **Dependencies:** No application manifest exists yet. Dependencies beyond the approved stack and required map tooling must be evaluated during the scaffold; do not add unrelated services. Verify current Supabase docs and CLI commands before implementing Supabase-specific behavior.

## Task List

### Phase 1: Readiness and Foundation
- [~] T01: Obtain and validate the legal urban-perimeter geometry; prove generation feasibility (official 7-polygon layer selected; publication checks pending).
- [x] T02a: Lock the React/Vite/TypeScript toolchain, select Geoman, and establish a fail-closed npm script policy.
- [x] T02b: Add ESLint configuration, a runnable React shell, and smoke tests.
- [x] T03: Create Supabase local configuration, identity schema, and database-test wrapper with RLS.
- [x] T04a: Add ignored local environment files and a lazy, tested Supabase client.
- [x] T04b: Implement and test the signup/login service contract.
- [x] T04c: Deliver accessible participant signup/login UI with component tests.
- [x] T05: Deliver required weekly availability editing.
- [x] T06: Deliver trusted city-leader bootstrap and sector-leader assignment.

### Checkpoint: Foundation
- [x] Identity flows, RLS tests, and build pass; city leader provisioning is documented.
- [ ] Official boundary file, CRS, attribution/license, and partition feasibility are reviewed.

### Phase 2: Territory Map
- [x] T07: Load the official 7-polygon urban-perimeter layer and render the read-only city map locally (public preview checks pending).
- [~] T08: Persist region drafts, generate/edit balanced subdivisions, and publish/replace maps (replacement requires every active membership to be explicitly realigned in the same transaction; participant enrollment remains in T10).
- [~] T09: Complete city-leader geometry editor and region assignment workflow (sector-leader subdivision editing is explicitly disabled by product decision).
- [~] T10: Deliver one-active-subdivision signup/switch and safe realignment (participant enrollment/switch was browser-tested locally with a disposable account; manual city-leader map replacement check remains).

### Checkpoint: Territory
- [ ] Participant selection and leader editing work against PostGIS; realignment safeguards pass.

### Phase 3: Acts and Material Points
- [ ] T11: Deliver leadership act creation/edit/cancel for city and subdivision scopes.
- [ ] T12: Deliver agenda/map discovery and participant act signup/cancellation.
- [ ] T13: Deliver private leader attendee rosters with authorized WhatsApp links.
- [ ] T14: Deliver leadership CRUD for independent material points and weekly windows.
- [ ] T15: Deliver participant material-point map/list/details.

### Checkpoint: Core MVP
- [ ] Acts and material points satisfy their RLS tests and work with the approved territory map.

### Phase 4: Integration and Preview
- [ ] T16: Complete cross-role Playwright journeys, responsive/accessibility checks, and security review.
- [ ] T17: Prepare Vercel preview configuration and verify deployed environment wiring.

### Checkpoint: Complete
- [ ] All approved spec acceptance criteria are covered by tests or documented manual checks.
- [ ] `npm run test -- --run`, `npm run build`, `npm run lint`, and `npm run test:e2e` pass.
- [ ] Preview is reviewed by the human before any production launch.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Prefeitura polygon is unavailable, outdated, or has undocumented CRS | High: blocks truthful map and partition work | Obtain source metadata and validate geometry/CRS with the Prefeitura before using it; do not use a rural-inclusive municipal boundary as a substitute. |
| Equal-area generation cannot meet ±15% for all requested partition counts | High: blocks region publication | Prototype against the real polygon early; calculate area in square meters; return measured deviations and refuse publication when outside the approved threshold. |
| Geometry editing can invalidate member assignments | High: participants can be left without a territory | Persist edits transactionally; identify affected signups and require realignment before deleting/splitting occupied areas. |
| RLS role checks expose contacts or allow privilege escalation | High: personal-data disclosure or unauthorized administration | Keep roles in server-controlled tables, test positive and negative policies with real role fixtures, and keep privileged keys server-side only. |
| Local Node/npm runtime may diverge from Vercel/CI | Medium: engine-specific tooling may fail only in one environment | Pin the supported Node/npm versions in package metadata, enforce engines, and run install/build/test on Node 24 in CI and preview. |
| OpenStreetMap public tile capacity/policy may not suit sustained production use | Medium: map may be rate-limited | Follow attribution and tile-use policy; assess traffic and choose an appropriate tile provider before scaling beyond the pilot. |
| Users may interpret signups as attendance or area equality as workload equality | Medium: inaccurate expectations | Label records as registrations, omit check-in, and present the ±15% metric as geometric area balance only. |

## Open Questions

- Obtain the official urban-perimeter data and confirm CRS/source metadata during T01; block territory geometry work until verified with the Prefeitura.
