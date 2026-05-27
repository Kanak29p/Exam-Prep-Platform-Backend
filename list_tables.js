const { query, connection } = require("./src/db/snowflake");

async function run() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    const tables = await query("SHOW TABLES IN PTE_EXAM_PREP_PLATFORM.PUBLIC");
    console.log("TABLES:");
    tables.forEach(t => {
      console.log("- " + t.name);
    });
  } catch (err) {
    console.error("Error:", err);
  } finally {
    connection.destroy(() => process.exit(0));
  }
}

run();
