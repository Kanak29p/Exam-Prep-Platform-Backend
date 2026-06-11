# Senior Backend Architect — Code Review

**Repository:** `Exam-Prep-Platform-Backend`
**Tech Stack:** Node.js (≥20), Express 5, Snowflake (`snowflake-sdk`), Firebase Admin (Auth + FCM), `jsonwebtoken`, `multer`, Jest, Render (deploy)
**Branch reviewed:** `main` @ `dc20c24`
**Reviewer:** Senior Backend Architect
**Date:** 2026-06-08

---

## Executive Summary

- **Overall Score:** **6.0 / 10**
- **Production Readiness:** **4.0 / 10**

The service has a clean controller / service / route layout, sensible
environment loading, a health-check endpoint, a Render deployment manifest,
and a Jest suite that has just been integrated. The bones are solid.

The blockers are concentrated in three areas:

1. **Authentication paths** — a dev-only Firebase stub silently degrades to
   "decode without verifying" if credentials are missing, and the signup
   path does not bind the e-mail to a verified Firebase identity.
2. **Trust boundaries** — mock-test submission accepts client-supplied
   scores; one notification endpoint can broadcast to every device without
   an admin check.
3. **Operational hardening** — no rate limiting, no `helmet`, fully open
   CORS, hard-coded `localhost` URL in production push payloads, no
   structured logging, no integration tests.

None of these are large changes individually. With ~1.5 days of focused
work the production-readiness score moves from 4 → 8.

---

## Critical Issues

### `[CR-1]` Firebase Admin "dev stub" allows authentication bypass — **Critical**
**File:** `src/config/firebaseAdmin.js` lines 61–96

**Impact.** When `serviceAccountKey.json` is absent **and** the three sets of
env vars are unset, the module exports a stub whose `verifyIdToken` calls
`jwt.decode()` with no signature verification. The server boots with a
warning. In that state, an attacker can mint a token claiming any e-mail and
`authController.login` will issue a 7-day backend JWT for that user. A
credential mis-configuration on Render (the most common production
mistake) silently flips the system into an unauthenticated state.

**Fix.** Refuse to start when Firebase is not initialised in production.

```js
if (!isInitialized) {
  if (process.env.NODE_ENV === "production") {
    console.error("Firebase Admin not initialized in production. Aborting.");
    process.exit(1);
  }
  // existing dev-only stub below
}
```

### `[CR-2]` `simulateCronTrigger` lets any logged-in user spam every device — **Critical**
**Files:** `src/controllers/notificationController.js` lines 35–70, `src/routes/notificationRoutes.js` line 9

**Impact.** Route is protected by `verifyToken` only — no role check. Handler
internally calls `notificationService.sendNotificationToAll`. Any student
account can broadcast to every active FCM token. The Jest test
`tests/controllers/notificationController.test.js` even encodes this as
expected behaviour.

**Fix.** Add the admin guard already used in `sendBroadcastNotification`,
and update the test to assert a 403 path for non-admins.

```js
async function simulateCronTrigger(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  // existing body
}
```

### `[CR-3]` `signup` does not verify ownership of the e-mail address — **Critical**
**File:** `src/controllers/authController.js` lines 318–344

**Impact.** `POST /api/auth/signup` accepts `name` and `email` straight from
the request body and inserts a row. No Firebase token. An attacker can plant
a row for any e-mail (`victim@gmail.com`) before the legitimate user signs
up. When the legitimate user later authenticates via Firebase,
`findByEmail` returns the planted row.

**Fix.** Require a Firebase ID token. Verify it. Use the verified
`decodedToken.email` (and ideally `decodedToken.uid` as the primary key).

```js
async function signup(req, res, next) {
  try {
    const { firebaseToken, name } = req.body;
    if (!firebaseToken || !name) {
      return res.status(400).json({ message: "firebaseToken and name are required" });
    }
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const email = decoded.email;
    const id = decoded.uid;            // stable, unique
    const existing = await userService.findByEmail(email);
    if (existing) {
      return res.status(200).json({ message: "User already exists", isNewUser: false });
    }
    const user = await userService.createStudent({ id, name, email });
    return res.status(201).json({ isNewUser: true, user });
  } catch (err) { next(err); }
}
```

### `[CR-4]` Client-supplied scores are written verbatim — **Critical**
**Files:** `src/controllers/mockTestController.js` lines 73–97, `src/services/mockTestService.js` lines 201–225

