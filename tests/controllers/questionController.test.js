jest.mock("../../src/services/questionService", () => ({
  findByCategory: jest.fn(),
  listSections: jest.fn(),
  findById: jest.fn(),
  submitAnswer: jest.fn(),
}));

jest.mock("../../src/utils/normalizeQuery", () => ({
  normalizeQuery: jest.fn((cat, sub) => ({ category: cat, subCategory: sub })),
}));

const questionService = require("../../src/services/questionService");
const { listQuestions, getQuestionById, submitAnswer } = require("../../src/controllers/questionController");

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// =====================================================================
// listQuestions
// =====================================================================
describe("questionController.listQuestions", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { query: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("returns questions filtered by category", async () => {
    req.query = { category: "Speaking", subCategory: "Read Aloud" };
    const rows = [{ ID: 1, QUESTION_TEXT: "Read this aloud" }];
    questionService.findByCategory.mockResolvedValueOnce(rows);
    await listQuestions(req, res, next);
    expect(res.json).toHaveBeenCalledWith(rows);
  });

  test("returns all questions with no filters", async () => {
    questionService.findByCategory.mockResolvedValueOnce([]);
    await listQuestions(req, res, next);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  test("calls next(err) on service failure", async () => {
    questionService.findByCategory.mockRejectedValueOnce(new Error("DB error"));
    await listQuestions(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// getQuestionById
// =====================================================================
describe("questionController.getQuestionById", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { params: { id: "1" } };
    res = makeRes();
    next = jest.fn();
  });

  test("returns question with instruction wrapper", async () => {
    const q = { ID: 1, QUESTION_TEXT: "Q?", INSTRUCTION: "Read carefully", CORRECT_ANSWER: "A" };
    questionService.findById.mockResolvedValueOnce(q);
    await getQuestionById(req, res, next);
    expect(res.json).toHaveBeenCalledWith({ instruction: "Read carefully", question: q });
  });

  test("returns empty instruction when not present", async () => {
    questionService.findById.mockResolvedValueOnce({ ID: 2, QUESTION_TEXT: "Q?" });
    await getQuestionById(req, res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ instruction: "" }));
  });
});

// =====================================================================
// submitAnswer – questionId validation
// =====================================================================
describe("questionController.submitAnswer – validation", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("400 – missing questionId", async () => {
    await submitAnswer(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "questionId is required" });
  });

  test("404 – question not found", async () => {
    req.body = { questionId: "999", answerText: "hi" };
    questionService.findById.mockResolvedValueOnce(null);
    await submitAnswer(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Question not found" });
  });
});

// =====================================================================
// submitAnswer – Speaking (Read Aloud)
// =====================================================================
describe("questionController.submitAnswer – Speaking", () => {
  let req, res, next;

  const speakingQuestion = {
    ID: 1,
    CATEGORY: "Speaking & Writing",
    SUB_CATEGORY: "Read Aloud",
    QUESTION_TEXT: "the quick brown fox",
    CORRECT_ANSWER: "the quick brown fox",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: { questionId: "1" } };
    res = makeRes();
    next = jest.fn();
    questionService.submitAnswer.mockResolvedValue({});
  });

  test("100% accuracy – all words matched → score 90", async () => {
    req.body.answerText = "the quick brown fox";
    questionService.findById.mockResolvedValueOnce(speakingQuestion);
    await submitAnswer(req, res, next);
    const call = res.json.mock.calls[0][0];
    expect(call.score).toBe(90);
    expect(call.accuracy).toBe(100);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("50% accuracy – half words matched", async () => {
    req.body.answerText = "the quick";
    questionService.findById.mockResolvedValueOnce(speakingQuestion);
    await submitAnswer(req, res, next);
    const call = res.json.mock.calls[0][0];
    expect(call.accuracy).toBe(50);
    expect(call.score).toBeGreaterThanOrEqual(10);
    expect(call.missedWords).toContain("brown");
    expect(call.missedWords).toContain("fox");
  });

  test("0% – no words matched → low score", async () => {
    req.body.answerText = "nothing at all here";
    questionService.findById.mockResolvedValueOnce(speakingQuestion);
    await submitAnswer(req, res, next);
    const call = res.json.mock.calls[0][0];
    expect(call.accuracy).toBe(0);
    expect(call.score).toBe(10);
  });

  test("Personal Introduction – always scores 90 with special feedback", async () => {
    req.body.answerText = "Hi I am Alice";
    questionService.findById.mockResolvedValueOnce({
      ...speakingQuestion,
      SUB_CATEGORY: "Personal Introduction",
    });
    await submitAnswer(req, res, next);
    const call = res.json.mock.calls[0][0];
    expect(call.score).toBe(90);
    expect(call.feedback).toContain("Personal Introduction");
  });
});

// =====================================================================
// submitAnswer – Writing (Essay & Summary)
// =====================================================================
describe("questionController.submitAnswer – Writing Essay", () => {
  let req, res, next;

  const writingQuestion = {
    ID: 2, CATEGORY: "Writing", SUB_CATEGORY: "Write Essay", CORRECT_ANSWER: "",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: { questionId: "2" } };
    res = makeRes();
    next = jest.fn();
    questionService.submitAnswer.mockResolvedValue({});
  });

  function makeWords(count) {
    return Array(count).fill("word").join(" ");
  }

  test("empty answer → score 10", async () => {
    req.body.answerText = "";
    questionService.findById.mockResolvedValueOnce(writingQuestion);
    await submitAnswer(req, res, next);
    expect(res.json.mock.calls[0][0].score).toBe(10);
  });

  test("word count within 200-300 → score 90", async () => {
    req.body.answerText = makeWords(250);
    questionService.findById.mockResolvedValueOnce(writingQuestion);
    await submitAnswer(req, res, next);
    expect(res.json.mock.calls[0][0].score).toBe(90);
  });

  test("word count under 200 → penalty applied", async () => {
    req.body.answerText = makeWords(100);
    questionService.findById.mockResolvedValueOnce(writingQuestion);
    await submitAnswer(req, res, next);
    expect(res.json.mock.calls[0][0].score).toBeLessThan(90);
  });

  test("word count over 300 → penalty applied", async () => {
    req.body.answerText = makeWords(400);
    questionService.findById.mockResolvedValueOnce(writingQuestion);
    await submitAnswer(req, res, next);
    expect(res.json.mock.calls[0][0].score).toBeLessThan(90);
  });
});

