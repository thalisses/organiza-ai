# Task List: Organiza AI MVP

## Task T01: Obtain and validate the urban-perimeter geometry (in progress; official seven-polygon layer selected)

**Description:** Obtain Maringá's current legal urban-perimeter polygon from the Prefeitura, convert only with an approved source/CRS, and document attribution and CRS. Do not substitute the IBGE municipal perimeter. If the official polygon cannot be obtained or validated, stop the territory-dependent tasks and request a decision.

**Status note (2026-10-12):** O usuário solicitou usar o perímetro urbano oficial completo no MVP. As sete feições do pacote da Prefeitura de 20/07/2026 foram convertidas para GeoJSON EPSG:4326 e integradas ao mapa local T07; T08 pode iniciar a prova técnica com essa fonte. Licença/atribuição, campo `ULT_LEI`, conferência manual GIS e a divergência do Projeto Reviver seguem registradas em `docs/geo-data.md` antes de preview público.

**Acceptance criteria:**
- [ ] The source is the current legal urban perimeter and its provenance/license are documented.
- [x] The selected Distrito Sede geometry is valid, source/project CRSs are known, and the project copy is GeoJSON suitable for the agreed PostGIS/Leaflet flow.
- [x] No map partition is built from an unverified or rural-inclusive substitute.

**Verification:**
- [ ] Manual GIS check with the Prefeitura's legal map: load the official source and converted GeoJSON, verify legal urban extent and CRS.
- [x] Record geometry validity and approximate area in the data-source note.
- [ ] No app build applies to this data-readiness task.

**Dependencies:** None.

**Files likely touched:**
- `src/data/maringa-urban-boundary.geojson`
- `docs/geo-data.md`

**Estimated scope:** Small.

## Task T02a: Configure and lock the application toolchain (completed)

**Description:** Add the approved React/Vite/TypeScript/Supabase stack and test/lint scripts. Use the verified Geoman plugin with React Leaflet and Leaflet. Pin versions, review package provenance, and establish a fail-closed npm lifecycle-script policy before installing dependencies.

**Acceptance criteria:**
- [x] `package.json` and `package-lock.json` pin exact versions: Node 24.21 LTS, React/React DOM 19.3.0, TypeScript 5.9.3, Vite 6.4.4, Supabase JS 2.117.3, Leaflet 1.9.4, React Leaflet 5.0.0, Geoman 2.20.2, React Vite plugin 4.7.0, Vitest 4.1.11, ESLint 10.12.0, and jsdom 30.1.2; other test/lint dependencies are pinned too.
- [x] `.npmrc` sets `ignore-scripts=true` and `engine-strict=true`; scripts are defined for `dev`, `build`, `typecheck`, `test`, and `lint`. E2E script/config is added with T16.
- [x] Geoman's MIT license and peer ranges are documented; no unapproved dependency is added. The esbuild lifecycle source is reviewed and its postinstall remains blocked unless a specific need is demonstrated.

**Verification:**
- [x] `npm ci --ignore-scripts` completes from the generated lockfile under Node 24.
- [x] `npm audit --audit-level=high` reports no unmitigated reachable high/critical issue.

**Dependencies:** None; may proceed in parallel with T01.

