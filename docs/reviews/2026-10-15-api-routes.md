# Review, api-routes, 2026-10-15

**Reviewed by**: Claude Sonnet 5.5 (author model not stated)
**Scope**: 8 files changed in the diff (next.config.ts, package.json, src/app/page.tsx, src/app/api/events/route.ts, src/app/api/events/[slug]/route.ts, src/app/events/[slug]/page.tsx, src/components/BookEvent.tsx, src/lib/events.ts; package-lock.json ignored), plus src/database/event.model.ts, src/lib/mongodb.ts and EventCard.tsx read for context. Branch api-routes vs main (merge base c5e9b42).
**Verdict**: Changes requested

## Summary
Adds event API routes, a cached data layer (`"use cache"` + `cacheTag`), a prerendered event details page, and a booking form shell. The Cache Components usage (async `params` inside Suspense, two-argument `revalidateTag`, `PageProps`, `server-only` data access, lean/serializable results) matches the bundled Next 16.4 docs. The headline problems are on the details page: it fails the build when the events collection is empty, it `JSON.parse`s fields the model types as plain string arrays, and the booking form is a non-functional stub next to a hard-coded "10 people booked" claim. The unauthenticated upload/create endpoint is the main issue elsewhere.

Note: while this review ran, `BookEvent.tsx` changed from a syntactically broken draft (`const handleSubmit = (e: React.FormEvent)` with no body) to the current stub. `npx tsc --noEmit` passes on the current tree. The findings below are against the current files.

## Major
### 🟠 `generateStaticParams` breaks the build when there are no events, `src/app/events/[slug]/page.tsx:9`
**Problem**: With `cacheComponents: true`, the Next docs (generate-static-params.md, "With Cache Components") say `generateStaticParams` must return at least one param; an empty array is a build error. This function returns `slugs.map(...)`, which is empty on a fresh or empty database. It also requires `MONGO_URI` and a reachable DB during `next build` (the cached `getEvents` on the home page has the same need), and `getEventSlugs` throws if the DB is down.
**Why it matters**: CI or a first deploy against an empty or unreachable database fails the build. The comment about "events created after the build" implies runtime creation is expected, which is exactly the empty-start case.
**Suggested fix**: Handle the empty case (the docs suggest returning a placeholder param and relying on `notFound()`), or seed before build. Decide explicitly what the build should do when the DB is unavailable.

### 🟠 Unguarded `JSON.parse` on `agenda[0]` / `tags[0]`, `src/app/events/[slug]/page.tsx:114` and `:121`
**Problem**: `IEvent` types `agenda` and `tags` as `string[]`, and the schema stores arrays. The page treats element 0 as a JSON-encoded array. This only works because the POST route does `Object.fromEntries(formData)`, so Mongoose casts the single JSON string into a one-element array. Any event stored as a real array (seed script, admin edit, repeated form fields, direct DB insert) makes `JSON.parse("Intro")` throw and the whole page errors. A parse result that is not an array of strings also crashes `.map`. The home page and the `[slug]` API return the unparsed shape, so consumers disagree on the contract.
**Why it matters**: One bad record breaks that event page. TypeScript cannot catch it because the type says `string[]`.
**Suggested fix**: Normalize at the write boundary (parse and validate agenda/tags in the POST handler so the DB holds real arrays), then render `event.agenda` / `event.tags` directly. If legacy data must be supported, centralize a safe parser that validates the result.

### 🟠 Booking form is a non-functional stub, `src/components/BookEvent.tsx:9`
**Problem**: `handleSubmit` only calls `preventDefault()` (with an empty line left inside), `setSubmitted` is never called, and nothing is sent anywhere. There is no booking route, although `src/database/booking.model.ts` exists. The form renders live on every event page.
**Why it matters**: A visible primary call to action that silently does nothing and never captures the email.
**Suggested fix**: Implement submission (route or server action using the booking model, validation, loading/error state) or keep the form out of this branch until it works.

### 🟠 `POST /api/events` is unauthenticated and trusts raw form data, `src/app/api/events/route.ts:8`
**Problem**: Anyone can POST a file that is streamed to Cloudinary (no auth, rate limit, size cap or MIME check) and create an event. `formData.get("image") as File` is a cast, so a plain string field passes the `!file` check and then fails on `.arrayBuffer()` as a 500. `Object.fromEntries(formData)` passes every client-supplied field into `Event.create`. Error bodies return `error.message` (line 53) and the GET handler returns the raw `error` object (line 66), leaking internals. `connectToDatabase()` runs before input is parsed.
**Why it matters**: An open upload endpoint on a paid Cloudinary account, plus public write access to the content shown on the site.
**Suggested fix**: Gate with auth (or a shared secret) before this ships, validate file type and size, whitelist fields, return generic error messages, and map validation errors to 400 and duplicate-slug errors to 409 instead of 500.

