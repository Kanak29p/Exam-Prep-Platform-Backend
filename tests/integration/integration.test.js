jest.mock("../../src/config/env", () => ({
  jwtSecret: "integration-test-secret",
  snowflake: {
    account: "mock-acc",
    username: "mock-user",
    password: "mock-pass",
    warehouse: "mock-wh",
    database: "mock-db",
    schema: "mock-schema",
  },
}));

jest.mock("../../src/config/firebaseAdmin", () => {
  const mockVerifyIdToken = jest.fn();
  return {
    auth: () => ({
      verifyIdToken: mockVerifyIdToken,
    }),
  };
});

const mockVerifyIdToken = require("../../src/config/firebaseAdmin").auth().verifyIdToken;

const mockSnowflake = { query: jest.fn() };
jest.mock("../../src/db/snowflake", () => mockSnowflake);

const jwt = require("jsonwebtoken");
const authCtrl = require("../../src/controllers/authController");
const questionCtrl = require("../../src/controllers/questionController");
const mockTestCtrl = require("../../src/controllers/mockTestController");

// Helper to construct a mock request and response
function mockRequestResponse(reqOptions = {}) {
  const req = {
    body: {},
    query: {},
    params: {},
    user: null,
    headers: {},
    ...reqOptions,
  };
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  const next = jest.fn();
  return { req, res, next };
}

