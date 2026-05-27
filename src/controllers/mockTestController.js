const mockTestService = require("../services/mockTestService");

async function listMockTests(req, res, next) {
  try {
    const rows = await mockTestService.listMockTests();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getMockTestById(req, res, next) {
  try {
    const { id } = req.params;
    const test = await mockTestService.getMockTestById(id);
    if (!test) {
      return res.status(404).json({ message: "Mock test not found" });
    }
    return res.json(test);
  } catch (err) {
    next(err);
  }
}

async function getQuestionsForMockTest(req, res, next) {
  try {
    const { id } = req.params;
    const questions = await mockTestService.getQuestionsForMockTest(id);
    return res.json(questions);
  } catch (err) {
    next(err);
  }
}

async function startMockTestAttempt(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const data = await mockTestService.startMockTestAttempt(userId, id);
    return res.status(201).json(data);
  } catch (err) {
    next(err);
  }
}

async function listMockTestAttempts(req, res, next) {
  try {
    const userId = req.user.id;
    const { status } = req.query;
    const rows = await mockTestService.listMockTestAttempts(userId, status);
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function updateAttemptProgress(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { currentQuestionIndex, timeRemaining, grades } = req.body;
    await mockTestService.updateAttemptProgress(id, userId, {
      currentQuestionIndex,
      timeRemaining,
      grades
    });
    return res.json({ message: "Progress saved successfully" });
  } catch (err) {
    next(err);
  }
}

async function submitMockTestAttempt(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const {
      grades,
      overallScore,
      speakingScore,
      writingScore,
      readingScore,
      listeningScore
    } = req.body;
    await mockTestService.submitMockTestAttempt(id, userId, {
      grades,
      overallScore,
      speakingScore,
      writingScore,
      readingScore,
      listeningScore
    });
    return res.json({ message: "Mock test attempt submitted successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listMockTests,
  getMockTestById,
  getQuestionsForMockTest,
  startMockTestAttempt,
  listMockTestAttempts,
  updateAttemptProgress,
  submitMockTestAttempt
};
