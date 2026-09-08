# TerritoryMap — Claude Code Project Guide

This file gives Claude Code full context on the project so every session
starts with zero re-explanation needed.

---

## What this app does

TerritoryMap is a Hindi community canvassing app for the Hamilton Hindi Group
(New Zealand). Volunteers (called "publishers") are assigned map territories
and knock on doors to find Hindi-speaking households. They record each door
as H (Home), NH (Not Home), or NLH (No Longer Hindi).

The data source is `Master_Map_routing.xlsm` — an Excel file with ~2,700
addresses across Ngaruawahia, Taupiri, Horotiu, and Hamilton. This is what
gets imported into Firestore.

---

## Tech stack

| Layer        | Choice                                          |
|-------------|------------------------------------------------|
| Frontend     | React 18 + Vite + React Router v6 + Tailwind   |
| Auth         | Firebase Auth (email/password + JWT)            |
| Database     | Firestore (NoSQL — see schema below)            |
| Backend      | **None** — Firebase is on the free Spark plan, which excludes Cloud Functions. Every write that would normally be server-mediated is a direct client write validated by `firestore.rules` instead. |
| Geocoding    | OpenStreetMap Nominatim, called client-side during import (no key, rate-limited to 1 req/sec) |
| Routing      | OSRM Trip API (foot profile, open source), called client-side |
| Hosting      | Firebase Hosting                                |

**Why no backend:** Cloud Functions (even 2nd-gen callables and Firestore
triggers) require the Blaze (pay-as-you-go) plan. This project intentionally
stays on Spark, so there is no `functions/` directory and never has been a
Trigger Email extension (that's also Cloud-Functions-based) or a way to push
FCM notifications to another user's device. See "Key conventions" below for
how privileged operations are handled instead.

---

## Three roles

1. **super_admin** — imports data, creates admins, system-wide view
2. **admin** — manages a group, invites/assigns users to territories
3. **user** — works assigned territories or self-selected routes on mobile

Role is stored in `users.role` in Firestore. The app reads this after login
and routes to the right dashboard automatically (`src/App.jsx`).

---

## Firestore collections (schema)

### `users/{userId}`
Doc ID **is** the Firebase Auth UID (rules key off this).
```
firebase_uid  string        denormalised copy of the doc ID
name          string
email         string
role          enum          super_admin | admin | user
group_id      string|null   ref → groups
created_at    timestamp
```

### `groups/{groupId}`
```
name          string        e.g. "Hamilton Hindi Group"
admin_id      string        ref → users
region_ids    string[]      ref[] → regions
created_at    timestamp
```

### `group_members/{memberId}`
```
group_id      string        ref → groups
user_id       string        ref → users
status        enum          pending | active | removed
joined_at     timestamp
```

### `regions/{regionId}`
```
name          string        Ngaruawahia | Taupiri | Horotiu | Hamilton
created_at    timestamp
```

### `territories/{territoryId}`
```
region_id     string        ref → regions
group_id      string        ref → groups
map_number    number        e.g. 1
map_sub       string        e.g. "a"  → together "1a"
suburb        string
total_addresses number      cached count from import
status        enum          available | active | completed
created_at    timestamp
```

### `addresses/{addressId}`
```
territory_id  string        ref → territories
street_number string
unit          string|null
street_name   string
suburb        string        denorm from territory
mother_tongue string|null   e.g. Punjabi, Gujarati, Fiji Hindi
lat           number|null   geocoded via Nominatim — null if lookup failed
lng           number|null   geocoded via Nominatim — null if lookup failed
created_at    timestamp
```

### `territory_assignments/{assignmentId}`
```
territory_id    string      ref → territories
user_id         string      ref → users
assigned_by     string      ref → users (the admin)
status          enum        active | completed | recalled
route_sequence  string[]    ordered address IDs from OSRM
assigned_at     timestamp
completed_at    timestamp|null
```
NOTE: Multiple users CAN be assigned to the same territory simultaneously.
The old 1-user-per-territory rule has been dropped.

Readable by any signed-in member of the territory's group (not just the
admin or the assignee) — needed client-side for conflict checks and for
detecting when every door in a shared territory has been visited, since
there's no server to compute that centrally.