**Impact.** `submitMockTestAttempt` reads `overallScore`, `speakingScore`,
`writingScore`, `readingScore`, `listeningScore` directly from the request
body and writes them to `MOCK_TEST_ATTEMPTS`. Anybody can grade themselves.
The test suite encodes this as the contract:

```js
expect(mockTestService.submitMockTestAttempt).toHaveBeenCalledWith(
  "attempt-1", "u1",
  expect.objectContaining({ overallScore: 70 }) // 70 came from req.body
);
```

**Fix.** Compute scores server-side from `grades` (the per-question results)
and ignore the body-supplied score fields. Pseudocode:

```js
function computeScores(gradesByQuestionId, questionsById) {
  const buckets = { Speaking: [], Writing: [], Reading: [], Listening: [] };
  for (const [qid, score] of Object.entries(gradesByQuestionId)) {
    const cat = splitSpeakingWriting(questionsById[qid].CATEGORY,
                                     questionsById[qid].SUB_CATEGORY);
    if (buckets[cat]) buckets[cat].push(Number(score) || 0);
  }
  const avg = a => a.length ? Math.round(a.reduce((x,y)=>x+y,0)/a.length) : 0;
  const speaking  = avg(buckets.Speaking);
  const writing   = avg(buckets.Writing);
  const reading   = avg(buckets.Reading);
  const listening = avg(buckets.Listening);
  const all = [...buckets.Speaking, ...buckets.Writing, ...buckets.Reading, ...buckets.Listening];
  return { speaking, writing, reading, listening, overall: avg(all) };
}
```

---

## High Priority Improvements

### `[H-1]` Mock-test attempts have no state guard — **High**
**File:** `src/services/mockTestService.js`

**Impact.** A user can re-`POST .../submit` on an already completed attempt
and overwrite the recorded scores. They can also spawn unlimited
`pending` attempts for the same mock test.

**Fix.**
* `startMockTestAttempt`: if a pending attempt exists, return it instead of
  creating a new one.
* `updateAttemptProgress` and `submitMockTestAttempt`: add `AND STATUS = 'pending'`
  to the `WHERE` clause and return 409 if zero rows are affected.

```js
const sql = `
  UPDATE MOCK_TEST_ATTEMPTS
  SET STATUS='completed', GRADES=?, OVERALL_SCORE=?, ...
  WHERE ID = ? AND USER_ID = ? AND STATUS = 'pending'
`;
```

### `[H-2]` `forum.toggleLike` and `createReply` are non-atomic — **High**
**File:** `src/services/forumService.js`

**Impact.** Two concurrent likes from the same user can both observe "no
row", both INSERT, and both increment the post counter. The denormalised
`LIKES` and `REPLIES` columns drift from the actual row counts.

**Fix.** Either add a unique constraint on `(USER_ID, POST_ID)` and use
`MERGE`, or drop the denormalised counters and project from the truth at
read time.

```sql
MERGE INTO FORUM_LIKES t
USING (SELECT ? USER_ID, ? POST_ID) s
   ON t.USER_ID = s.USER_ID AND t.POST_ID = s.POST_ID
WHEN MATCHED     THEN DELETE
WHEN NOT MATCHED THEN INSERT (USER_ID, POST_ID) VALUES (s.USER_ID, s.POST_ID);
```

### `[H-3]` FCM token leaks across users on a shared device — **High**
**File:** `src/services/notificationService.js` lines 7–23

**Impact.** `registerToken` only de-duplicates within `(USER_ID, TOKEN)`. If
user A logs out and user B logs in on the same browser, the FCM token is
now registered for both. Notifications meant for A reach B.

**Fix.** Before insert, delete any prior rows that share the token.

```js
await query(`DELETE FROM ${TOKENS_TABLE} WHERE TOKEN = ? AND USER_ID <> ?`,
            [token, String(userId)]);
const rows = await query(`SELECT 1 FROM ${TOKENS_TABLE} WHERE USER_ID = ? AND TOKEN = ?`,
            [String(userId), token]);
if (rows.length === 0) {
  await query(`INSERT INTO ${TOKENS_TABLE} (USER_ID, TOKEN, DEVICE_TYPE) VALUES (?, ?, ?)`,
              [String(userId), token, deviceType]);
  if (typeof admin.messaging === "function") {
    await admin.messaging().subscribeToTopic([token], "all_users");
  }
}
```