## Minor
### 🟡 Missing icon file, `src/app/events/[slug]/page.tsx:88`
`/icons/calender.svg` does not exist; the file is `public/icons/calendar.svg` (EventCard uses the correct name). The date row renders a broken image. Fix the path and the `alt="calender"` text.

### 🟡 Hard-coded booking count, `src/app/events/[slug]/page.tsx:59`
`const bookings = 10` shows every visitor "Join 10 people who have already booked", and the else branch is unreachable. Use a real count from the booking model or drop the sentence until booking exists.

### 🟡 `notFound()` inside Suspense returns HTTP 200, `src/app/events/[slug]/page.tsx:57`
Per not-found.md, once streaming starts from a Suspense boundary the status stays 200 (Next adds `noindex`), so unknown slugs are soft 404s. Acceptable if intentional. Also, the page does no slug validation (the API route has `SLUG_PATTERN`), so each distinct bogus slug triggers a DB query and its own hour-long cached `null` entry. Reuse the API's slug validation before querying.

### 🟡 Cloudinary pattern too broad and env undocumented, `next.config.ts:5`
`hostname: "res.cloudinary.com"` with no `pathname` lets the image optimizer proxy any Cloudinary account's images. Restrict to `/<cloud-name>/**`. `.env.example` also has no `CLOUDINARY_URL` (the SDK reads it implicitly), so a fresh setup fails at upload time.

### 🟡 `shadcn` downgraded and `eslint-config-next` unpinned, `package.json:23` and `:32`
`shadcn` went from `^4.21.4` to `^1.0.0` (the lock resolves 1.0.0) while `components.json` uses the newer `base-nova` style. This looks accidental; confirm intent. `eslint-config-next` moved from exact `16.4.0` (matching `next`) to a caret range, which can drift from the Next version.

### 🟡 `revalidateTag(..., "max")` is stale-while-revalidate, `src/app/api/events/route.ts:46`
The first request after creation is still served the old list while the refresh runs, so the comment ("show up without waiting") overstates it. Use `{ expire: 0 }` (or `updateTag` from a Server Action) if read-your-own-write matters.

### 🟡 Unbounded list queries, `src/lib/events.ts:21` and `src/app/api/events/route.ts:62`
`getEvents` and `GET /api/events` fetch every event with no limit, and the latter returns full documents including `_id`/`__v`. Fine at crash-course scale; cap before real data.

### 🟡 Home page has no empty state or DB-failure handling, `src/app/page.tsx:19`
`events.length > 0 && ...` renders an empty list silently, and `getEvents()` throwing takes down the page and the build.

## Nits
- ⚪ `src/app/events/[slug]/page.tsx:5`, imports `@/components/BookEvent.js` for a `.tsx` file; every other import is extensionless. tsc accepts it under `moduleResolution: bundler`, but use `@/components/BookEvent`.
- ⚪ `src/app/events/[slug]/page.tsx:73`, banner `alt="Event Banner"` is generic (use the title); it is likely the LCP image, so consider `priority`.
- ⚪ `src/app/events/[slug]/page.tsx:35`, `key={item}` / `key={tag}` collide on duplicate values.
- ⚪ `src/app/events/[slug]/page.tsx`, no `generateMetadata`, so every event page gets the default title and description.
- ⚪ `src/app/events/[slug]/page.tsx:90`, `event.date` is the normalized `YYYY-MM-DD` and is shown raw; format for display.
- ⚪ `src/app/api/events/route.ts:19`, "Invalid JSON data format" is a stale message (the body is form data) and the `error` binding is unused.
- ⚪ `src/lib/events.ts:25`, `getEventSlugs` is deliberately uncached but has no comment saying so, unlike its siblings.
- ⚪ `src/lib/constants.ts` is no longer imported anywhere after the home page switch; remove it if dead.

## Strengths
- Next 16 / Cache Components usage is correct and verified against the bundled docs: `params` awaited inside a Suspense boundary, `"use cache"` + `cacheLife` + `cacheTag`, two-argument `revalidateTag`, global `PageProps`.
- Data layer is well factored: `server-only`, one cached accessor shared by page and tag-invalidated by the write path, `_id` stripped so the cached value is serializable, and `connectToDatabase` retries after a failed attempt.
- The `[slug]` API route validates and normalizes the slug with a bounded, unicode-aware pattern, returns accurate 400/404/500 statuses and does not leak internal errors.

## Test coverage
No test runner or stated convention (TESTS = none-yet), so there is no safety net; noted once. The untested risk sits in runtime-only shapes that typecheck cannot see: the `JSON.parse` of agenda/tags, `generateStaticParams` against an empty database, and the POST handler's validation paths. `/check verify` should exercise an event created through the POST route, an event stored with array-valued agenda/tags, an unknown slug, and a build against an empty database.
