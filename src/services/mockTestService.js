const { query } = require("../db/snowflake");
const { normalizeQuery } = require("../utils/normalizeQuery");

const CANONICAL_ORDER = [
  // Part 1: Speaking & Writing
  { category: 'Speaking', subCategory: 'Personal Introduction' },
  { category: 'Speaking', subCategory: 'Read Aloud' },
  { category: 'Speaking', subCategory: 'Repeat Sentence' },
  { category: 'Speaking', subCategory: 'Describe Image' },
  { category: 'Speaking', subCategory: 'Retell Lecture' },
  { category: 'Speaking', subCategory: 'Answer Short Question' },
  { category: 'Speaking', subCategory: 'Summarize Group Discussion' },
  { category: 'Speaking', subCategory: 'Respond to a Situation' },
  { category: 'Writing', subCategory: 'Summarize Written Text' },
  { category: 'Writing', subCategory: 'Write Essay' },

  // Part 2: Reading
  { category: 'Reading', subCategory: 'Reading & Writing: Fill in the Blanks' },
  { category: 'Reading', subCategory: 'Multiple Choice, Multiple Answers' },
  { category: 'Reading', subCategory: 'Reorder Paragraphs' },
  { category: 'Reading', subCategory: 'Reading: Fill in the Blanks' },
  { category: 'Reading', subCategory: 'Multiple Choice, Single Answer' },

  // Part 3: Listening
  { category: 'Listening', subCategory: 'Summarize Spoken Text' },
  { category: 'Listening', subCategory: 'Multiple Choice, Multiple Answers' },
  { category: 'Listening', subCategory: 'Fill in the Blanks' },
  { category: 'Listening', subCategory: 'Highlight Correct Summary' },
  { category: 'Listening', subCategory: 'Multiple Choice, Single Answer' },
  { category: 'Listening', subCategory: 'Select Missing Word' },
  { category: 'Listening', subCategory: 'Highlight Incorrect Words' },
  { category: 'Listening', subCategory: 'Write from Dictation' }
];

// Helper to get index in canonical order
function getCanonicalIndex(category, subCategory) {
  const cCat = category.toLowerCase().trim();
  const cSub = subCategory.toLowerCase().trim();
  return CANONICAL_ORDER.findIndex(item => {
    return item.category.toLowerCase().trim() === cCat &&
           item.subCategory.toLowerCase().trim() === cSub;
  });
}

async function listMockTests() {
  const sql = "SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS WHERE STATUS = 'active' ORDER BY ID ASC";
  return query(sql);
}

async function getMockTestById(id) {
  const sql = "SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS WHERE ID = ?";
  const rows = await query(sql, [id]);
  return rows[0] || null;
}

async function getQuestionsForMockTest(mockTestId) {
  // 1. Fetch the pattern rows
  const patternSql = "SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN WHERE MOCK_TEST_ID = ?";
  const patterns = await query(patternSql, [mockTestId]);

  if (patterns.length === 0) {
    return [];
  }

  const allQuestions = [];

  // 2. Fetch questions for each pattern row
  for (const pattern of patterns) {
    const min = pattern.MIN_QUESTIONS || 1;
    const max = pattern.MAX_QUESTIONS || 1;
    
    // Choose a random number of questions between min and max
    const count = Math.floor(Math.random() * (max - min + 1)) + min;

    // Normalize category and subcategory to match Snowflake CONFIG_TABLE
    const normalized = normalizeQuery(pattern.CATEGORY, pattern.SUB_CATEGORY);

    const questionsSql = `
      SELECT 
        q.ID, 
        q.QUESTION_TEXT, 
        q.AUDIO_URL, 
        q.IMAGE_URL, 
        q.OPTIONS, 
        q.INSTRUCTION, 
        q.TITLE, 
        q.CORRECT_ANSWER,
        c.CATEGORY, 
        c.TYPE AS SUB_CATEGORY, 
        c.AUDIO_WAITING_TIME, 
        c.RECORDING_WAITING_TIME, 
        c.RECORDING_TIME, 
        c.HAS_AUDIO, 
        c.NEXT_BUTTON_BEHAVIOR
      FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS q
      JOIN PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG c ON q.QUESTION_TYPE_ID = c.ID
      WHERE LOWER(TRIM(c.CATEGORY)) = LOWER(TRIM(?))
        AND LOWER(TRIM(c.TYPE)) = LOWER(TRIM(?))
      ORDER BY RANDOM()
      LIMIT ?
    `;

    try {
      const rows = await query(questionsSql, [normalized.category, normalized.subCategory, count]);
      // Add questions with original category/sub_category from pattern for canonical sorting
      rows.forEach(row => {
        if (row.CATEGORY === "Speaking & Writing") {
          const lowerSub = (row.SUB_CATEGORY || "").toLowerCase();
          if (lowerSub.includes("summarize written") || lowerSub.includes("essay")) {
            row.CATEGORY = "Writing";
          } else {
            row.CATEGORY = "Speaking";
          }
        }
        row.PATTERN_CATEGORY = pattern.CATEGORY;
        row.PATTERN_SUB_CATEGORY = pattern.SUB_CATEGORY;
        allQuestions.push(row);
      });
    } catch (err) {
      console.error(`Error fetching questions for ${pattern.CATEGORY} - ${pattern.SUB_CATEGORY}:`, err.message);
    }
  }

  // 3. Sort the collected questions according to the CANONICAL_ORDER
  allQuestions.sort((a, b) => {
    const idxA = getCanonicalIndex(a.PATTERN_CATEGORY, a.PATTERN_SUB_CATEGORY);
    const idxB = getCanonicalIndex(b.PATTERN_CATEGORY, b.PATTERN_SUB_CATEGORY);
    return idxA - idxB;
  });

  return allQuestions;
}

