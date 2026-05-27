const { query } = require("./src/db/snowflake");

async function test() {
  // Wait for 3 seconds to let connection establish
  console.log("Waiting for connection...");
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    console.log("Checking MOCK_TESTS table...");
    const tests = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TESTS");
    console.log("MOCK_TESTS:", tests);

    console.log("Checking MOCK_TEST_PATTERN table...");
    const patterns = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_PATTERN LIMIT 5");
    console.log("MOCK_TEST_PATTERN:", patterns);
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