### `[H-4]` Hard-coded `localhost` URL in production push payload — **High**
**File:** `src/services/notificationService.js` line 63

**Impact.** Every push notification — including those delivered to real
devices in production — carries
`click_action: "http://localhost:5173/dashboard"`.

**Fix.** Read `process.env.FRONTEND_URL` and combine with each message's
`data.url`.

```js
const frontend = process.env.FRONTEND_URL || "https://app.example.com";
const click = `${frontend}${(data && data.url) || "/dashboard"}`;
```

### `[H-5]` Two divergent `CANONICAL_ORDER` arrays — **High**
**Files:** `src/services/mockTestService.js` lines 4–33, `src/services/questionService.js` lines 17–47

**Impact.** Five sub-category strings differ between the two arrays.
Because `getCanonicalIndex` does case-insensitive but exact-on-trim
matching, a question whose pattern says `"Reorder Paragraphs"` resolves to
`-1` in `questionService` and corrupts ordering in `listSections`.
`normalizeQuery` introduces yet a third spelling for some entries.

**Fix.** Single source of truth in `src/utils/canonicalOrder.js`. Align with
the strings emitted by `normalizeQuery`. Add a unit test that asserts every
output of `normalizeQuery` resolves to a non-`-1` canonical index.

### `[H-6]` Open CORS, no rate limiting, no Helmet — **High**
**File:** `src/server.js` line 16

**Impact.** Combined with `[CR-2]` and `[H-3]`, the service is a free spam
vector for push notifications and forum content. No security headers.

**Fix.**
```js
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");

app.use(helmet());
app.use(cors({ origin: env.allowedOrigins, credentials: true }));
app.use("/api/auth",          rateLimit({ windowMs: 60_000, max: 30 }));
app.use("/api/notifications", rateLimit({ windowMs: 60_000, max: 10 }));
app.use("/api/forum",         rateLimit({ windowMs: 60_000, max: 60 }));
app.use(express.json({ limit: "256kb" })); // explicit body cap
```

---

## Performance Optimizations

### `[P-1]` N+1 against Snowflake in mock-test question fetch — **High**
`src/services/mockTestService.js` lines 68–122 fires one query per pattern
row in a sequential `for…of`. Snowflake round-trips are not cheap on the
free Render plan; a 20-row pattern adds ~1–2 seconds of avoidable latency.

```js
// Cheap fix
const results = await Promise.all(patterns.map(p => fetchForPattern(p)));
const allQuestions = results.flat();

// Better fix: single UNION ALL
const sql = patterns.map(() => `(
  SELECT ... FROM QUESTION_DETAILS q
  JOIN QUESTION_TYPE_CONFIG c ON q.QUESTION_TYPE_ID = c.ID
  WHERE LOWER(TRIM(c.CATEGORY)) = LOWER(TRIM(?))
    AND LOWER(TRIM(c.TYPE))     = LOWER(TRIM(?))
  ORDER BY RANDOM() LIMIT ?
)`).join(" UNION ALL ");
```

### `[P-2]` Snowflake connection is a singleton with no retry / keepalive — **Medium**
`src/db/snowflake.js` creates one connection at module load. There is no
heartbeat, no auto-reconnect, no statement-level retry. Snowflake regularly
recycles idle sessions.

**Fix.** Use `snowflake-sdk` connection pool (`createPool`) with
`keepAlive: true`, plus a small retry wrapper around `query()` for
`ECONN`-style errors.

```js
const pool = snowflake.createPool({ ...cfg, keepAlive: true }, { max: 10, min: 0 });
async function query(sqlText, binds = []) {
  return pool.use(conn => new Promise((resolve, reject) => {
    conn.execute({ sqlText, binds, complete: (err, _s, rows) =>
      err ? reject(err) : resolve(rows || []) });
  }));
}
```

### `[P-3]` `dashboard` does heavy in-process aggregation per request — **Medium**
`authController.dashboard` pulls every response and every attempt for a
user, then iterates them in JavaScript to compute time, score progress,
module performance, skill radar, and recommendations. As history grows this
gets expensive linearly.

**Fix.**
* Push aggregations to Snowflake (`SUM`, `AVG`, `GROUP BY DATE_TRUNC`).
* Cache the result for 60 seconds per user (in-memory LRU is fine for now,
  Redis later).
* Paginate the underlying `STUDENT_RESPONSES` query if the user has > 1000
  rows.