async function startMockTestAttempt(userId, mockTestId) {
  const test = await getMockTestById(mockTestId);
  if (!test) {
    throw new Error("Mock test not found");
  }

  const questions = await getQuestionsForMockTest(mockTestId);
  if (questions.length === 0) {
    throw new Error("No questions configured for this mock test");
  }

  const attemptId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const durationSeconds = (test.TOTAL_DURATION_MINUTES || 120) * 60;

  const sql = `
    INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_ATTEMPTS (
      ID, USER_ID, MOCK_TEST_ID, STATUS, CURRENT_QUESTION_INDEX, TIME_REMAINING, QUESTIONS, GRADES
    ) VALUES (?, ?, ?, 'pending', 0, ?, ?, '{}')
  `;
  await query(sql, [
    attemptId,
    String(userId),
    Number(mockTestId),
    Number(durationSeconds),
    JSON.stringify(questions)
  ]);

  return { id: attemptId, questions };
}

async function listMockTestAttempts(userId, status) {
  let sql = `
    SELECT 
      a.ID, a.USER_ID, a.MOCK_TEST_ID, a.STATUS, 
      a.CURRENT_QUESTION_INDEX, a.TIME_REMAINING, 
      a.QUESTIONS, a.GRADES, a.OVERALL_SCORE, 
      a.SPEAKING_SCORE, a.WRITING_SCORE, a.READING_SCORE, a.LISTENING_SCORE, 
      a.CREATED_AT, a.UPDATED_AT,
      t.TITLE, t.DESCRIPTION, t.TOTAL_QUESTIONS, t.TOTAL_DURATION_MINUTES
    FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_ATTEMPTS a
    JOIN PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS t ON a.MOCK_TEST_ID = t.ID
    WHERE a.USER_ID = ?
  `;
  const binds = [String(userId)];
  if (status) {
    sql += " AND a.STATUS = ?";
    binds.push(status);
  }
  sql += " ORDER BY a.UPDATED_AT DESC";
  return query(sql, binds);
}

async function updateAttemptProgress(attemptId, userId, { currentQuestionIndex, timeRemaining, grades }) {
  const sql = `
    UPDATE PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_ATTEMPTS
    SET CURRENT_QUESTION_INDEX = ?, TIME_REMAINING = ?, GRADES = ?, UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE ID = ? AND USER_ID = ?
  `;
  return query(sql, [
    Number(currentQuestionIndex),
    Number(timeRemaining),
    typeof grades === "string" ? grades : JSON.stringify(grades),
    attemptId,
    String(userId)
  ]);
}

async function submitMockTestAttempt(attemptId, userId, { grades, overallScore, speakingScore, writingScore, readingScore, listeningScore }) {
  const sql = `
    UPDATE PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_ATTEMPTS
    SET 
      STATUS = 'completed', 
      GRADES = ?, 
      OVERALL_SCORE = ?, 
      SPEAKING_SCORE = ?, 
      WRITING_SCORE = ?, 
      READING_SCORE = ?, 
      LISTENING_SCORE = ?, 
      UPDATED_AT = CURRENT_TIMESTAMP()
    WHERE ID = ? AND USER_ID = ?
  `;
  return query(sql, [
    typeof grades === "string" ? grades : JSON.stringify(grades),
    Number(overallScore),
    Number(speakingScore),
    Number(writingScore),
    Number(readingScore),
    Number(listeningScore),
    attemptId,
    String(userId)
  ]);
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
