const { connection, query } = require("./src/db/snowflake");

setTimeout(async () => {
  try {
    // Check if test 2 already exists
    const existing2 = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS WHERE ID = 2");
    if (existing2.length === 0) {
      console.log("Inserting Mock Test #2...");
      await query(`
        INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS (ID, TITLE, DESCRIPTION, TOTAL_QUESTIONS, TOTAL_DURATION_MINUTES, STATUS, CREATED_AT)
        VALUES (2, 'PTE Academic Mock Test #2', 'A full-length mock test covering Speaking, Writing, Reading, and Listening.', 90, 120, 'active', CURRENT_TIMESTAMP())
      `);
      console.log("Mock Test #2 inserted!");
    } else {
      console.log("Mock Test #2 already exists.");
    }

    // Check if test 3 already exists
    const existing3 = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS WHERE ID = 3");
    if (existing3.length === 0) {
      console.log("Inserting Mock Test #3...");
      await query(`
        INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS (ID, TITLE, DESCRIPTION, TOTAL_QUESTIONS, TOTAL_DURATION_MINUTES, STATUS, CREATED_AT)
        VALUES (3, 'PTE Academic Mock Test #3', 'A full-length mock test covering Speaking, Writing, Reading, and Listening.', 90, 120, 'active', CURRENT_TIMESTAMP())
      `);
      console.log("Mock Test #3 inserted!");
    } else {
      console.log("Mock Test #3 already exists.");
    }

    // Insert patterns for test 2
    const existingPatterns2 = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN WHERE MOCK_TEST_ID = 2");
    if (existingPatterns2.length === 0) {
      console.log("Inserting patterns for Mock Test #2...");
      // Copy patterns from mock test #1
      const patterns1 = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN WHERE MOCK_TEST_ID = 1");
      let nextPatternId = (await query("SELECT COALESCE(MAX(ID), 0) + 1 AS NEXT_ID FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN"))[0].NEXT_ID || 1;
      for (const p of patterns1) {
        await query(`
          INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN (ID, MOCK_TEST_ID, CATEGORY, SUB_CATEGORY, MIN_QUESTIONS, MAX_QUESTIONS)
          VALUES (?, 2, ?, ?, ?, ?)
        `, [nextPatternId++, p.CATEGORY, p.SUB_CATEGORY, p.MIN_QUESTIONS, p.MAX_QUESTIONS]);
      }
      console.log("Patterns for Mock Test #2 inserted successfully!");
    } else {
      console.log("Patterns for Mock Test #2 already exist.");
    }

    // Insert patterns for test 3
    const existingPatterns3 = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN WHERE MOCK_TEST_ID = 3");
    if (existingPatterns3.length === 0) {
      console.log("Inserting patterns for Mock Test #3...");
      const patterns1 = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN WHERE MOCK_TEST_ID = 1");
      let nextPatternId = (await query("SELECT COALESCE(MAX(ID), 0) + 1 AS NEXT_ID FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN"))[0].NEXT_ID || 1;
      for (const p of patterns1) {
        await query(`
          INSERT INTO PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN (ID, MOCK_TEST_ID, CATEGORY, SUB_CATEGORY, MIN_QUESTIONS, MAX_QUESTIONS)
          VALUES (?, 3, ?, ?, ?, ?)
        `, [nextPatternId++, p.CATEGORY, p.SUB_CATEGORY, p.MIN_QUESTIONS, p.MAX_QUESTIONS]);
      }
      console.log("Patterns for Mock Test #3 inserted successfully!");
    } else {
      console.log("Patterns for Mock Test #3 already exist.");
    }

    connection.destroy(() => process.exit(0));
  } catch (err) {
    console.error("Query failed:", err.message);
    process.exit(1);
  }
}, 2000);