### `[P-4]` Redundant `subscribeToTopic` on every register call — **Low**
Move inside the `if (rows.length === 0)` branch (see `[H-3]`).

### `[P-5]` `forumService.getForumStats` runs 5 separate queries — **Medium**
Combine `COUNT(*)`, `SUM(REPLIES)`, `SUM(VIEWS)` into one
`SELECT COUNT(*) AS d, COALESCE(SUM(REPLIES),0) AS r, COALESCE(SUM(VIEWS),0) AS v FROM FORUM_POSTS`.

### `[P-6]` Missing indexes (Snowflake clustering keys) — **Medium**
Snowflake doesn't have B-tree indexes, but for tables where you filter by
`USER_ID` or `POST_ID` heavily — `STUDENT_RESPONSES`,
`MOCK_TEST_ATTEMPTS`, `FORUM_LIKES`, `USER_FCM_TOKENS` — set clustering
keys to keep micro-partitions selective:

```sql
ALTER TABLE STUDENT_RESPONSES CLUSTER BY (USER_ID, SUBMITTED_AT);
ALTER TABLE MOCK_TEST_ATTEMPTS CLUSTER BY (USER_ID, STATUS);
ALTER TABLE FORUM_LIKES        CLUSTER BY (POST_ID);
ALTER TABLE USER_FCM_TOKENS    CLUSTER BY (USER_ID);
```

---

## Security Findings

| ID | Severity | Issue | Section |
|----|----------|-------|---------|
| CR-1 | Critical | Firebase stub auth bypass | Authentication |
| CR-2 | Critical | Cron-trigger broadcast spam | Authorisation |
| CR-3 | Critical | Signup hijack via unverified e-mail | Authentication |
| CR-4 | Critical | Client-trusted mock-test scores | Authorisation / Data integrity |
| H-3  | High     | FCM token cross-user leak | Authorisation |
| H-4  | High     | Hard-coded localhost in push | Sensitive data exposure (URL leak) |
| H-6  | High     | Open CORS / no rate limit / no helmet | Hardening |
| S-1  | High     | Auth error string leakage | Information disclosure |
| S-2  | Medium   | No request body validation | Input validation |
| S-3  | Medium   | No CSRF protection on state-changing endpoints | CSRF |
| S-4  | Medium   | `errorHandler` falls back to `err.message` outside production | Information disclosure |
| S-5  | Low      | Auth header parsed with `split(" ")[1]` | Robustness |
| S-6  | Low      | `console.log` of FCM tokens | PII / token leak in logs |

#### `[S-1]` Auth path leaks raw error strings — **High**
`authController.login` returns `{ error: err.message }` from
`verifyIdToken` failures, exposing Firebase internals to the client.

```js
return res.status(401).json({ message: "Invalid Firebase token" }); // drop `error`
```

#### `[S-2]` No request body validation — **Medium**
Every controller hand-rolls `if (!field)` checks and silently coerces with
`Number(...)` / `String(...)`. Adopt **`zod`** (preferred) or `joi`:

```js
const { z } = require("zod");
const submitSchema = z.object({
  questionId: z.union([z.string(), z.number()]),
  audioUrl:   z.string().url().optional(),
  answerText: z.string().max(20_000).optional(),
});
function validate(schema) {
  return (req, res, next) => {
    const r = schema.safeParse(req.body);
    if (!r.success) return res.status(400).json({ message: "Invalid input", issues: r.error.issues });
    req.body = r.data; next();
  };
}
router.post("/submit", verifyToken, validate(submitSchema), ctrl.submitAnswer);
```

#### `[S-3]` No CSRF protection — **Medium**
The service is JWT-based and presumably called from a SPA, so CSRF is only
relevant if you ever serve the API on the same origin as the SPA via
cookies. Document the threat model in the README; if cookies are introduced
later, add `csurf` or use `SameSite=strict`.

#### `[S-4]` `errorHandler` exposes `err.message` outside production — **Medium**
```js
error: process.env.NODE_ENV === "production" ? undefined : err.message
```
This is fine for local development, but `dev` and `staging` typically don't
set `NODE_ENV=production`. Consider gating on a separate
`EXPOSE_ERRORS` flag, defaulting to `false`.

#### SQL Injection: **Pass**
All Snowflake queries use parameterised binds (`?`). No string
concatenation of user input was found.