**Files likely touched:**
- `.npmrc`
- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.json`

**Estimated scope:** Medium.

## Task T02b: Create the runnable React shell (completed)

**Description:** Add the Vite entry point, ESLint flat config, and minimal Portuguese app shell so the repository builds and the test runner has a smoke test before feature work begins.

**Acceptance criteria:**
- [x] The app mounts from the Vite entry point and displays the initial application shell.
- [x] The shell test verifies a nonblank render.
- [x] No credentials or real Supabase keys are embedded in source.

**Verification:**
- [x] `npm run test -- --run src/App.test.tsx` passes.
- [x] `npm run build` succeeds.
- [x] Manual check: `npm run dev` opens the shell in a browser with no console errors.

**Dependencies:** T02a.

**Files likely touched:**
- `index.html`
- `src/main.tsx`
- `src/App.tsx`
- `src/App.test.tsx`
- `eslint.config.js`

**Estimated scope:** Small.

### Checkpoint: Toolchain
- [ ] T01 boundary provenance/CRS is recorded or explicitly blocked pending Prefeitura data.
- [ ] `npm run test -- --run` and `npm run build` pass.
- [ ] Review selected map-editing plugin and package changes before feature implementation.

## Task T03: Create identity schema and baseline RLS (completed)

**Description:** Configure local Supabase development and add the city/profile schema for Maringá, server-controlled roles, the pilot-city record, baseline RLS, explicit Data API grants, and an `npm run test:db` wrapper. The signup trigger always creates participants and ignores client role/city metadata; trusted leader assignment is implemented in T06.

**Acceptance criteria:**
- [x] Public signup trigger can only produce a `participante` profile for the seeded pilot city Maringá and ignores client-supplied role/city metadata.
- [x] No public table privilege or policy allows a participant to elevate their role or change their city; trusted leader assignment is handled in T06.
- [x] Exposed profile/city tables have explicit minimum `GRANT`s and RLS; local config disables automatic Data API grants; anonymous access and participant privilege escalation are denied.
- [x] `npm run test:db` invokes the local pgTAP command confirmed from the installed Supabase CLI help.

**Verification:**
- [x] `npm run test:db` covers schema, grants, anonymous denial, participant ownership, and protected role/city fields.
- [x] `npm run build` succeeds.
- [x] Manual check: `supabase db reset --local --no-seed` applies the migration on the local Supabase instance.

**Dependencies:** T02a, T02b.

**Files likely touched:**
- `supabase/config.toml`
- `supabase/migrations/<identity-schema>.sql`
- `supabase/tests/identity_profile_rls.test_test.sql`
- `package.json`

**Estimated scope:** Medium.

## Task T04a: Add environment protection and tested Supabase client (completed)

**Description:** Add the root ignore rules and placeholder-only environment example, and initialize a lazy Supabase client from Vite public variables.

**Acceptance criteria:**
- [x] `.gitignore` excludes real `.env*` files and local Supabase temp data while `.env.example` contains only placeholder values.
- [x] Supabase client does not initialize until first use, reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, and reports missing config without exposing secrets.
**Verification:**
- [x] `npm run test -- --run src/lib/supabase/client.test.ts` verifies missing config and singleton client initialization.
- [x] `npm run typecheck` and `npm run lint` pass.
- [x] Manual check: inspect `.env.example` for placeholders only and confirm no real credentials are tracked.

**Dependencies:** T03.

**Files likely touched:**
- `.gitignore`
- `.env.example`
- `src/lib/supabase/client.ts`
- `src/lib/supabase/client.test.ts`

**Estimated scope:** Medium.

## Task T04b: Implement tested signup/login service (completed)

**Description:** Implement Supabase Auth signup, sign-in, and sign-out service functions. Normalize WhatsApp to E.164 and send only name and phone metadata; the database trigger controls city and participant role. Convert Auth failures to generic user-facing errors and do not log secrets.

**Acceptance criteria:**
- [x] Signup trims name/email, normalizes Brazilian WhatsApp, and never sends role/city metadata.
- [x] Sign-in and sign-out use Supabase Auth; error messages do not leak provider details.
- [x] Service rejects malformed required data before making Auth requests.

**Verification:**
- [x] `npm run test -- --run src/features/identity-access/lib/authService.test.ts` covers signup metadata, E.164 normalization, invalid input, sign-in, sign-out, and generic failures.
- [x] `npm run typecheck` and `npm run lint` pass.
- [x] Manual check: verify Auth service calls contain no role/city fields.

**Dependencies:** T04a.

**Files likely touched:**
- `src/features/identity-access/lib/authService.ts`
- `src/features/identity-access/lib/authService.test.ts`

**Estimated scope:** Small.

## Task T04c: Deliver accessible participant signup/login UI (completed)

**Description:** Connect the React shell to signup/login forms for the single-city Maringá pilot, with accessible name, WhatsApp, email, and password fields and clear pending/success/error states. Do not add email confirmation or password recovery.

**Acceptance criteria:**
- [x] Participants can switch between signup and login; signup requires name, WhatsApp, email, and password.
- [x] Inputs have visible labels, keyboard navigation, and accessible inline/server error feedback; city and role are not public signup controls.
- [x] Auth session state, including a restored session, and logout state are reflected through Supabase Auth APIs/events; application code does not read tokens directly from browser storage.

**Verification:**
- [x] `npm run test -- --run src/features/identity-access/components/AuthForm.test.tsx` passes mode-switch, validation, pending, success, and error states.
- [x] `npm run build` succeeds.
- [x] Local Supabase smoke: sign up, sign in, sign out, and reload without restoring a session; pgTAP denies participant role updates and preserves the participant role.

**Dependencies:** T04b.

**Files likely touched:**
- `src/App.tsx`
- `src/features/identity-access/components/AuthForm.tsx`
- `src/features/identity-access/components/AuthForm.test.tsx`
- `src/styles.css`

**Estimated scope:** Medium.

## Task T05: Deliver required weekly availability (completed)

**Description:** Add required participant availability to signup/profile using recurring weekdays and one or more time intervals per day in `America/Sao_Paulo`.

**Acceptance criteria:**
- [x] Signup is rejected without at least one valid interval; multiple intervals on a weekday can be saved.
- [x] Participants can read and edit only their own availability.
- [x] Leaders can query availability without receiving unauthorized profile fields.

**Verification:**
- [x] `npm run test -- --run` passes validation, Auth UI, schedule editing, and service cases (31 tests).
- [x] `npm run test:db` passes ownership, leader-read, function-grant, and database-validation cases (47 assertions).
- [x] Local Supabase smoke: sign up with two windows on Monday, edit one after login, and verify both persisted after reload.

**Dependencies:** T04c.

**Files likely touched:**
- `supabase/migrations/20261012213051_identity_availability.sql`
- `supabase/tests/identity_availability_rls.test_test.sql`
- `src/features/identity-access/components/AvailabilityEditor.tsx`
- `src/features/identity-access/components/AvailabilityManager.tsx`
- `src/features/identity-access/lib/availabilityService.ts`
- `src/features/identity-access/lib/availabilityService.test.ts`

**Estimated scope:** Medium.

## Task T06: Deliver trusted leadership assignment (completed)

**Description:** Provide the city-leader workflow to assign/remove `lider_setor` and document how the trusted team bootstraps the first city leader. Roles remain protected by RLS.

**Acceptance criteria:**
- [x] Only the city leader can assign/remove sector-leader roles through the application.
- [x] A sector leader cannot assign roles or promote themself.
- [x] Initial city-leader provisioning uses a trusted administrative procedure, not public signup.

**Verification:**
- [x] `npm run test -- --run` passes role-management and identity tests (38 tests total).
- [x] `npm run test:db` denies participant and sector-leader role changes and allows city-leader assignment/removal (63 assertions).
- [x] Local smoke: provision a disposable city leader with the trusted procedure, assign/remove a sector leader in the UI, then delete both test accounts.

**Dependencies:** T04c, T05.

**Files likely touched:**
- `src/features/identity-access/components/SectorLeaderManagement.tsx`
- `src/features/identity-access/components/SectorLeaderManagement.test.tsx`
- `src/features/identity-access/lib/roleManagementService.ts`
- `src/features/identity-access/lib/roleManagementService.test.ts`
- `supabase/migrations/20261012214929_identity_role_management.sql`
- `supabase/tests/identity_role_assignment.test_test.sql`
- `docs/leader-bootstrap.md`

**Estimated scope:** Medium.

### Checkpoint: Identity
- [x] Signup, login, profile availability, and leader assignment work end-to-end.
- [x] Identity/availability/role RLS tests pass and profile/WhatsApp visibility matches the approved spec.
- [ ] Review before territory work.

## Task T07: Load the boundary and render the city map (completed locally; publication checks pending)

**Description:** Persist the validated official urban perimeter and render an interactive Maringá map with OSM tiles, attribution, and the approved boundary. The map is initially read-only.

**Acceptance criteria:**
- [x] The map uses all seven polygons from the official urban-perimeter layer and renders without geometry errors.
- [x] OSM attribution is visible; no participant data or privileged key is exposed.
- [x] Boundary/CRS mismatch fails clearly instead of silently rendering a wrong extent.

**Verification:**
- [x] `npm run test -- --run src/features/territory-map/components/CityMap.test.tsx` passes seven-feature loading, attribution, wrong/missing CRS, out-of-extent and resize-fit guards.
- [x] `npm run build` succeeds.
- [x] Browser check: verify all seven polygons fit at 375px and desktop after resize, no horizontal overflow, GeoJSON loads lazily, and visible tiles load.
- [ ] Confirm Prefeitura data license/attribution and perform the requested manual GIS comparison before public preview.

**Dependencies:** T01, T02b, T03.

**Files likely touched:**
- `src/data/maringa-urban-boundary.geojson`
- `src/features/territory-map/components/CityMap.tsx`
- `src/features/territory-map/components/CityMap.test.tsx`
- `src/features/identity-access/components/AuthForm.tsx`
- `src/styles.css`
- `src/main.tsx`
- `docs/geo-data.md`

**Estimated scope:** Medium.

## Task T08: Generate and preview balanced partitions

**Description:** Let city leadership draw and save validated region drafts, generate area-balanced subdivisions automatically inside each region, and edit generated vertices before saving validated subdivision drafts.

**Status note (2026-10-12):** PostGIS 3.3.7 is enabled locally. Only the city leader can draw/save colored region drafts, generate subdivisions with UTM long-axis bisection, edit vertices with Geoman, and save changes after PostGIS validation. Generated subdivision IDs remain stable by number. Initial publication and replacement are implemented: replacement requires explicit destinations for every active membership; the new map, archived publication, released/created membership rows, and audit records commit atomically. RLS exposes current membership names/areas only to city leadership, and the UI blocks publication until every destination is selected. Sector leaders cannot edit subdivisions. The participant UI loads published regions/subdivisions read-only through the RLS-scoped map RPC. Turf's actual-data geodesic estimate differs 0.24% from the PostGIS geodesic union, so its UI value is only a preview. See `docs/geo-data.md`.

**Acceptance criteria:**
- [x] Manually drawn Polygon/MultiPolygon drafts are checked for validity, parent containment, overlaps, coverage, and the ±15% target before saving.
- [x] Server validation reports measured area deviation and rejects drafts outside tolerance; no partition is auto-published.
- [x] The schema has stable region/subdivision IDs and supports assigning multiple regions to a sector leader.
- [x] City leadership can group region components, preview the partition, edit colors, and save/update a draft.
- [x] City leadership can generate balanced subdivisions for a saved region and edit their vertices before revalidation/saving.
- [x] Replacing a published map requires an explicit valid destination for every active membership and atomically preserves the old publication and membership history on failure.

**Verification:**
- [x] PostGIS is available locally in the dedicated `extensions` schema; `ST_Transform` and `ST_IsValid` smoke check passes.
- [x] All seven official polygons are stored in PostGIS and protected from anonymous reads and authenticated writes.
- [x] PostGIS subdivision generator passed the official union at counts 2, 3, 5, 7, and 10 with valid geometry, containment, coverage, no overlaps, and deviation under 0.01%.
- [x] Turf preflight tests cover containment, MultiPolygon components across separate nuclei, target counts, and ±15% deviation; actual source is checked against the PostGIS geodesic area.
- [x] PostGIS RPCs validate parent containment, area balance, overlap, coverage, and input complexity; edit saves preserve IDs and reject invalid geometry.
- [x] Assigned and unassigned sector leaders are denied subdivision edits; direct table updates and private RPC execution are revoked.
- [x] Initial publication requires a complete, PostGIS-validated region/subdivision hierarchy and exposes it through participant RLS.
- [x] Participant UI loads visible published geometries after authentication and offers read-only region selection.
- [x] `npm run test -- --run src/features/territory-map/lib` covers count, geometry, colors, and area deviation.
- [x] `npm run test:db` verifies PostGIS geometry constraints and draft persistence/RLS.
- [x] Replacement rejects omitted or old-map destinations without changing the published map or active memberships; complete realignment archives the old map and preserves released membership/audit history.
- [ ] Manual check: try several counts against the actual Maringá polygon and confirm refusal/feedback when tolerance cannot be met.

**Dependencies:** T07.

**Files likely touched:**
- `src/features/territory-map/lib/generatePartitions.ts`
- `src/features/territory-map/lib/generatePartitions.test.ts`
- `src/features/territory-map/components/PartitionGenerator.tsx`
- `supabase/migrations/<territory-schema>.sql`
- `supabase/tests/territory-geometry.sql`

**Estimated scope:** Medium.

## Task T09: Edit map geometry and assign sector regions

**Description:** Complete the city-leader region/subdivision editor and assignment workflow; sector leaders may have region assignments for operational features but cannot edit subdivisions.

**Acceptance criteria:**
- [x] Only city leaders can edit regions and subdivisions; sector leaders are denied even in assigned regions.
- [ ] Invalid/out-of-parent/overlapping/incomplete geometry is rejected by database validation.
- [ ] Color changes are persisted and remain distinct unless a leader intentionally edits them.

**Verification:**
- [x] `npm run test -- --run src/features/territory-map` covers editor controls and city-leader role scope.
- [x] `npm run test:db` denies subdivision edits for assigned and unassigned sector leaders.
- [ ] Manual check: city leader edits a subdivision; assigned/unassigned sector leaders are refused.

**Dependencies:** T06, T08.

**Files likely touched:**
- `src/features/territory-map/components/GeometryEditor.tsx`
- `src/features/territory-map/components/RegionAssignmentPanel.tsx`
- `src/features/territory-map/lib/territoryService.ts`
- `src/features/territory-map/components/GeometryEditor.test.tsx`
- `supabase/tests/territory-rls.sql`

**Estimated scope:** Medium.

## Task T10: Deliver subdivision membership and safe realignment

**Description:** Let participants select and switch their single active subdivision. Prevent geometry changes from deleting/splitting occupied areas until affected memberships are reassigned. The city-leader replacement workflow and atomic membership realignment are implemented; participant enrollment/switching is implemented and locally browser-verified.

**Acceptance criteria:**
- [x] Database enforces at most one active subdivision membership per participant.
- [x] Participants can create/switch only their own membership through an authenticated RPC; each change is transactionally recorded and the prior row remains as history.
- [x] Replacing a published map requires every active membership to move to a subdivision in the new map in the same transaction; invalid or missing destinations roll back.

**Verification:**
- [x] `npm run test -- --run src/features/territory-map` covers participant selection/switching, city-leader realignment UI, and publication gating.
- [x] `npm run test:db` covers uniqueness, participant ownership/privacy, role denial, exact mapping, invalid/omitted destination rollback, archived publication, and membership history.
- [x] Browser-tested participant enrollment and switching on a disposable local account; verified one active link plus one released history row and removed the test account/map afterward.
- [ ] Manual check: attempt an occupied-area split, reassign participants, and retry.

**Dependencies:** T09.

**Files likely touched:**
- `supabase/migrations/<subdivision-memberships>.sql`
- `supabase/tests/subdivision-memberships.sql`
- `src/features/territory-map/components/SubdivisionSignup.tsx`
- `src/features/territory-map/lib/membershipService.ts`
- `src/features/territory-map/lib/membershipService.test.ts`

**Estimated scope:** Medium.

### Checkpoint: Territory
- [x] Participant map selection and one-active-area registration work; disposable-account browser verification completed.
- [ ] City/sector editing and area realignment protections pass RLS/PostGIS tests.
- [ ] Review partition quality with the actual boundary before events are added.

## Task T11: Deliver leadership act management

**Description:** Add act schema and create/edit/cancel forms for city-wide and subdivision scopes. City leaders manage all acts; sector leaders manage only acts in their assigned regions. A canceled act remains visible with registrations preserved.

**Acceptance criteria:**
- [ ] Act stores title, predefined category, start time, address/map point, one scope, and scheduled/cancelled status.
- [ ] Only city leaders can create city-wide acts; sector leaders manage only assigned subdivisions.
- [ ] Cancel changes status without deleting the act or registrations; no automatic notification is sent.

**Verification:**
- [ ] `npm run test -- --run src/features/acts` passes act validation and management cases.
- [ ] `npm run test:db` passes act RLS and city-perimeter point validation.
- [ ] Manual check: create both act scopes, edit, cancel, and verify retained record.

**Dependencies:** T10.

**Files likely touched:**
- `supabase/migrations/<acts-schema>.sql`
- `supabase/tests/acts-rls.sql`
- `src/features/acts/lib/actService.ts`
- `src/features/acts/components/ActManagementForm.tsx`
- `src/features/acts/lib/actService.test.ts`

**Estimated scope:** Medium.

## Task T12: Deliver agenda and participant act signup

**Description:** Show upcoming/cancelled acts in agenda and map views and let any participant register for any Maringá act and cancel their own registration before its start.

**Acceptance criteria:**
- [ ] Participants can discover both city-wide and subdivision acts without being restricted by their own subdivision.
- [ ] There is no capacity limit; a participant may register for multiple acts.
- [ ] A participant sees their own registration state and can cancel it before start, but cannot see other participants' registrations.

**Verification:**
- [ ] `npm run test -- --run src/features/acts` passes agenda and registration tests.
- [ ] `npm run test:db` denies access to other participants' registrations.
- [ ] Manual check: register for a subdivision act outside the participant's assigned area and cancel before start.

**Dependencies:** T11.

**Files likely touched:**
- `src/features/acts/pages/AgendaPage.tsx`
- `src/features/acts/components/ActCard.tsx`
- `src/features/acts/components/ActMapLayer.tsx`
- `src/features/acts/lib/registrationService.ts`
- `src/features/acts/lib/registrationService.test.ts`

**Estimated scope:** Medium.

## Task T13: Deliver private leadership attendee rosters

**Description:** Let authorized sector and city leaders view the signup roster for acts they can manage, including participant name and the WhatsApp link permitted by the identity spec.

**Acceptance criteria:**
- [ ] Participants cannot query attendee names, phone numbers, or roster counts if counts would reveal private registration data.
- [ ] Assigned sector leaders see rosters for their subdivision acts; city leaders see all Maringá rosters.
- [ ] WhatsApp links use normalized participant numbers and are rendered only in authorized views.

**Verification:**
- [ ] `npm run test -- --run src/features/acts` passes role-specific roster tests.
- [ ] `npm run test:db` verifies positive and negative roster/contact access.
- [ ] Manual check: compare city-leader, assigned sector-leader, unassigned sector-leader, and participant views.

**Dependencies:** T12.

**Files likely touched:**
- `src/features/acts/components/AttendeeRoster.tsx`
- `src/features/acts/lib/attendeeService.ts`
- `src/features/acts/components/AttendeeRoster.test.tsx`
- `supabase/tests/attendee-privacy.sql`

**Estimated scope:** Small.

### Checkpoint: Acts
- [ ] City/subdivision act flows, cancellation, and roster privacy pass.
- [ ] No-capacity/no-notification scope remains enforced.

## Task T14: Deliver leadership material-point management

**Description:** Add independent material-point CRUD with free-text material/topic, map point/address, and recurring weekly pickup windows. Both leadership roles manage all points; deleting a point also deletes its windows.

**Acceptance criteria:**
- [ ] Leaders can create/edit/delete a point without a region/subdivision association.
- [ ] A point requires text material/topic, address, valid in-city coordinates, and at least one weekly window; multiple non-overlapping windows per weekday are supported.
- [ ] Deleting the point removes associated pickup windows; participants cannot modify points.

**Verification:**
- [ ] `npm run test -- --run src/features/material-points` covers point and schedule validation.
- [ ] `npm run test:db` covers geometry, cascade, and both leader roles.
- [ ] Manual check: create a point with two windows on one weekday, edit it, then delete it.

**Dependencies:** T07; may proceed in parallel with T11-T13 after the map foundation is stable.

**Files likely touched:**
- `supabase/migrations/<material-points-schema>.sql`
- `supabase/tests/material-points-rls.sql`
- `src/features/material-points/lib/materialPointService.ts`
- `src/features/material-points/components/MaterialPointForm.tsx`
- `src/features/material-points/lib/materialPointService.test.ts`

**Estimated scope:** Medium.

## Task T15: Deliver participant material-point discovery

**Description:** Show points both as Leaflet markers and as a list, with matching details and text search/filter by free-text material/topic. Reuse the shared weekly-schedule editor/formatter where practical.

**Acceptance criteria:**
- [ ] Selecting a map marker or list row opens the same point details.
- [ ] Participants can read material/topic, address, and all weekly pickup windows.
- [ ] No reservation, stock count, or withdrawal confirmation controls appear.

**Verification:**
- [ ] `npm run test -- --run src/features/material-points` covers marker/list parity and details.
- [ ] `npm run build` succeeds.
- [ ] Manual check: compare the same point's details from map and list at desktop and mobile sizes.

**Dependencies:** T14.

**Files likely touched:**
- `src/features/material-points/pages/MaterialPointsPage.tsx`
- `src/features/material-points/components/MaterialPointList.tsx`
- `src/features/material-points/components/MaterialPointMapLayer.tsx`
- `src/features/material-points/pages/MaterialPointsPage.test.tsx`

**Estimated scope:** Medium.

### Checkpoint: Material Points
- [ ] Both leadership roles can manage points and participants can discover them without reserve/stock features.
- [ ] Spatial/time-window RLS and validation tests pass.

## Task T16: Complete cross-role E2E and security review

**Description:** Add Playwright coverage for the full pilot journey, run cross-module authorization/privacy checks, inspect responsive behavior, and review dependency/security findings.

**Acceptance criteria:**
- [ ] E2E covers signup/login, availability, map membership, act registration/cancellation and attendee privacy, and material-point map/list.
- [ ] E2E confirms city leader, assigned sector leader, unassigned sector leader, and participant permissions.
- [ ] Security review finds no unmitigated reachable critical/high dependency findings and no client-exposed privileged credentials.

**Verification:**
- [ ] `npm run test -- --run` passes.
- [ ] `npm run test:e2e` passes against a clean local test environment.
- [ ] `npm audit --audit-level=high` passes or documented deferrals include owner and review date.

**Dependencies:** T10, T13, T15.

**Files likely touched:**
- `playwright.config.ts`
- `e2e/identity-territory.spec.ts`
- `e2e/acts.spec.ts`
- `e2e/material-points.spec.ts`
- `docs/security-review.md`

**Estimated scope:** Medium.

## Task T17: Prepare and verify a Vercel preview

**Description:** Document required environment variables and configure a Vercel preview deployment for the static app; keep production launch separate from the MVP plan approval.

**Acceptance criteria:**
- [ ] Only the Supabase publishable/anon client key and project URL are exposed to the frontend; no service-role or database password is present.
- [ ] Preview build succeeds with documented environment variables and client-side routes resolve.
- [ ] Production deployment is not triggered without explicit release approval.

**Verification:**
- [ ] `npm run build` passes locally.
- [ ] Vercel preview reports a successful build and loads auth/map routes.
- [ ] Manual check: verify no secret values appear in the built client bundle or browser network responses.

**Dependencies:** T16.

**Files likely touched:**
- `.env.example`
- `vercel.json`
- `README.md`
- `docs/deployment.md`

**Estimated scope:** Small.

### Checkpoint: Complete
- [ ] Every accepted spec criterion is verified by automated test or documented manual check.
- [ ] Preview is reviewed by the human; production remains a separate release decision.
