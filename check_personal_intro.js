const { query } = require("./src/db/snowflake");

async function check() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    const configRows = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG WHERE LOWER(TYPE) LIKE '%personal%'");
    console.log("Personal type CONFIG:", configRows);

    const qCount = await query(`
      SELECT COUNT(*) AS COUNT
      FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS q
      JOIN PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG c ON q.QUESTION_TYPE_ID = c.ID
      WHERE LOWER(c.TYPE) LIKE '%personal%'
    `);
    console.log("Personal questions count:", qCount);
  } catch (err) {
    console.error("Failed:", err);
  }
}

check();
