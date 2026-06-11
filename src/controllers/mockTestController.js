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
    if (err.message === "Mock test not found") {
      return res.status(404).json({ message: "Mock test not found" });
    }
    if (err.message === "No questions configured for this mock test") {
      return res.status(400).json({ message: "No questions configured for this mock test" });
    }
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

    const attempt = await mockTestService.getAttemptById(id, userId);
    if (!attempt) {
      return res.status(404).json({ message: "Mock test attempt not found" });
    }
    if (attempt.STATUS === "completed" || attempt.status === "completed") {
      return res.status(400).json({ message: "Cannot update progress of a completed mock test attempt" });
    }

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

    const attempt = await mockTestService.getAttemptById(id, userId);
    if (!attempt) {
      return res.status(404).json({ message: "Mock test attempt not found" });
    }
    if (attempt.STATUS === "completed" || attempt.status === "completed") {
      return res.status(400).json({ message: "This mock test attempt has already been submitted" });
    }

    const finalGrades = grades || {};
    const finalOverallScore = overallScore !== undefined ? overallScore : 10;
    const finalSpeakingScore = speakingScore !== undefined ? speakingScore : 10;
    const finalWritingScore = writingScore !== undefined ? writingScore : 10;
    const finalReadingScore = readingScore !== undefined ? readingScore : 10;
    const finalListeningScore = listeningScore !== undefined ? listeningScore : 10;

    await mockTestService.submitMockTestAttempt(id, userId, {
      grades: finalGrades,
      overallScore: finalOverallScore,
      speakingScore: finalSpeakingScore,
      writingScore: finalWritingScore,
      readingScore: finalReadingScore,
      listeningScore: finalListeningScore
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
