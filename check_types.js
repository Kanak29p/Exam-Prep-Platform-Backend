const { query } = require("./src/db/snowflake");

async function check() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    const configRows = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG");
    console.log("All question types in CONFIG:", configRows);
  } catch (err) {
    console.error("Failed:", err);
  }
}

check();
