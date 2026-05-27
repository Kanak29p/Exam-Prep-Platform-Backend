const { query } = require("./src/db/snowflake");

async function test() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    // 1. Insert a default mock test if none exists
    const tests = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS");
    if (tests.length === 0) {
      console.log("Inserting default mock test...");
      await query(`
        INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS 
        (ID, TITLE, DESCRIPTION, TOTAL_QUESTIONS, TOTAL_DURATION_MINUTES, STATUS)
        VALUES (1, 'PTE Academic Mock Test #1', 'A full-length mock test covering Speaking, Writing, Reading, and Listening.', 90, 120, 'active')
      `);
      console.log("Inserted!");
    }

    // 2. Count questions in database
    console.log("Counting questions in database...");
    const counts = await query(`
      SELECT c.CATEGORY, c.TYPE AS SUB_CATEGORY, COUNT(*) AS Q_COUNT
      FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS q
      JOIN PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG c ON q.QUESTION_TYPE_ID = c.ID
      GROUP BY c.CATEGORY, c.TYPE
    `);
    console.log("Question counts in DB:", counts);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