#### XSS: **N/A (API only)**
The service returns JSON; XSS responsibility lies on the SPA. The forum
content is stored as-is, so the frontend must escape on render — call this
out in the README.

#### Secrets management: **Pass with note**
`.env`, `*.secrets.local`, and `serviceAccountKey.json` are all gitignored.
`render.yaml` uses `sync: false` for sensitive vars. Good. Add a one-line
note in the README pointing future operators to the three Firebase init
options described in `firebaseAdmin.js`.

---

## Refactoring Suggestions

### `[R-1]` Extract `splitSpeakingWriting` helper
Same conditional appears in `authController.dashboard` (twice),
`questionService.findById`, `questionService.listSections`, and
`mockTestService.getQuestionsForMockTest`.

```js
// src/utils/category.js
function splitSpeakingWriting(category, subCategory) {
  if ((category || "").trim().toLowerCase() !== "speaking & writing") return category;
  const s = (subCategory || "").toLowerCase();
  return s.includes("summarize written") || s.includes("essay") ? "Writing" : "Speaking";
}
module.exports = { splitSpeakingWriting };
```

### `[R-2]` Extract `formatTimeAgo`
Identical 15-line block lives in `forumController.listPosts` and
`listReplies`. Move to `src/utils/time.js`.

### `[R-3]` Collapse `cleanText` and `cleanTextSimple`
Same body in `questionController.js`. Delete the unused `splitAnswers`
helper while you are there.

### `[R-4]` Replace `Date.now()`/`Math.random()` IDs with UUIDs
* `authController.signup`: `id = Date.now().toString()` collides under
  concurrent signups in the same millisecond.
* `mockTestService.startMockTestAttempt`: low-entropy attempt IDs and the
  deprecated `String.prototype.substr`.

```js
const { randomUUID } = require("node:crypto");
const id = randomUUID();
```

### `[R-5]` Split `dashboard` out of `authController`
The dashboard is 250+ lines of business logic that has nothing to do with
authentication. Move to `src/controllers/dashboardController.js` and
`src/services/dashboardService.js`. Bonus: it makes the
`tests/controllers/progressController.test.js` filename make sense.

### `[R-6]` Centralise table names
Table-name constants exist in `forumService.js`, `notificationService.js`,
`userService.js`, but `mockTestService.js` and `questionService.js` still
inline `PTE_EXAM_PREP_PLATFORM.PUBLIC.<TABLE>` everywhere. Pick one style.

### `[R-7]` Repository hygiene
* Move the four loose root scripts (`insertQuestions.js`, `seed_missing.js`,
  `seed_missing_v2.js`, `create_attempts_table.js`) into `scripts/` and
  expose them via `npm run seed:*`.
* Gitignore the two large JSON seed files
  (`pte_questions_full_english.json` ~78 KB, `data/questions.json` ~860 KB);
  load them from object storage during the import job.

### `[R-8]` Adopt structured logging
Replace `console.log` / `console.error` with `pino`:

```js
const pino = require("pino");
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
logger.info({ userId, token: "***" }, "FCM token registered");
```

### `[R-9]` Treat `dashboard` recommendations as data, not code
The huge `if (weakestModule === "Speaking") ... else if ...` block is a
look-up table in disguise. Pull into `src/data/recommendations.json` so
content can be edited without code changes.

### `[R-10]` Centralise `CANONICAL_ORDER` (paired with `[H-5]`)
Single export from `src/utils/canonicalOrder.js`, consumed by both services.

---

## Best Practices Checklist

