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

async function listSections() {
  const sql = `
    SELECT DISTINCT CATEGORY, TYPE AS SUB_CATEGORY
    FROM ${CONFIG_TABLE}
    ORDER BY CATEGORY, SUB_CATEGORY
  `;
  const rows = await query(sql);
  return rows.map((r) => {
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
    if (row.CATEGORY === "Speaking & Writing") {
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

module.exports = { findByCategory, listSections, findById };