describe("Backend Integration Test Suite", () => {
  let token = "";
  let userId = "u_12345";
  let questionId = 101;
  let attemptId = "attempt_999";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================================================
  // 1. User Registration & Login Flow
  // =====================================================================
  describe("Flow 1: User Auth Integration", () => {
    test("User Signup – successful registration", async () => {
      const { req, res, next } = mockRequestResponse({
        body: { name: "Alice E2E", email: "alice@integration.com" },
      });

      // Mock DB: user doesn't exist yet, insert succeeds
      mockSnowflake.query
        .mockResolvedValueOnce([]) // findByEmail query returns empty
        .mockResolvedValueOnce([]); // insertStudent query succeeds

      await authCtrl.signup(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User created successfully",
          isNewUser: true,
          user: expect.objectContaining({ email: "alice@integration.com" }),
        })
      );
    });

    test("User Login – successful token generation", async () => {
      const firebaseToken = "firebase-token-alice";
      const { req, res, next } = mockRequestResponse({
        body: { firebaseToken },
      });

      // Stub Firebase token verification
      mockVerifyIdToken.mockResolvedValueOnce({ email: "alice@integration.com" });

      // Stub Snowflake returning user details
      mockSnowflake.query.mockResolvedValueOnce([
        {
          ID: userId,
          NAME: "Alice E2E",
          EMAIL: "alice@integration.com",
          ROLE: "student",
          PLAN: "Pro",
          TARGET_SCORE: 79,
        },
      ]);

      await authCtrl.login(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Login successful",
          token: expect.any(String),
          user: expect.objectContaining({ id: userId }),
        })
      );

      // Save token for subsequent tests
      const responseBody = res.json.mock.calls[0][0];
      token = responseBody.token;
    });

    test("Access Dashboard – fetch statistics & progress state", async () => {
      // Decode JWT to simulate authMiddleware attachment of req.user
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
      });

      // Mock Snowflake queries inside Dashboard:
      // Query 1: UserDetails
      // Query 2: STUDENT_RESPONSES join with category config
      // Query 3: MOCK_TEST_ATTEMPTS join with mock test total duration
      mockSnowflake.query
        .mockResolvedValueOnce([{ TARGET_SCORE: 79, PLAN: "Pro", SCORE: 70 }])
        .mockResolvedValueOnce([
          { SCORE: 65, SUBMITTED_AT: "2026-06-01T10:00:00Z", CATEGORY: "Reading", SUB_CATEGORY: "MCQ Single" },
          { SCORE: 75, SUBMITTED_AT: "2026-06-02T10:00:00Z", CATEGORY: "Listening", SUB_CATEGORY: "Dictation" },
        ])
        .mockResolvedValueOnce([
          { STATUS: "completed", TIME_REMAINING: 0, TOTAL_DURATION_MINUTES: 120 },
        ]);

      await authCtrl.dashboard(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          overallScore: 70, // (65 + 75) / 2
          mockTestsCompleted: 1,
          targetScore: 79,
        })
      );
    });
  });

  // =====================================================================
  // 2. Question Creation & Answer Submission Flow
  // =====================================================================
  describe("Flow 2: Question Management Integration", () => {
    test("Create Question – validation & database insert", async () => {
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
        body: {
          questionTypeId: 2,
          questionText: "Which planet is known as the Red Planet?",
          instruction: "Choose the correct option.",
          title: "General Knowledge - Mars",
          correctAnswer: "Mars",
          category: "Speaking",
          difficulty: "Medium",
        },
      });

      // Mock Snowflake queries inside createQuestion:
      // Query 1: COALESCE(MAX(ID), 0) + 1 to find next ID
      // Query 2: INSERT query
      mockSnowflake.query
        .mockResolvedValueOnce([{ NEXT_ID: questionId }])
        .mockResolvedValueOnce([]);

      await questionCtrl.createQuestion(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Question created successfully",
          question: expect.objectContaining({ ID: questionId }),
        })
      );
    });

    test("Submit Answer & Evaluate Speech / Reading / Listening score", async () => {
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
        body: {
          questionId: questionId,
          answerText: "Mars",
        },
      });

      // Mock findById query for Mars question (MCQ Single type)
      mockSnowflake.query
        .mockResolvedValueOnce([
          {
            ID: questionId,
            CATEGORY: "Reading",
            SUB_CATEGORY: "MCQ Single Answer",
            QUESTION_TEXT: "Which planet is known as the Red Planet?",
            CORRECT_ANSWER: "Mars",
          },
        ])
        .mockResolvedValueOnce([]); // insert answer query succeeds

      await questionCtrl.submitAnswer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Answer submitted successfully",
          score: 90, // Correct answer matched perfectly
          accuracy: 100,
        })
      );
    });

    test("Update Question details", async () => {
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
        params: { id: String(questionId) },
        body: {
          questionTypeId: 2,
          questionText: "Which planet is known as the Red Planet? (Updated)",
          instruction: "Choose the correct option.",
          title: "General Knowledge - Mars (Updated)",
          correctAnswer: "Mars",
        },
      });

      // Mock Snowflake:
      // Query 1: findById (existing check)
      // Query 2: UPDATE query
      // Query 3: findById (return updated question)
      mockSnowflake.query
        .mockResolvedValueOnce([{ ID: questionId }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            ID: questionId,
            QUESTION_TEXT: "Which planet is known as the Red Planet? (Updated)",
          },
        ]);

      await questionCtrl.updateQuestion(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Question updated successfully",
          question: expect.objectContaining({
            QUESTION_TEXT: "Which planet is known as the Red Planet? (Updated)",
          }),
        })
      );
    });

    test("Delete Question", async () => {
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
        params: { id: String(questionId) },
      });

      // Mock Snowflake:
      // Query 1: findById (existing check)
      // Query 2: DELETE query
      mockSnowflake.query
        .mockResolvedValueOnce([{ ID: questionId }])
        .mockResolvedValueOnce([]);

      await questionCtrl.deleteQuestion(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        message: "Question deleted successfully",
      });
    });
  });

  // =====================================================================
  // 3. Mock Test Submission Flow
  // =====================================================================
  describe("Flow 3: Mock Test E2E Submission", () => {
    test("Start Mock Test Attempt", async () => {
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
        params: { id: "1" }, // mock test ID = 1
      });

      // mockTestService.startMockTestAttempt sequence:
      // Query 1: select test
      // Query 2: check existing attempt
      // Query 3: insert attempt
      // Query 4: select test questions
      mockSnowflake.query
        .mockResolvedValueOnce([{ ID: 1, TITLE: "Mock 1", TOTAL_DURATION_MINUTES: 120 }])
        .mockResolvedValueOnce([{ CATEGORY: "Reading", SUB_CATEGORY: "Multiple Choice, Single Answer", MIN_QUESTIONS: 1, MAX_QUESTIONS: 1 }])
        .mockResolvedValueOnce([
          { ID: 10, QUESTION_TEXT: "q1", CATEGORY: "Reading", SUB_CATEGORY: "Multiple Choice, Single Answer" },
        ])
        .mockResolvedValueOnce([]);

      await mockTestCtrl.startMockTestAttempt(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          questions: expect.any(Array),
        })
      );

      const responseBody = res.json.mock.calls[0][0];
      attemptId = responseBody.id;
    });

    test("Save Mock Test Attempt Progress", async () => {
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
        params: { id: attemptId },
        body: {
          currentQuestionIndex: 1,
          timeRemaining: 7000,
          grades: { "10": 90 },
        },
      });

      // Update attempt sql check: getAttemptById resolves to active attempt, then update returns empty
      mockSnowflake.query
        .mockResolvedValueOnce([{ ID: attemptId, STATUS: "pending" }])
        .mockResolvedValueOnce([]);

      await mockTestCtrl.updateAttemptProgress(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        message: "Progress saved successfully",
      });
    });

    test("Submit Mock Test Attempt & Calculate score", async () => {
      const decoded = jwt.verify(token, "integration-test-secret");
      const { req, res, next } = mockRequestResponse({
        user: decoded,
        params: { id: attemptId },
        body: {
          grades: { "10": 90 },
          overallScore: 90,
          speakingScore: 90,
          writingScore: 90,
          readingScore: 90,
          listeningScore: 90,
        },
      });

      // Submit attempt queries: getAttemptById resolves to active attempt, then submit returns empty
      mockSnowflake.query
        .mockResolvedValueOnce([{ ID: attemptId, STATUS: "pending" }])
        .mockResolvedValueOnce([]);

      await mockTestCtrl.submitMockTestAttempt(req, res, next);
 
       expect(res.json).toHaveBeenCalledWith({
         message: "Mock test attempt submitted successfully",
       });
     });
   });

  // =====================================================================
  // 4. Authorization & Role Checks for Admin-only APIs
  // =====================================================================
  describe("Flow 4: Authorization and Role Checks (Admin-only APIs)", () => {
    let adminToken = "";
    let studentToken = "";

    beforeAll(() => {
      adminToken = jwt.sign({ id: "admin_user", role: "admin" }, "integration-test-secret");
      studentToken = jwt.sign({ id: "student_user", role: "student" }, "integration-test-secret");
    });

    test("Admin Token -> Allowed to access createQuestion", async () => {
      const { req, res, next } = mockRequestResponse({
        headers: { authorization: `Bearer ${adminToken}` },
        body: {
          questionTypeId: 2,
          questionText: "Admin test question",
          instruction: "Read prompt",
          title: "Admin Test",
          correctAnswer: "Test",
          category: "Speaking",
          difficulty: "Medium"
        }
      });

      const verifyToken = require("../../src/middleware/authMiddleware");
      const verifyAdmin = require("../../src/middleware/adminMiddleware");

      mockSnowflake.query
        .mockResolvedValueOnce([{ NEXT_ID: 999 }])
        .mockResolvedValueOnce([]);
      let tokenNextCalled = false;
      verifyToken(req, res, () => { tokenNextCalled = true; });
      expect(tokenNextCalled).toBe(true);

      let adminNextCalled = false;
      verifyAdmin(req, res, () => { adminNextCalled = true; });
      expect(adminNextCalled).toBe(true);

      await questionCtrl.createQuestion(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test("Student Token -> Forbidden (403)", async () => {
      const { req, res, next } = mockRequestResponse({
        headers: { authorization: `Bearer ${studentToken}` }
      });

      const verifyToken = require("../../src/middleware/authMiddleware");
      const verifyAdmin = require("../../src/middleware/adminMiddleware");

      let tokenNextCalled = false;
      verifyToken(req, res, () => { tokenNextCalled = true; });
      expect(tokenNextCalled).toBe(true);

      let adminNextCalled = false;
      verifyAdmin(req, res, () => { adminNextCalled = true; });
      expect(adminNextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Forbidden: Admin access required" });
    });

    test("No Token -> Unauthorized (401)", async () => {
      const { req, res, next } = mockRequestResponse({
        headers: {} // No authorization header
      });

      const verifyToken = require("../../src/middleware/authMiddleware");
      const verifyAdmin = require("../../src/middleware/adminMiddleware");

      let tokenNextCalled = false;
      verifyToken(req, res, () => { tokenNextCalled = true; });
      expect(tokenNextCalled).toBe(false);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Token missing" });
    });
  });

  // =====================================================================
  // 5. Database Failure Scenarios
  // =====================================================================
  describe("Flow 5: Database Failure Scenarios", () => {
    test("Snowflake unavailable / connection throws exception -> 500 error", async () => {
      const { req, res, next } = mockRequestResponse({
        user: { id: "u_123", role: "admin" },
        body: {
          questionTypeId: 2,
          questionText: "Text",
          title: "Title",
          category: "Speaking",
          difficulty: "Medium"
        }
      });

      mockSnowflake.query.mockRejectedValueOnce(new Error("Snowflake database connection failed"));

      let errorPassedToNext = null;
      const customNext = (err) => {
        errorPassedToNext = err;
      };

      await questionCtrl.createQuestion(req, res, customNext);

      expect(errorPassedToNext).toBeInstanceOf(Error);
      expect(errorPassedToNext.message).toBe("Snowflake database connection failed");

      const errRes = mockRequestResponse();
      const errorHandler = require("../../src/middleware/errorHandler");
      errorHandler(errorPassedToNext, req, errRes.res, errRes.next);

      expect(errRes.res.status).toHaveBeenCalledWith(500);
      expect(errRes.res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Internal server error",
          error: "Snowflake database connection failed",
        })
      );
    });

    test("SQL query syntax exception -> 500 error", async () => {
      const { req, res, next } = mockRequestResponse({
        params: { id: "101" }
      });

      mockSnowflake.query.mockRejectedValueOnce(new Error("SQL compilation error: syntax error line 1"));

      let errorPassedToNext = null;
      const customNext = (err) => {
        errorPassedToNext = err;
      };

      await questionCtrl.getQuestionById(req, res, customNext);

      expect(errorPassedToNext).toBeInstanceOf(Error);
      expect(errorPassedToNext.message).toContain("SQL compilation error");

      const errRes = mockRequestResponse();
      const errorHandler = require("../../src/middleware/errorHandler");
      errorHandler(errorPassedToNext, req, errRes.res, errRes.next);

      expect(errRes.res.status).toHaveBeenCalledWith(500);
    });
  });
});
