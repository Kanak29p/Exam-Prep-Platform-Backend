# Exam Prep Platform — Backend Code Review

**Repository:** `Exam-Prep-Platform-Backend`
**Branch reviewed:** `main` @ `dc20c24` (after merging PR #5 *feature/chatbot* and the test-suite integration commit `62cbfc9`)
**Reviewer:** Senior Backend Engineer
**Date:** 2026-06-08

---

## 1. Executive Summary

The backend is a Node.js / Express service that talks to a Snowflake data
warehouse and uses Firebase for end-user authentication. Recent work has added
sizeable feature surface — Forum, Mock Tests, Notifications, a Dashboard
analytics endpoint, and a freshly merged Jest test suite.

| Area | Status | Notes |
|------|--------|-------|
| Architecture & layering | Good | Clean controller / service / route separation. |
| Test coverage | Improving | New Jest suite introduced; ~9 files, mostly happy-path. |
| Security posture | At risk | 3 high-severity issues, 4 medium. Detailed in §3. |
| Data correctness | At risk | Score updates are client-trusted; like/reply counters are non-atomic. |
| Code quality | Acceptable | Significant duplication; canonical-order constants drift across files. |
| Operational readiness | Partial | Health-check + Render config present; no rate-limit / helmet / structured logging. |

The codebase is functional and the structure is sound. The blockers below are
**security and correctness** issues that should be resolved before further
production traffic, not stylistic concerns.

---

## 2. Repository Snapshot

```text
src/
├── config/         env.js, firebaseAdmin.js
├── controllers/    auth, forum, mockTest, notification, question
├── db/             snowflake.js (singleton connection + query helper)
├── middleware/     authMiddleware.js, errorHandler.js
├── routes/         auth, forum, mockTest, notification, question
├── services/       forum, mockTest, notification, question, user
├── utils/          normalizeQuery.js
└── server.js
tests/
├── controllers/    auth, mockTest, notification, progress, question
├── middleware/     authMiddleware
├── services/       userService
└── utils/          normalizeQuery
```

The hot files in the most recent five commits are
`authController.js` (+323), `questionController.js` (+433),
`mockTestService.js` (+235), `notificationService.js` (+188), and
`forumController.js` (+177).

---

## 3. Findings, Ranked by Severity

The findings are tagged so they can be linked from issues / PRs.

### 3.1 Critical — Security & Authentication

#### `[CR-1]` Firebase Admin "dev stub" allows authentication bypass in production
**File:** `src/config/firebaseAdmin.js` (lines 61–96)

When the service account file is absent **and** all three sets of env vars are
unset, the module exports a stub whose `verifyIdToken` calls `jwt.decode()` —
i.e. it accepts any well-formed JWT without verifying the signature. The
process logs a warning and keeps running.

**Impact.** If a deploy ever ships without Firebase credentials, an attacker
can craft a token claiming any e-mail address and `authController.login` will
issue them a 7-day backend JWT for that user.

**Fix.** Refuse to start in production when Firebase is not initialised:
```js
if (!isInitialized) {
  if (process.env.NODE_ENV === "production") {
    console.error("Firebase Admin not initialized in production. Aborting.");
    process.exit(1);
  }
  // existing dev-only stub
}
```

#### `[CR-2]` `simulateCronTrigger` lets any logged-in user broadcast pushes to every device
**Files:** `src/controllers/notificationController.js` (lines 35–70), `src/routes/notificationRoutes.js` (line 9)

The route is protected by `verifyToken` only — there is no role check. The
handler internally calls `notificationService.sendNotificationToAll`. This was
also encoded into the new Jest test
`tests/controllers/notificationController.test.js`, which asserts the dispatch
without any 403 path.

**Fix.** Add the same admin guard already used in
`sendBroadcastNotification`, and update the corresponding test:
```js
if (req.user.role !== "admin") {
  return res.status(403).json({ message: "Admin access required" });
}
```

#### `[CR-3]` `signup` does not verify ownership of the e-mail address
**File:** `src/controllers/authController.js` (lines 318–344)

`POST /api/auth/signup` accepts `name` and `email` straight from the request
body. There is no Firebase token requirement. An attacker can therefore
pre-create a row in `USERDETAILS` for any e-mail (`victim@gmail.com`) before
the legitimate user signs up. When the legitimate user later authenticates via
Firebase, `findByEmail` returns the planted row.

**Fix.** Require a Firebase ID token, verify it, and use the verified e-mail
(and ideally the Firebase UID) to populate the row.

#### `[CR-4]` Trusting client-supplied scores on mock-test submission
**Files:** `src/controllers/mockTestController.js` (lines 73–97), `src/services/mockTestService.js` (lines 201–225)

`submitMockTestAttempt` reads `overallScore`, `speakingScore`, etc. directly
from the request body and writes them to `MOCK_TEST_ATTEMPTS`. A user can
`curl -d '{"overallScore":90,...}'` and self-grade. The new test even
validates this contract:
```js
expect(mockTestService.submitMockTestAttempt).toHaveBeenCalledWith(
  "attempt-1", "u1",
  expect.objectContaining({ overallScore: 70 })  // 70 came straight from req.body
);
```

**Fix.** Compute the four module scores and the overall score on the server
from the stored `grades` JSON. Either keep the request body as a raw
`grades` map and derive everything else, or validate that the supplied values
match a server-side computation.

### 3.2 High — Correctness & Robustness

#### `[H-1]` Mock-test attempts have no state guards
**File:** `src/services/mockTestService.js`

* `startMockTestAttempt` does not check if the user already has a `pending`
  attempt for the same mock test. Any number of pending attempts can be
  spawned.
* `updateAttemptProgress` and `submitMockTestAttempt` do not filter on
  `STATUS = 'pending'`, so a user can re-submit an already completed
  attempt and overwrite the recorded scores.

**Fix.** Add `AND STATUS = 'pending'` to both UPDATE statements; before
`startMockTestAttempt`, return the existing pending attempt instead of
creating a new one.

#### `[H-2]` `forum.toggleLike` and `createReply` are non-atomic
**File:** `src/services/forumService.js`

Two concurrent likes from the same user can both observe "no row", both
INSERT, and both increment the post counter, leaving a duplicate row. The
same risk applies to `createReply` because the reply count is denormalised
on the parent post.

**Fix.** Either:
* Add a unique constraint on `(USER_ID, POST_ID)` in `FORUM_LIKES` and use
  `MERGE` for toggling.
* Drop denormalised counters and project `replies = COUNT(*)` /
  `likes = COUNT(*)` in `listPosts`.

#### `[H-3]` FCM token can leak between users on a shared device
**File:** `src/services/notificationService.js` (lines 7–23)

`registerToken` only checks for a row matching `(USER_ID, TOKEN)`. If two
users sign in on the same browser, the same FCM token is associated with
both, and notifications meant for the first user will reach the second.

**Fix.** Before insertion, delete any existing rows with the same `TOKEN` for
other users. Move the `subscribeToTopic` call inside the
`if (rows.length === 0)` branch so it does not run on every register
heartbeat.

#### `[H-4]` Hard-coded `localhost` URL in production push payload
**File:** `src/services/notificationService.js` (line 63)

`webpush.notification.click_action: "http://localhost:5173/dashboard"`
ships in every notification, including those sent to real devices in
production.

**Fix.** Drive from `process.env.FRONTEND_URL` (and combine with each
message's `data.url`).

#### `[H-5]` Two divergent `CANONICAL_ORDER` arrays
**Files:** `src/services/mockTestService.js` (lines 4–33),
`src/services/questionService.js` (lines 17–47)

The two arrays disagree on the spelling of multiple sub-categories:

| mockTestService | questionService |
|---|---|
| `Retell Lecture` | `Re-tell Lecture` |
| `Multiple Choice, Single Answer` | `Multiple Choice Single Answer` |
| `Reorder Paragraphs` | `Reorder Paragraph` |
| `Highlight Incorrect Words` | `Highlight Incorrect Word` |
| `Fill in the Blanks` (Listening) | `Listening Fill in the Blanks` |

`getCanonicalIndex` is case-insensitive but exact-match on the trimmed
string, so a question whose pattern says `"Reorder Paragraphs"` resolves to
`-1` in `questionService` and breaks `listSections` ordering. `normalizeQuery`
adds yet a third spelling for some entries (`Summarize Discussion` vs
`Summarize Group Discussion`).

**Fix.** Move both arrays to `src/utils/canonicalOrder.js`, align with the
strings emitted by `normalizeQuery`, and import from one source of truth.

#### `[H-6]` Open CORS, no rate limiting, no Helmet
**File:** `src/server.js` (line 16)

`app.use(cors())` is fully permissive, and there is no rate limit on auth,
notification, or forum endpoints — combined with `[CR-2]` and `[H-3]` this
is a free spam vector. There is no `helmet` middleware either, so common
security headers are missing.

**Fix.**
```js
app.use(helmet());
app.use(cors({ origin: env.allowedOrigins, credentials: true }));
app.use("/api/auth",          rateLimit({ windowMs: 60_000, max: 30 }));
app.use("/api/notifications", rateLimit({ windowMs: 60_000, max: 10 }));
app.use("/api/forum",         rateLimit({ windowMs: 60_000, max: 60 }));
```

### 3.3 Medium — Maintainability & Design

#### `[M-1]` "Speaking & Writing" → "Speaking | Writing" remap is duplicated five times
The same conditional appears in:
* `authController.dashboard` (twice — once in the time calculation, once in
  module performance),
* `questionService.findById`,
* `questionService.listSections`,
* `mockTestService.getQuestionsForMockTest`.

Extract to `src/utils/category.js`:
```js
function splitSpeakingWriting(category, subCategory) {
  if ((category || "").trim().toLowerCase() !== "speaking & writing") return category;
  const s = (subCategory || "").toLowerCase();
  return s.includes("summarize written") || s.includes("essay") ? "Writing" : "Speaking";
}
```

#### `[M-2]` `timeAgo` formatting and `cleanText*` helpers duplicated
* `forumController.listPosts` and `listReplies` ship two identical 15-line
  blocks for human-readable timestamps.
* `questionController` defines `cleanText` and `cleanTextSimple` with
  byte-identical bodies.
* `splitAnswers` is exported but never imported — dead code.

#### `[M-3]` N+1 against Snowflake in `getQuestionsForMockTest`
`src/services/mockTestService.js` (lines 68–122) fires one query per pattern
row in a sequential `for…of`. On the free Render plan a 20-row pattern
adds noticeable latency. Use `Promise.all` (cheap fix) or a single
`UNION ALL` query (better fix).

#### `[M-4]` IDs derived from `Date.now()` and `Math.random()`
* `authController.signup`: `id = Date.now().toString()` — two concurrent
  signups in the same millisecond collide.
* `mockTestService.startMockTestAttempt`:
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}` — `substr` is
  deprecated; entropy is low.

Replace with `crypto.randomUUID()` (built-in on Node ≥ 14.17).

#### `[M-5]` No request-level validation
Every controller hand-rolls `if (!field)` checks and silently coerces with
`Number(...)`, `String(...)`. Adopt `zod` (preferred) or `joi` and define
a schema per route. This will eliminate a class of bugs and shrink the
controllers significantly.

#### `[M-6]` `errorHandler` is fine, but `authController.login` leaks raw error strings
```js
return res.status(401).json({
  message: "Invalid Firebase token",
  error: err.message,           // ← leaks Firebase-internal errors
});
```
Drop the `error` field from public responses on the auth path.

#### `[M-7]` Test naming and coverage gaps
* `tests/controllers/progressController.test.js` actually tests
  `authController.dashboard`. Rename to
  `dashboardController.test.js` (or rename the controller and the test
  together, splitting `dashboard` out of `authController`).
* No tests for `forumController`, `forumService`, `mockTestService`,
  `notificationService`, `questionService`, or
  `questionController.listSections`.
* No integration tests — every test uses `jest.mock(...)` for the service
  layer. Consider adding a thin Supertest layer around the routes against
  in-memory mocks.
* `package.json` has no `coverage` script and no `jest.config.js`.

### 3.4 Low — Nits

* `authMiddleware`: `authHeader.split(" ")[1]` accepts
  `"Bearer  token"` (two spaces) oddly. Replace with
  `/^Bearer\s+(.+)$/i`.
* `userService.findByEmail` does `SELECT *` — name the columns to keep the
  contract stable.
* `dashboard` defaults `weakestModule` to `"Speaking"` when all averages
  are zero, biasing new users toward "improve speaking" advice.
* `scoreProgress` keys like `"Jan 5"` collide across years. Add the
  year if responses can span more than 12 months.
* `forumController` builds avatars via an external `dicebear.com` URL —
  document or cache.
* `listMockTestAttempts` accepts an unvalidated `status` query param —
  whitelist `['pending', 'completed']`.
* Repository hygiene: the four loose scripts at the repo root
  (`insertQuestions.js`, `seed_missing.js`, `seed_missing_v2.js`,
  `create_attempts_table.js`) overlap with `scripts/`. Move them under
  `scripts/` and expose via `npm run seed:*`.
* `pte_questions_full_english.json` (~78 KB) and `data/questions.json`
  (~860 KB) are committed and ship to Render. If they are seed-only,
  gitignore them and load from object storage.
* `console.log` everywhere — adopt `pino` once the higher-priority items
  ship.

---

## 4. Notes on the New Test Suite (`62cbfc9`)

The integration of Jest is a real step forward. A few observations:

**What is good**
* Controller tests are isolated with `jest.mock(...)` against the service
  layer — fast, deterministic.
* Coverage spans the most-changed surfaces: dashboard, mock test, auth,
  notification, question.
* Edge cases are exercised: missing `firebaseToken`, invalid token,
  user-not-found, score regression clamped to zero, Personal Introduction
  always 90, etc.
* `normalizeQuery` is exhaustively asserted across the four PTE modules.

**What can be tightened**
* The naming mismatch in `[M-7]` is confusing.
* Several tests **encode** existing flaws (`[CR-2]`, `[CR-4]`) as expected
  behaviour. After fixing those flaws, update the tests to assert the new
  contract (403 for non-admins on cron-trigger; server-computed scores).
* No test for `forumController.toggleLike` race window or
  `notificationService.registerToken` cross-user collision — these are the
  trickiest correctness bugs and the most worth covering.
* Add `jest --coverage` and a `coverageThreshold` in `jest.config.js` so
  regressions are visible in CI.

---

## 5. Suggested Remediation Plan

| Priority | Items | Suggested PR scope |
|----------|-------|--------------------|
| **P0 — security, ship today** | `[CR-1]`, `[CR-2]`, `[CR-3]`, `[CR-4]`, `[H-4]` | One PR titled "harden auth + push paths". |
| **P1 — correctness, this week** | `[H-1]`, `[H-2]`, `[H-3]`, `[H-6]` | One PR per feature area. |
| **P2 — design, next sprint** | `[H-5]`, `[M-1]`–`[M-5]` | Refactor sweep + canonical-order unification. |
| **P3 — polish, backlog** | `[M-6]`, `[M-7]`, all "Low" items | Ongoing. |

---

## 6. Closing

The product surface is impressive for the size of the team. The foundations
(layering, env handling, health-checks, Render config, the new test suite)
are in place. The path to a production-grade backend is short: fix the four
critical security findings first, then the six correctness findings, then
the maintainability sweep. After that, the codebase will be in good shape to
support the next set of features.

Reach out if you would like any of the P0 items merged in a single follow-up
PR — they are small, isolated, and high-value.