describe("questionController.submitAnswer – Writing Summarize", () => {
  let req, res, next;

  const summaryQuestion = {
    ID: 3, CATEGORY: "Speaking & Writing", SUB_CATEGORY: "Summarize Written Text", CORRECT_ANSWER: "",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: { questionId: "3" } };
    res = makeRes();
    next = jest.fn();
    questionService.submitAnswer.mockResolvedValue({});
  });

  test("valid one-sentence within 5-75 words → score 90", async () => {
    req.body.answerText = "The article discusses climate change and its effects on global warming.";
    questionService.findById.mockResolvedValueOnce(summaryQuestion);
    await submitAnswer(req, res, next);
    expect(res.json.mock.calls[0][0].score).toBe(90);
  });

  test("multiple sentences in summary → score penalty", async () => {
    req.body.answerText = "First sentence here. Second sentence here.";
    questionService.findById.mockResolvedValueOnce(summaryQuestion);
    await submitAnswer(req, res, next);
    expect(res.json.mock.calls[0][0].score).toBeLessThan(90);
  });
});

// =====================================================================
// submitAnswer – Reading (MCQ Single)
// =====================================================================
describe("questionController.submitAnswer – Reading MCQ Single", () => {
  let req, res, next;

  const readingQ = {
    ID: 10, CATEGORY: "Reading", SUB_CATEGORY: "MCQ Single Answer",
    CORRECT_ANSWER: "B. The economy grew rapidly.",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: { questionId: "10" } };
    res = makeRes();
    next = jest.fn();
    questionService.submitAnswer.mockResolvedValue({});
  });

  test("correct answer → score 90, accuracy 100", async () => {
    req.body.answerText = "B. The economy grew rapidly.";
    questionService.findById.mockResolvedValueOnce(readingQ);
    await submitAnswer(req, res, next);
    const { score, accuracy } = res.json.mock.calls[0][0];
    expect(score).toBe(90);
    expect(accuracy).toBe(100);
  });

  test("wrong answer → score 10, accuracy 0", async () => {
    req.body.answerText = "A. Something else";
    questionService.findById.mockResolvedValueOnce(readingQ);
    await submitAnswer(req, res, next);
    const { score, accuracy } = res.json.mock.calls[0][0];
    expect(score).toBe(10);
    expect(accuracy).toBe(0);
  });
});

// =====================================================================
// submitAnswer – Listening (Write from Dictation)
// =====================================================================
describe("questionController.submitAnswer – Listening Dictation", () => {
  let req, res, next;

  const dictationQ = {
    ID: 20, CATEGORY: "Listening",
    SUB_CATEGORY: "Write from Dictation",
    CORRECT_ANSWER: "the students must complete the assignment",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: { questionId: "20" } };
    res = makeRes();
    next = jest.fn();
    questionService.submitAnswer.mockResolvedValue({});
  });

  test("perfect dictation → score 90, accuracy 100", async () => {
    req.body.answerText = "the students must complete the assignment";
    questionService.findById.mockResolvedValueOnce(dictationQ);
    await submitAnswer(req, res, next);
    const call = res.json.mock.calls[0][0];
    expect(call.score).toBe(90);
    expect(call.accuracy).toBe(100);
  });

  test("partial dictation → partial score", async () => {
    req.body.answerText = "the students must complete";
    questionService.findById.mockResolvedValueOnce(dictationQ);
    await submitAnswer(req, res, next);
    const call = res.json.mock.calls[0][0];
    expect(call.accuracy).toBeLessThan(100);
    expect(call.score).toBeGreaterThan(10);
  });
});
