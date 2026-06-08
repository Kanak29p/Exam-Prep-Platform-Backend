// Tests for authController.dashboard – progress API data computation
jest.mock("../../src/config/env", () => ({ jwtSecret: "test-secret" }));
jest.mock("../../src/config/firebaseAdmin", () => ({ auth: () => ({ verifyIdToken: jest.fn() }) }));
jest.mock("../../src/services/userService", () => ({
  findByEmail: jest.fn(),
  createStudent: jest.fn(),
  updateProfile: jest.fn(),
}));

const snowflakeMock = { query: jest.fn() };
jest.mock("../../src/db/snowflake", () => snowflakeMock);

const { dashboard } = require("../../src/controllers/authController");

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("authController.dashboard – progress API", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" } };
    res = makeRes();
    next = jest.fn();
  });

  // helper: mock query for user + responses + attempts
  function mockQueries({ userRow = {}, responses = [], attempts = [] } = {}) {
    snowflakeMock.query
      .mockResolvedValueOnce([userRow])   // user profile query
      .mockResolvedValueOnce(responses)   // responses query
      .mockResolvedValueOnce(attempts);   // attempts query
  }

  test("fetch progress – empty state returns 0s and starter recommendations", async () => {
    mockQueries({ userRow: { TARGET_SCORE: 79, PLAN: "Free", SCORE: 0 } });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    expect(data.overallScore).toBe(0);
    expect(data.mockTestsCompleted).toBe(0);
    expect(data.practiceTime).toBe("0m");
    expect(data.recommendations.length).toBeGreaterThan(0);
  });

  test("update progress – calculates overallScore as average of all responses", async () => {
    mockQueries({
      userRow: { TARGET_SCORE: 79, PLAN: "Pro", SCORE: 50 },
      responses: [
        { SCORE: 60, SUBMITTED_AT: "2025-01-01T10:00:00Z", CATEGORY: "Speaking", SUB_CATEGORY: "Read Aloud" },
        { SCORE: 80, SUBMITTED_AT: "2025-01-02T10:00:00Z", CATEGORY: "Reading", SUB_CATEGORY: "MCQ Single" },
        { SCORE: 70, SUBMITTED_AT: "2025-01-03T10:00:00Z", CATEGORY: "Listening", SUB_CATEGORY: "Dictation" },
      ],
    });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    expect(data.overallScore).toBe(70); // (60+80+70)/3
  });

  test("points improved = latest – earliest score (minimum 0)", async () => {
    mockQueries({
      userRow: {},
      responses: [
        { SCORE: 40, SUBMITTED_AT: "2025-01-01T10:00:00Z", CATEGORY: "Speaking", SUB_CATEGORY: "x" },
        { SCORE: 70, SUBMITTED_AT: "2025-01-10T10:00:00Z", CATEGORY: "Speaking", SUB_CATEGORY: "x" },
      ],
    });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    expect(data.pointsImproved).toBe(30); // 70 - 40
  });

  test("points improved is 0 when score regressed", async () => {
    mockQueries({
      userRow: {},
      responses: [
        { SCORE: 80, SUBMITTED_AT: "2025-01-01T10:00:00Z", CATEGORY: "Speaking", SUB_CATEGORY: "x" },
        { SCORE: 50, SUBMITTED_AT: "2025-01-10T10:00:00Z", CATEGORY: "Speaking", SUB_CATEGORY: "x" },
      ],
    });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    expect(data.pointsImproved).toBe(0); // clamped to 0
  });

  test("mock tests completed counts only 'completed' status", async () => {
    mockQueries({
      userRow: {},
      attempts: [
        { STATUS: "completed", TIME_REMAINING: 0, TOTAL_DURATION_MINUTES: 120 },
        { STATUS: "pending", TIME_REMAINING: 3000, TOTAL_DURATION_MINUTES: 120 },
        { STATUS: "completed", TIME_REMAINING: 0, TOTAL_DURATION_MINUTES: 120 },
      ],
    });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    expect(data.mockTestsCompleted).toBe(2);
  });

  test("practice time reported in hours for long sessions", async () => {
    const manyResponses = Array.from({ length: 50 }, () => ({
      SCORE: 75, SUBMITTED_AT: "2025-01-01T10:00:00Z", CATEGORY: "Writing", SUB_CATEGORY: "Write Essay",
    }));
    mockQueries({ userRow: {}, responses: manyResponses });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    // 50 writing responses × 600s each = 30000s = 500m = 8.3h
    expect(data.practiceTime).toMatch(/h$/);
  });

  test("returns module performance array with 4 modules", async () => {
    mockQueries({ userRow: {} });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    expect(data.modulePerformance).toHaveLength(4);
    const mods = data.modulePerformance.map(m => m.module);
    expect(mods).toContain("Speaking");
    expect(mods).toContain("Writing");
    expect(mods).toContain("Reading");
    expect(mods).toContain("Listening");
  });

  test("skill radar has 6 entries", async () => {
    mockQueries({ userRow: {} });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    expect(data.skillRadar).toHaveLength(6);
  });

  test("score progress grouped by date correctly", async () => {
    mockQueries({
      userRow: {},
      responses: [
        { SCORE: 60, SUBMITTED_AT: "2025-01-05T10:00:00Z", CATEGORY: "Reading", SUB_CATEGORY: "" },
        { SCORE: 80, SUBMITTED_AT: "2025-01-05T15:00:00Z", CATEGORY: "Reading", SUB_CATEGORY: "" },
        { SCORE: 70, SUBMITTED_AT: "2025-01-10T10:00:00Z", CATEGORY: "Reading", SUB_CATEGORY: "" },
      ],
    });
    await dashboard(req, res, next);
    const data = res.json.mock.calls[0][0];
    // Two unique dates
    expect(data.scoreProgress).toHaveLength(2);
    const jan5 = data.scoreProgress.find(p => p.date === "Jan 5");
    expect(jan5).toBeDefined();
    expect(jan5.score).toBe(70); // average of 60+80
  });

  test("401 if user id is missing", async () => {
    req.user = {};
    await dashboard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("calls next(err) on DB failure", async () => {
    snowflakeMock.query.mockRejectedValueOnce(new Error("Snowflake down"));
    await dashboard(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
