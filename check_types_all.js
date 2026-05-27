const { query, connection } = require("./src/db/snowflake");

async function run() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    const rows = await query("SELECT ID, CATEGORY, TYPE FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG ORDER BY ID ASC");
    console.log("ALL CONFIG ROWS:", rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    connection.destroy(() => process.exit(0));
  }
}

run();