### `call_records/{recordId}`
```
address_id    string        ref → addresses
territory_id  string        denorm — for admin progress queries
recorded_by   string        ref → users
call_number   number        1 = first visit, 2 = return visit — counts only this publisher's own prior visits to the address
status        enum          H | NH | NLH
notes         string|null
source        enum          assigned | self_selected
recorded_at   timestamp
```
call_records are IMMUTABLE — never update, only create. Readable group-wide
(same reasoning as territory_assignments above).

### `personal_routes/{routeId}`
```
user_id       string        ref → users
group_id      string        ref → groups — denormalised so other group members can read active routes for conflict checks
name          string|null   e.g. "Saturday run"
status        enum          active | completed
address_ids   string[]      ordered by OSRM sequence
created_at    timestamp
```

### `invites/{token}`
Doc ID **is** the invite token itself (a UUID) — it's an unguessable
capability, so a `get` of one specific invite is public (`allow get: if
true` in rules), while listing/querying the collection stays admin-only.
```
email         string        stored lowercased
group_id      string        ref → groups
group_name    string        denorm
invited_by    string        ref → users (admin)
user_id       string|null   null until accepted
status        enum          pending | accepted | expired | declined
token         string        same value as the doc ID
created_at    timestamp
expires_at    timestamp     7 days from creation
```
No email is actually sent (no Trigger Email extension without Blaze) — the
admin gets a copyable link in the UI and shares it manually.

### `join_requests/{requestId}`
Doc ID is **deterministic**: `${user_id}_${group_id}`. This lets a security
rule check "does a pending request exist for this exact user+group" with a
single `get()` instead of a query, which is what makes admin-approved group
membership possible without a Cloud Function.
```
user_id       string        ref → users
group_id      string        ref → groups
status        enum          pending | accepted | declined
requested_at  timestamp
resolved_at   timestamp|null
```

---

## Required Firestore indexes (already in firestore.indexes.json)

- territories: group_id ASC + status ASC
- territory_assignments: user_id ASC + status ASC
- territory_assignments: territory_id ASC + status ASC
- call_records: territory_id ASC + recorded_at DESC
- call_records: territory_id ASC + recorded_by ASC
- personal_routes: user_id ASC + status ASC
- personal_routes: group_id ASC + status ASC
- join_requests: group_id ASC + status ASC
- invites: email ASC + status ASC
- group_members: group_id ASC + status ASC

---

## What's built

Everything — foundation and every feature originally scoped, all as direct
client writes (no `functions/` directory):

