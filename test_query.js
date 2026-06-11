const { connection, query } = require("./src/db/snowflake");

setTimeout(async () => {
  try {
    const tests = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS");
    console.log("MOCK TESTS:");
    console.log(JSON.stringify(tests, null, 2));

    const patterns = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN");
    console.log("MOCK TEST PATTERNS:");
    console.log(JSON.stringify(patterns, null, 2));

    connection.destroy(() => process.exit(0));
  } catch (err) {
    console.error("Query failed:", err.message);
    process.exit(1);
  }
}, 2000);
