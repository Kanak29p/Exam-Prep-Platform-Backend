const { normalizeQuery } = require("../utils/normalizeQuery");
const questionService = require("../services/questionService");

async function listQuestions(req, res, next) {
  try {
    const { category, subCategory } = req.query;
    const normalized = normalizeQuery(category, subCategory);
    const rows = await questionService.findByCategory(
      normalized.category,
      normalized.subCategory,
    );
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function listSections(req, res, next) {
  try {
    const rows = await questionService.listSections();
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getQuestionById(req, res, next) {
  try {
    const { id } = req.params;
    const question = await questionService.findById(id);
    return res.json({
      instruction: question?.INSTRUCTION || "",
      question,
    });
  } catch (err) {
    next(err);
  }
}

async function submitAnswer(req, res, next) {
  try {
    const userId = req.user.id;
    const { questionId, audioUrl, answerText, score, feedback } = req.body;
    
    if (!questionId) {
      return res.status(400).json({ message: "questionId is required" });
    }

    const question = await questionService.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    let finalScore = score || 0;
    let finalFeedback = feedback || "";
    let accuracy = 100;
    let matchedWords = [];
    let missedWords = [];

    const categoryLower = (question.CATEGORY || "").toLowerCase();
    const subCat = (question.SUB_CATEGORY || "").toLowerCase();
    const isSpeaking = categoryLower === "speaking" || (categoryLower === "speaking & writing" && !subCat.includes("summarize written") && !subCat.includes("essay"));
    const isWriting = categoryLower === "writing" || (categoryLower === "speaking & writing" && (subCat.includes("summarize") || subCat.includes("essay")));
    const isReading = categoryLower === "reading";
    const isListening = categoryLower === "listening";

    const isPersonalIntro = subCat.includes("personal introduction");

    if (isPersonalIntro) {
      finalScore = 90;
      finalFeedback = "Your personal introduction has been recorded. Note: Personal Introduction is not scored in the actual PTE exam.";
      accuracy = 100;
      matchedWords = [];
      missedWords = [];
    } else if (isSpeaking) {
      const targetText = getTargetText(question.QUESTION_TEXT, question.CORRECT_ANSWER);
      const evalResult = evaluateSpeech(answerText, targetText);
      finalScore = evalResult.score;
      finalFeedback = evalResult.feedback;
      accuracy = evalResult.accuracy;
      matchedWords = evalResult.matchedWords;
      missedWords = evalResult.missedWords;
    } else if (isWriting) {
      const wordCount = (answerText || "").trim().split(/\s+/).filter(Boolean).length;
      const subCat = (question.SUB_CATEGORY || "").toLowerCase();
      let minWords = 200;
      let maxWords = 300;
      let isSummary = subCat.includes("summarize") || subCat.includes("summary");
      if (isSummary) {
        minWords = 5;
        maxWords = 75;
      }
      
      const wordCountOk = wordCount >= minWords && wordCount <= maxWords;
      
      let sentenceCountOk = true;
      if (isSummary) {
        const sentences = (answerText || "").trim().split(/[.!?]+/).filter((s) => s.trim().length > 0);
        if (sentences.length !== 1) {
          sentenceCountOk = false;
        }
      }

      if (wordCount === 0) {
        finalScore = 10;
        finalFeedback = "No response submitted.";
        accuracy = 0;
      } else if (wordCountOk && sentenceCountOk) {
        finalScore = 90;
        finalFeedback = `Excellent! Your response met the word count criteria (${wordCount} words) and sentence structure constraints.`;
        accuracy = 100;
      } else {
        let penalty = 0;
        if (!wordCountOk) penalty += 30;
        if (!sentenceCountOk) penalty += 20;
        finalScore = Math.max(10, 90 - penalty);
        accuracy = Math.max(10, 100 - penalty);
        
        let feedback = `Response recorded. Word count: ${wordCount} (Target: ${minWords}-${maxWords}). `;
        if (!wordCountOk) feedback += `Word count is outside the target range. `;
        if (isSummary && !sentenceCountOk) feedback += `Your summary must be exactly one sentence. `;
        finalFeedback = feedback.trim();
      }
    } else if (isReading || isListening) {
      const evalResult = evaluateReadingOrListening(question, answerText);
      finalScore = evalResult.score;
      finalFeedback = evalResult.feedback;
      accuracy = evalResult.accuracy;
    }

    await questionService.submitAnswer({
      userId,
      questionId: Number(questionId),
      audioUrl,
      answerText,
      score: finalScore,
      feedback: finalFeedback
    });
    
    return res.status(201).json({ 
      message: "Answer submitted successfully", 
      score: finalScore, 
      feedback: finalFeedback,
      accuracy,
      matchedWords,
      missedWords,
      transcript: answerText
    });
  } catch (err) {
    next(err);
  }
}

function cleanText(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function evaluateSpeech(transcript, targetText) {
  const tClean = cleanText(transcript);
  const targetClean = cleanText(targetText);

  if (!targetClean) {
    return {
      score: 90,
      accuracy: 100,
      matchedWords: [],
      missedWords: [],
      feedback: "Excellent response."
    };
  }

  const tWords = tClean.split(" ").filter(Boolean);
  const targetWords = targetClean.split(" ").filter(Boolean);

  const matchedWords = [];
  const missedWords = [];
  
  targetWords.forEach(word => {
    if (tWords.includes(word)) {
      matchedWords.push(word);
    } else {
      missedWords.push(word);
    }
  });

  const accuracy = targetWords.length > 0 
    ? Math.round((matchedWords.length / targetWords.length) * 100) 
    : 100;

  const score = 10 + Math.round((accuracy / 100) * 80);

  let feedback = "";
  if (accuracy === 100) {
    feedback = "Perfect pronunciation and accuracy! Keep up the good work.";
  } else if (accuracy >= 80) {
    feedback = `Great job! You matched ${accuracy}% of the words. Try to focus on the following missed words: ${missedWords.join(", ")}.`;
  } else if (accuracy >= 50) {
    feedback = `Good effort, but some words were missed or mispronounced. Missed words: ${missedWords.join(", ")}.`;
  } else {
    feedback = `Please try again. Ensure you speak clearly and match the prompt text. Missed words: ${missedWords.join(", ")}.`;
  }

  return {
    score,
    accuracy,
    matchedWords,
    missedWords,
    feedback
  };
}

function getTargetText(questionText, correctAnswer) {
  if (correctAnswer && correctAnswer !== "null" && correctAnswer.trim().length > 0) {
    return correctAnswer;
  }
  if (!questionText) return "";
  
  const match = questionText.match(/"([^"]+)"/);
  if (match && match[1]) {
    return match[1];
  }
  
  return questionText
    .replace(/^(read aloud|repeat|repeat the audio sentence):\s*/i, "")
    .replace(/"/g, "")
    .trim();
}

function evaluateReadingOrListening(question, answerText) {
  const subCat = (question.SUB_CATEGORY || "").toLowerCase();
  const correctAnswer = (question.CORRECT_ANSWER || "").trim();
  const userAnswer = (answerText || "").trim();

  if (!correctAnswer || correctAnswer === "null") {
    return {
      score: 90,
      accuracy: 100,
      feedback: "Answer recorded successfully."
    };
  }

  const isMcqSingle = subCat.includes("single") || subCat.includes("summary") || subCat.includes("missing word");
  const isMcqMultiple = subCat.includes("multiple") && !subCat.includes("single");
  const isReorder = subCat.includes("reorder");
  const isIncorrectWord = subCat.includes("incorrect word");
  const isDictation = subCat.includes("dictation");
  const isSpokenSummary = subCat.includes("summarize spoken") || subCat.includes("summarize discussion");
  const isFitb = subCat.includes("fill in");

  if (isMcqSingle) {
    const uCleanLetter = cleanOption(userAnswer);
    const cCleanLetter = cleanOption(correctAnswer);

    const uCleanText = cleanTextSimple(stripOptionPrefix(userAnswer));
    const cCleanText = cleanTextSimple(stripOptionPrefix(correctAnswer));

    const letterMatch = uCleanLetter && cCleanLetter && uCleanLetter === cCleanLetter;
    const textMatch = uCleanText && cCleanText && uCleanText === cCleanText;

    if (letterMatch || textMatch) {
      return {
        score: 90,
        accuracy: 100,
        feedback: `Correct answer! The correct choice is: ${correctAnswer}.`
      };
    } else {
      return {
        score: 10,
        accuracy: 0,
        feedback: `Incorrect. Your answer was "${userAnswer}". The correct answer is: ${correctAnswer}.`
      };
    }
  }

  if (isMcqMultiple) {
    const uParts = (userAnswer || "").split(",").map(s => s.trim()).filter(Boolean);
    const cParts = (correctAnswer || "").split(",").map(s => s.trim()).filter(Boolean);

    let matchCount = 0;
    uParts.forEach(uPart => {
      const uCleanLetter = cleanOption(uPart);
      const uCleanText = cleanTextSimple(stripOptionPrefix(uPart));

      const isMatched = cParts.some(cPart => {
        const cCleanLetter = cleanOption(cPart);
        const cCleanText = cleanTextSimple(stripOptionPrefix(cPart));
        
        if (uCleanLetter && cCleanLetter && uCleanLetter === cCleanLetter) {
          return true;
        }
        if (uCleanText && cCleanText && uCleanText === cCleanText) {
          return true;
        }
        return false;
      });

      if (isMatched) {
        matchCount++;
      }
    });

    const totalCorrect = cParts.length;
    const accuracy = totalCorrect > 0 ? Math.round((matchCount / totalCorrect) * 100) : 100;
    const score = 10 + Math.round((accuracy / 100) * 80);

    let feedback = "";
    if (accuracy === 100 && uParts.length === totalCorrect) {
      feedback = "Excellent! You selected all the correct choices.";
    } else if (matchCount > 0) {
      feedback = `Partially correct. You matched ${matchCount} out of ${totalCorrect} correct choices. Correct choices: ${correctAnswer}.`;
    } else {
      feedback = `Incorrect. None of your selections were correct. The correct choices are: ${correctAnswer}.`;
    }

    return { score, accuracy, feedback };
  }

  if (isReorder) {
    const uClean = userAnswer.replace(/\s+/g, "").toLowerCase();
    const cClean = correctAnswer.replace(/\s+/g, "").toLowerCase();

    if (uClean === cClean) {
      return {
        score: 90,
        accuracy: 100,
        feedback: "Perfect reordering! All sentences are in the correct sequence."
      };
    } else {
      return {
        score: 10,
        accuracy: 0,
        feedback: `Incorrect sequence. The correct order is: ${correctAnswer}.`
      };
    }
  }

  if (isIncorrectWord) {
    const uClean = cleanTextSimple(userAnswer);
    const cClean = cleanTextSimple(correctAnswer);

    if (cClean.includes(uClean) && uClean.length > 0) {
      return {
        score: 90,
        accuracy: 100,
        feedback: `Correct! The word "${userAnswer}" is incorrect in the transcript. Correct answer: ${correctAnswer}.`
      };
    } else {
      return {
        score: 10,
        accuracy: 0,
        feedback: `Incorrect word selected. The incorrect word in the transcript is: ${correctAnswer}.`
      };
    }
  }

  if (isDictation) {
    const uWords = cleanTextSimple(userAnswer).split(" ").filter(Boolean);
    const cWords = cleanTextSimple(correctAnswer).split(" ").filter(Boolean);

    let matched = 0;
    cWords.forEach(w => {
      if (uWords.includes(w)) matched++;
    });

    const accuracy = cWords.length > 0 ? Math.round((matched / cWords.length) * 100) : 100;
    const score = 10 + Math.round((accuracy / 100) * 80);

    let feedback = "";
    if (accuracy === 100) {
      feedback = "Perfect dictation! You captured every word correctly.";
    } else if (accuracy >= 70) {
      feedback = `Good attempt. You matched ${accuracy}% of the words. Correct sentence: "${correctAnswer}".`;
    } else {
      feedback = `Keep practicing. Correct sentence: "${correctAnswer}".`;
    }

    return { score, accuracy, feedback };
  }

  if (isSpokenSummary) {
    const count = userAnswer.split(/\s+/).filter(Boolean).length;
    const countOk = count >= 50 && count <= 70;

    let score = countOk ? 90 : 30;
    if (count === 0) score = 10;

    let feedback = `Summary recorded. Word count: ${count} words. `;
    if (countOk) {
      feedback += "Your summary satisfies the 50-70 word criteria.";
    } else {
      feedback += "Criteria warning: Summary should be between 50 and 70 words.";
    }

    return {
      score,
      accuracy: countOk ? 100 : 30,
      feedback
    };
  }

  if (isFitb) {
    const uChoices = userAnswer.split(",").map(w => w.trim());
    const cChoices = correctAnswer.split(",").map(w => w.trim());

    let correctCount = 0;
    cChoices.forEach((correctWord, idx) => {
      const uChoiceCleaned = cleanTextSimple(uChoices[idx]);
      const alternatives = correctWord.split("/").map(alt => cleanTextSimple(alt));
      if (uChoiceCleaned && alternatives.includes(uChoiceCleaned)) {
        correctCount++;
      }
    });

    const totalBlanks = cChoices.length;
    const accuracy = totalBlanks > 0 ? Math.round((correctCount / totalBlanks) * 100) : 100;
    const score = 10 + Math.round((accuracy / 100) * 80);

    let feedback = "";
    if (accuracy === 100) {
      feedback = "Outstanding! You filled in all the blanks correctly.";
    } else {
      feedback = `You filled in ${correctCount} out of ${totalBlanks} blanks correctly. Correct answers: ${correctAnswer}.`;
    }

    return { score, accuracy, feedback };
  }

  return {
    score: 90,
    accuracy: 100,
    feedback: "Answer received successfully."
  };
}

function cleanOption(opt) {
  return (opt || "")
    .trim()
    .toLowerCase()
    .replace(/^([a-d])\b.*/i, "$1")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .trim();
}

function stripOptionPrefix(text) {
  return (text || "")
    .replace(/^option\s+[a-d]\b/i, "")
    .replace(/^choice\s+[a-d]\b/i, "")
    .replace(/^[a-d]\s*[).:-]/i, "")
    .trim();
}

function splitAnswers(answer) {
  return (answer || "")
    .split(",")
    .map(o => cleanOption(o))
    .filter(Boolean);
}

function cleanTextSimple(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function createQuestion(req, res, next) {
  try {
    const { id, questionTypeId, questionText, instruction, title, correctAnswer, category, difficulty, options } = req.body;
    
    // 1. Title Validation
    if (title === undefined || title === null) {
      return res.status(400).json({ message: "title is required" });
    }
    if (String(title).trim().length === 0) {
      return res.status(400).json({ message: "title cannot be empty" });
    }

    // 2. Category Validation
    if (category === undefined || category === null) {
      return res.status(400).json({ message: "category is required" });
    }
    const validCategories = ["speaking", "writing", "reading", "listening", "speaking & writing"];
    if (!validCategories.includes(String(category).trim().toLowerCase())) {
      return res.status(400).json({ message: "Invalid category" });
    }

    // 3. Difficulty Validation
    if (difficulty === undefined || difficulty === null) {
      return res.status(400).json({ message: "difficulty is required" });
    }
    const validDifficulties = ["easy", "medium", "hard"];
    if (!validDifficulties.includes(String(difficulty).trim().toLowerCase())) {
      return res.status(400).json({ message: "Invalid difficulty" });
    }

    // 4. Question Type ID Validation
    if (questionTypeId === undefined || questionTypeId === null) {
      return res.status(400).json({ message: "questionTypeId is required" });
    }
    const typeIdInt = parseInt(questionTypeId);
    if (isNaN(typeIdInt) || typeIdInt < 1 || typeIdInt > 23) {
      return res.status(400).json({ message: "Invalid question type" });
    }

    // 5. Options Validation (Multiple choice question types: 8, 9, 14, 15)
    const mcqTypes = [8, 9, 14, 15];
    if (mcqTypes.includes(typeIdInt)) {
      if (!options || (Array.isArray(options) && options.length === 0)) {
        return res.status(400).json({ message: "options cannot be empty" });
      }
    }

    // 6. Duplicate ID Validation
    if (id !== undefined && id !== null) {
      const existing = await questionService.findById(id);
      if (existing) {
        return res.status(400).json({ message: "Duplicate question ID" });
      }
    }

    if (questionText === undefined || questionText === null) {
      return res.status(400).json({ message: "questionText is required" });
    }
    if (String(questionText).trim().length === 0) {
      return res.status(400).json({ message: "questionText cannot be empty" });
    }

    const question = await questionService.createQuestion({
      id: id ? parseInt(id) : undefined,
      questionTypeId: typeIdInt,
      questionText,
      instruction,
      title,
      correctAnswer,
      options: options ? (Array.isArray(options) ? JSON.stringify(options) : options) : undefined
    });
    return res.status(201).json({ message: "Question created successfully", question });
  } catch (err) {
    next(err);
  }
}

async function updateQuestion(req, res, next) {
  try {
    const { id } = req.params;
    const { questionTypeId, questionText, instruction, title, correctAnswer } = req.body;
    const existing = await questionService.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }
    const question = await questionService.updateQuestion(id, {
      questionTypeId,
      questionText,
      instruction,
      title,
      correctAnswer
    });
    return res.json({ message: "Question updated successfully", question });
  } catch (err) {
    next(err);
  }
}

async function deleteQuestion(req, res, next) {
  try {
    const { id } = req.params;
    const existing = await questionService.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Question not found" });
    }
    await questionService.deleteQuestion(id);
    return res.json({ message: "Question deleted successfully" });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listQuestions,
  listSections,
  getQuestionById,
  submitAnswer,
  createQuestion,
  updateQuestion,
  deleteQuestion
};