### Frontend (src/)
- `firebase/config.js` — Firebase SDK init from .env vars (exports `firebaseConfig` too, for the secondary-app trick below)
- `context/AuthContext.jsx` — live auth + profile listener, `useAuth()` hook
- `App.jsx` — role-based routing (reads `profile.role` → right dashboard)
- `utils/secondaryAuth.js` — creates a Firebase Auth user without signing out the caller (spins up a throwaway secondary Firebase App). Used when a super admin creates an admin account.
- `utils/geocode.js` — Nominatim client geocoder, rate-limited to 1 req/sec
- `utils/importAddresses.js` — client-side port of the old import Cloud Function: idempotent (deterministic doc IDs), geocodes new addresses, batches Firestore writes
- `utils/personalRouteConflicts.js` — best-effort client-side conflict check for self-selected addresses
- `utils/osrm.js` — `optimiseRoute()` + `getTripDistanceKm()`
- `pages/LoginPage.jsx` — email/password login with friendly errors
- `pages/InvitePage.jsx` — invite-link flow: new users self-register (`createUserWithEmailAndPassword`) or existing signed-in users just file a request; either way it creates a `join_requests` doc for the admin to approve (there's no server to auto-grant membership)
- `pages/SuperAdminPage.jsx` + `pages/superadmin/` — overview, Create Admin modal, Import page
- `pages/AdminPage.jsx` + `pages/admin/` — territories table, assign panel, invite-link generator, join requests, territory detail, members, reports
- `pages/UserPage.jsx` + `pages/user/` — assigned territories + DoorCard + map, self-select route, history. `UserDashboard.jsx` also does the "is this territory fully visited?" check that used to be a Firestore trigger — whichever publisher's client notices completion flips the territory/assignment status themselves.
- `components/shared/` — Sidebar (role-aware, mobile-responsive), Spinner, OfflineBanner
- `components/user/RouteMap.jsx`, `DoorCard.jsx`
- `components/superadmin/CreateAdminModal.jsx`
- `index.css` — Tailwind + custom component classes (`.btn-primary`, `.card`, `.pill-*`, `.input`)

### Firebase config
- `firestore.rules` — the actual authorization layer now that there's no server. Validated against the Firestore emulator (no syntax errors; unauthenticated writes rejected; the invite capability-link pattern confirmed to work).
- `firestore.indexes.json` — all composite indexes
- `firebase.json` — hosting + firestore emulator config (no `functions` block)

### Known trade-offs from having no backend
- **No automated email** — invites are a link the admin copies and sends manually.
- **No push notifications** — dropped entirely; there's no way to notify another user's device without some server. Real-time in-app updates via `onSnapshot` still work while the app is open.
- **Slightly relaxed visibility within a group** — any group member can read `territory_assignments`, `call_records`, and active `personal_routes` belonging to their own group (not just their own or admin's), because conflict-checking and multi-assignee completion detection need that visibility and there's no trusted server to compute it centrally instead. Cross-group data stays fully isolated.
- **Import is slow and browser-bound** — Nominatim's 1 req/sec limit means geocoding ~2,700 addresses takes about 45 minutes with the tab open, since there's no server to do it in the background.
- **`checkTerritoryComplete` and `removeMember`-style "recall assignments" logic run in whichever client happens to trigger them**, not atomically on a server — fine at this app's scale, but not transactionally bulletproof against simultaneous edits from two devices.

---

## Key conventions to follow

### Firestore
- Always use `onSnapshot` for data the UI needs to stay live (admin dashboard, user territories)
- Use `getDocs` one-time for data that doesn't need real-time (loading addresses for a route)
- Never update `call_records` — only create
- Always include `territory_id` on `call_records` (denormalised, needed for progress queries)
- **There is no Admin SDK bypass.** Every write goes through `firestore.rules`. If a feature needs a privileged multi-document write (e.g. "admin creates another user's account", "approve a join request and grant group access"), the pattern is: (1) design the rule so it can validate the write using only `get()` lookups on documents that already exist (often via a deterministic doc ID, like `join_requests/{user_id}_{group_id}`), then (2) do the write as a client `writeBatch`. Look at `firestore.rules` and `AdminOverview.jsx`'s `JoinRequests`/`AssignPanel` for the pattern before adding a new privileged operation.
- Firestore denies an **entire** query if any document in the potential result set could fail its security rule (not a silent per-doc filter). Scope queries with `where` clauses that make every possible result provably pass the rule — see `MembersPage.jsx` and `ReportsPage.jsx` for the "chunk by up to 30 IDs with `in`" pattern used to stay within that constraint.

### Styling
- Use the custom Tailwind classes from index.css: `.card`, `.btn-primary`, `.btn-ghost`, `.btn-soft`, `.input`, `.label`, `.pill-available`, `.pill-active`, `.pill-complete`
- Brand colour: `text-brand` / `bg-brand` (#2F56D9)
- Mobile-first for user screens: the publisher is on a phone at the doorstep
- Desktop-first for admin/super-admin: they work at a desk

### Component pattern
```jsx
// Every page follows this shell pattern
export default function SomePage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route index element={<MainView />} />
        </Routes>
      </main>
    </div>
  )
}
```

---

## Environment variables (.env)

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_OSRM_BASE_URL=https://router.project-osrm.org
```

No geocoding key needed — Nominatim is free and keyless.

---

## Running locally

```bash
# Start React dev server
npm run dev

# Start Firebase emulators (auth + firestore only — no functions)
firebase emulators:start

# Deploy rules/indexes + hosting
firebase deploy
```

First-time setup on a fresh Firebase project: create it, enable Auth
(email/password) and Firestore, fill in `.env` from `.env.example`, put the
project ID in `.firebaserc`, then `firebase deploy --only firestore:rules,firestore:indexes,hosting`.
The very first `super_admin` account has to be created manually (Auth
console + a matching `users/{uid}` Firestore doc with `role: "super_admin"`)
since there's no bootstrap UI for it by design.
