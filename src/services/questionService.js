const { query } = require("../db/snowflake");

const TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS";
const CONFIG_TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG";

async function findByCategory(category, subCategory) {
  const sql = `
    SELECT q.ID, q.ID AS QUESTIONID, q.QUESTION_TEXT, q.TITLE
    FROM ${TABLE} q
    JOIN ${CONFIG_TABLE} c ON q.QUESTION_TYPE_ID = c.ID
    WHERE LOWER(TRIM(c.CATEGORY)) = LOWER(TRIM(?))
      AND LOWER(TRIM(c.TYPE)) = LOWER(TRIM(?))
  `;
  return query(sql, [category, subCategory]);
}

const CANONICAL_ORDER = [
  // Speaking
  { category: 'Speaking', subCategory: 'Read Aloud' },
  { category: 'Speaking', subCategory: 'Repeat Sentence' },
  { category: 'Speaking', subCategory: 'Describe Image' },
  { category: 'Speaking', subCategory: 'Re-tell Lecture' },
  { category: 'Speaking', subCategory: 'Answer Short Questions' },
  { category: 'Speaking', subCategory: 'Summarize Discussion' },
  { category: 'Speaking', subCategory: 'Respond to a Situation' },

  // Writing
  { category: 'Writing', subCategory: 'Summarize Written Text' },
  { category: 'Writing', subCategory: 'Write Essay' },

  // Reading
  { category: 'Reading', subCategory: 'Fill in the Blanks Reading & Writing' },
  { category: 'Reading', subCategory: 'Multiple Choice Multiple Answer' },
  { category: 'Reading', subCategory: 'Reorder Paragraph' },
  { category: 'Reading', subCategory: 'Reading Fill in the Blanks' },
  { category: 'Reading', subCategory: 'Multiple Choice Single Answer' },

  // Listening
  { category: 'Listening', subCategory: 'Summarize Spoken Text' },
  { category: 'Listening', subCategory: 'MCQ Multiple Answer' },
  { category: 'Listening', subCategory: 'Listening Fill in the Blanks' },
  { category: 'Listening', subCategory: 'Highlight Correct Summary' },
  { category: 'Listening', subCategory: 'MCQ Single Answer' },
  { category: 'Listening', subCategory: 'Select Missing Word' },
  { category: 'Listening', subCategory: 'Highlight Incorrect Word' },
  { category: 'Listening', subCategory: 'Write from Dictation' }
];

function getCanonicalIndex(category, subCategory) {
  const cCat = category.toLowerCase().trim();
  const cSub = subCategory.toLowerCase().trim();
  return CANONICAL_ORDER.findIndex(item => {
    return item.category.toLowerCase().trim() === cCat &&
           item.subCategory.toLowerCase().trim() === cSub;
  });
}

async function listSections() {
  const sql = `
    SELECT DISTINCT CATEGORY, TYPE AS SUB_CATEGORY
    FROM ${CONFIG_TABLE}
    WHERE LOWER(TRIM(TYPE)) != 'personal introduction'
  `;
  const rows = await query(sql);
  const mapped = rows.map((r) => {
    let cat = r.CATEGORY;
    const sub = r.SUB_CATEGORY;
    if (cat === "Speaking & Writing") {
      const lowerSub = sub.toLowerCase();
      if (lowerSub.includes("summarize written") || lowerSub.includes("essay")) {
        cat = "Writing";
      } else {
        cat = "Speaking";
      }
    }
    return {
      CATEGORY: cat,
      SUB_CATEGORY: sub,
    };
  });

  // Sort according to CANONICAL_ORDER
  mapped.sort((a, b) => {
    const idxA = getCanonicalIndex(a.CATEGORY, a.SUB_CATEGORY);
    const idxB = getCanonicalIndex(b.CATEGORY, b.SUB_CATEGORY);
    const valA = idxA === -1 ? 999 : idxA;
    const valB = idxB === -1 ? 999 : idxB;
    return valA - valB;
  });

  return mapped;
}

async function findById(id) {
  const sql = `
    SELECT 
      q.*, 
      q.ID AS QUESTIONID, 
      c.CATEGORY, 
      c.TYPE AS SUB_CATEGORY, 
      c.AUDIO_WAITING_TIME, 
      c.RECORDING_WAITING_TIME, 
      c.RECORDING_TIME, 
      c.HAS_AUDIO, 
      c.NEXT_BUTTON_BEHAVIOR
    FROM ${TABLE} q
    LEFT JOIN ${CONFIG_TABLE} c ON q.QUESTION_TYPE_ID = c.ID
    WHERE q.ID = ?
  `;
  const rows = await query(sql, [id]);
  const row = rows[0] || null;
  if (row) {
    if (row.CATEGORY && row.CATEGORY.trim().toLowerCase() === "speaking & writing") {
      const lowerSub = (row.SUB_CATEGORY || "").toLowerCase();
      if (lowerSub.includes("summarize written") || lowerSub.includes("essay")) {
        row.CATEGORY = "Writing";
      } else {
        row.CATEGORY = "Speaking";
      }
    }
  }
  return row;
}

async function submitAnswer({ userId, questionId, audioUrl, answerText, score, feedback }) {
  const sql = `
    INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.STUDENT_RESPONSES (
      USER_ID,
      QUESTION_ID,
      AUDIO_URL,
      ANSWER_TEXT,
      SCORE,
      FEEDBACK,
      SUBMITTED_AT
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP())
  `;
  return query(sql, [
    userId,
    questionId,
    audioUrl || null,
    answerText || null,
    score !== undefined ? score : null,
    feedback || null
  ]);
}

module.exports = { findByCategory, listSections, findById, submitAnswer };
