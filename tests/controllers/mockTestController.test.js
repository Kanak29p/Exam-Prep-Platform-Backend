jest.mock("../../src/services/mockTestService", () => ({
  listMockTests: jest.fn(),
  getMockTestById: jest.fn(),
  getQuestionsForMockTest: jest.fn(),
  startMockTestAttempt: jest.fn(),
  listMockTestAttempts: jest.fn(),
  updateAttemptProgress: jest.fn(),
  submitMockTestAttempt: jest.fn(),
  getAttemptById: jest.fn(),
}));

const mockTestService = require("../../src/services/mockTestService");
const {
  listMockTests,
  getMockTestById,
  getQuestionsForMockTest,
  startMockTestAttempt,
  listMockTestAttempts,
  updateAttemptProgress,
  submitMockTestAttempt,
} = require("../../src/controllers/mockTestController");

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// =====================================================================
// listMockTests
// =====================================================================
describe("mockTestController.listMockTests", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = {};
    res = makeRes();
    next = jest.fn();
  });

  test("returns list of active mock tests", async () => {
    const mockTests = [{ ID: 1, TITLE: "Full Mock 1", STATUS: "active" }];
    mockTestService.listMockTests.mockResolvedValueOnce(mockTests);
    await listMockTests(req, res, next);
    expect(res.json).toHaveBeenCalledWith(mockTests);
  });

  test("calls next(err) on service failure", async () => {
    mockTestService.listMockTests.mockRejectedValueOnce(new Error("DB error"));
    await listMockTests(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// getMockTestById
// =====================================================================
describe("mockTestController.getMockTestById", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("404 – mock test not found", async () => {
    req.params.id = "999";
    mockTestService.getMockTestById.mockResolvedValueOnce(null);
    await getMockTestById(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Mock test not found" });
  });

  test("200 – returns mock test", async () => {
    req.params.id = "1";
    mockTestService.getMockTestById.mockResolvedValueOnce({ ID: 1, TITLE: "Full Mock 1" });
    await getMockTestById(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ ID: 1, TITLE: "Full Mock 1" });
  });
});

// =====================================================================
// startMockTestAttempt
// =====================================================================
describe("mockTestController.startMockTestAttempt", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, params: { id: "1" } };
    res = makeRes();
    next = jest.fn();
  });

  test("201 – starts attempt and returns questions", async () => {
    const data = { id: "attempt-123", questions: [{ ID: 1 }, { ID: 2 }] };
    mockTestService.startMockTestAttempt.mockResolvedValueOnce(data);
    await startMockTestAttempt(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(data);
  });

  test("forwards error when mock test not found", async () => {
    mockTestService.startMockTestAttempt.mockRejectedValueOnce(new Error("Mock test not found"));
    await startMockTestAttempt(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Mock test not found" });
    expect(next).not.toHaveBeenCalled();
  });

  test("forwards error when no questions configured", async () => {
    mockTestService.startMockTestAttempt.mockRejectedValueOnce(
      new Error("No questions configured for this mock test")
    );
    await startMockTestAttempt(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No questions configured for this mock test" });
    expect(next).not.toHaveBeenCalled();
  });
});

// =====================================================================
// updateAttemptProgress
// =====================================================================
describe("mockTestController.updateAttemptProgress", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: "u1" },
      params: { id: "attempt-1" },
      body: { currentQuestionIndex: 3, timeRemaining: 3600, grades: { "1": 80 } },
    };
    res = makeRes();
    next = jest.fn();
  });

  test("404 – attempt not found", async () => {
    mockTestService.getAttemptById.mockResolvedValueOnce(null);
    await updateAttemptProgress(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Mock test attempt not found" });
  });

  test("400 – attempt already completed", async () => {
    mockTestService.getAttemptById.mockResolvedValueOnce({ ID: "attempt-1", STATUS: "completed" });
    await updateAttemptProgress(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Cannot update progress of a completed mock test attempt" });
  });

  test("saves progress and returns success message", async () => {
    mockTestService.getAttemptById.mockResolvedValueOnce({ ID: "attempt-1", STATUS: "pending" });
    mockTestService.updateAttemptProgress.mockResolvedValueOnce({});
    await updateAttemptProgress(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ message: "Progress saved successfully" });
  });

  test("calls next(err) on service failure", async () => {
    mockTestService.getAttemptById.mockRejectedValueOnce(new Error("fail"));
    await updateAttemptProgress(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// submitMockTestAttempt – score calculation & result save
// =====================================================================
describe("mockTestController.submitMockTestAttempt", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      user: { id: "u1" },
      params: { id: "attempt-1" },
      body: {
        grades: { "1": 80, "2": 60 },
        overallScore: 70,
        speakingScore: 75,
        writingScore: 65,
        readingScore: 70,
        listeningScore: 70,
      },
    };
    res = makeRes();
    next = jest.fn();
  });

  test("404 – attempt not found", async () => {
    mockTestService.getAttemptById.mockResolvedValueOnce(null);
    await submitMockTestAttempt(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Mock test attempt not found" });
  });

  test("400 – duplicate submission (already completed)", async () => {
    mockTestService.getAttemptById.mockResolvedValueOnce({ ID: "attempt-1", STATUS: "completed" });
    await submitMockTestAttempt(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "This mock test attempt has already been submitted" });
  });

  test("submits and returns success message", async () => {
    mockTestService.getAttemptById.mockResolvedValueOnce({ ID: "attempt-1", STATUS: "pending" });
    mockTestService.submitMockTestAttempt.mockResolvedValueOnce({});
    await submitMockTestAttempt(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ message: "Mock test attempt submitted successfully" });
    expect(mockTestService.submitMockTestAttempt).toHaveBeenCalledWith(
      "attempt-1",
      "u1",
      expect.objectContaining({ overallScore: 70 })
    );
  });

  test("submits without answering – defaults scores to 10", async () => {
    req.body = {}; // empty submission
    mockTestService.getAttemptById.mockResolvedValueOnce({ ID: "attempt-1", STATUS: "pending" });
    mockTestService.submitMockTestAttempt.mockResolvedValueOnce({});
    await submitMockTestAttempt(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ message: "Mock test attempt submitted successfully" });
    expect(mockTestService.submitMockTestAttempt).toHaveBeenCalledWith(
      "attempt-1",
      "u1",
      expect.objectContaining({
        grades: {},
        overallScore: 10,
        speakingScore: 10,
        writingScore: 10,
        readingScore: 10,
        listeningScore: 10,
      })
    );
  });

  test("calls next(err) on service failure", async () => {
    mockTestService.getAttemptById.mockRejectedValueOnce(new Error("DB error"));
    await submitMockTestAttempt(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// listMockTestAttempts – retrieve results
// =====================================================================
describe("mockTestController.listMockTestAttempts", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, query: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("returns all attempts for a user", async () => {
    const attempts = [{ ID: "a1", STATUS: "completed", OVERALL_SCORE: 70 }];
    mockTestService.listMockTestAttempts.mockResolvedValueOnce(attempts);
    await listMockTestAttempts(req, res, next);
    expect(res.json).toHaveBeenCalledWith(attempts);
  });

  test("filters by status when provided in query", async () => {
    req.query.status = "completed";
    mockTestService.listMockTestAttempts.mockResolvedValueOnce([]);
    await listMockTestAttempts(req, res, next);
    expect(mockTestService.listMockTestAttempts).toHaveBeenCalledWith("u1", "completed");
  });

  test("returns empty array when no attempts found", async () => {
    mockTestService.listMockTestAttempts.mockResolvedValueOnce([]);
    await listMockTestAttempts(req, res, next);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});
