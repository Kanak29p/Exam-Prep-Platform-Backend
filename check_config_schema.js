const { query, connection } = require("./src/db/snowflake");

async function run() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    console.log("Describing QUESTION_TYPE_CONFIG...");
    const desc = await query("DESCRIBE TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG");
    console.log("SCHEMA:", desc);

    console.log("Querying first few rows from QUESTION_TYPE_CONFIG...");
    const rows = await query("SELECT * FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG LIMIT 5");
    console.log("ROWS:", rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    connection.destroy(() => process.exit(0));
  }
}

run();