| # | Area | Item | Status |
|---|------|------|--------|
| 1 | Architecture | Layered architecture (route → controller → service → db) | **Pass** |
| 2 | Architecture | Dependency injection / loose coupling | **Fail** (services imported by name; tests work around it with `jest.mock`) |
| 3 | Architecture | Single responsibility (controllers thin) | **Fail** (`authController.dashboard` is 250 lines of business logic) |
| 4 | Code quality | Consistent naming | **Pass** |
| 5 | Code quality | DRY (no duplication) | **Fail** ( `[R-1]`, `[R-2]`, `[R-3]`, `[H-5]`) |
| 6 | Code quality | No dead code | **Fail** (`splitAnswers`) |
| 7 | API design | RESTful resource paths | **Pass** |
| 8 | API design | Consistent response envelope | **Fail** (some return raw arrays, some `{message, ...}`) |
| 9 | API design | Correct HTTP status codes | **Pass** |
| 10 | API design | API versioning (`/api/v1/...`) | **Fail** |
| 11 | API design | Pagination on list endpoints | **Fail** (`/forum/posts`, `/students`, `/mock-tests/attempts`) |
| 12 | Performance | No N+1 queries | **Fail** (`[P-1]`) |
| 13 | Performance | Connection pooling | **Fail** (`[P-2]`) |
| 14 | Performance | Caching where appropriate | **Fail** (`[P-3]`) |
| 15 | Security | Auth on all state-changing routes | **Partial Pass** (✓ all routes use `verifyToken`, ✗ admin checks missing on `[CR-2]`) |
| 16 | Security | Parameterised SQL | **Pass** |
| 17 | Security | Rate limiting | **Fail** |
| 18 | Security | Input validation | **Fail** (`[S-2]`) |
| 19 | Security | Secrets management | **Pass** |
| 20 | Security | Production-safe error handler | **Partial** (`[S-1]`, `[S-4]`) |
| 21 | Security | Security headers (`helmet`) | **Fail** |
| 22 | Security | CORS allowlist | **Fail** |
| 23 | Database | Parameterised queries | **Pass** |
| 24 | Database | Transactions on multi-write paths | **Fail** (`[H-2]`) |
| 25 | Database | Clustering keys / indexes | **Fail** (`[P-6]`) |
| 26 | Error handling | Central `errorHandler` | **Pass** |
| 27 | Error handling | Structured logging | **Fail** (`[R-8]`) |
| 28 | Error handling | No raw error leakage | **Fail** (`[S-1]`) |
| 29 | Concurrency | Idempotent state transitions | **Fail** (`[H-1]`) |
| 30 | Concurrency | Race-safe counter updates | **Fail** (`[H-2]`) |
| 31 | Testing | Unit tests for controllers | **Pass** |
| 32 | Testing | Service-layer tests | **Partial** (only `userService` covered) |
| 33 | Testing | Integration tests (Supertest) | **Fail** |
| 34 | Testing | Coverage threshold enforced | **Fail** (no `jest.config.js`) |
| 35 | Production | Health-check endpoint | **Pass** |
| 36 | Production | Environment-driven config | **Pass** |
| 37 | Production | Graceful shutdown (SIGTERM) | **Fail** |
| 38 | Production | Containerisation (`Dockerfile`) | **Fail** |
| 39 | Production | Observability (metrics / tracing) | **Fail** |
| 40 | Production | CI pipeline (lint + test on PR) | **Unknown** (no `.github/workflows/` reviewed) |

**Score: 13 / 40 Pass, 4 Partial, 22 Fail, 1 Unknown.**

---

## Final Recommendation

> **Request Major Changes.**

The codebase is genuinely close to production quality, but the four
**Critical** findings (`[CR-1]`–`[CR-4]`) are blockers — any of them is
enough to compromise user data or trust. None of them is a large change;
together they fit comfortably in a single ~150-line PR.

Suggested merge sequence:

1. **PR #1 — "harden auth & push paths" (P0):** `[CR-1]`, `[CR-2]`,
   `[CR-3]`, `[CR-4]`, `[H-4]`, `[S-1]`. Update tests to assert the new
   admin / server-scored contracts.
2. **PR #2 — "state guards & race fixes" (P1):** `[H-1]`, `[H-2]`, `[H-3]`.
   Add unit tests for the new `STATUS = 'pending'` guard and the
   cross-user FCM token cleanup.
3. **PR #3 — "platform hardening" (P1):** `[H-6]`, `[S-2]`, `[R-8]` —
   helmet, CORS allowlist, rate limit, `zod` validation, structured
   logging.
4. **PR #4 — "refactor sweep" (P2):** `[H-5]`, `[R-1]`–`[R-7]`,
   `[P-1]`, `[P-3]`, `[P-5]`. Coverage threshold enforced in
   `jest.config.js`. Add Supertest integration tests for the auth +
   mock-test flow.
5. **PR #5 — "ops" (P3):** `Dockerfile`, GitHub Actions CI, OpenTelemetry,
   graceful shutdown, API versioning prefix `/api/v1/...`.

After PR #1 and #2 land, the production-readiness score moves from
**4 → 7**. After PR #3 and #4, **7 → 8.5**. After PR #5, **9 / 10**.

Happy to take PR #1 immediately — it is contained, well-scoped, and
unblocks everything else.
