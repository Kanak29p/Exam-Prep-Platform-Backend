const { query, connection } = require("./src/db/snowflake");

async function run() {
  await new Promise(resolve => setTimeout(resolve, 3000));
  try {
    console.log("Creating MOCK_TEST_ATTEMPTS table in Snowflake...");
    await query(`
      CREATE TABLE IF NOT EXISTS PTE_EXAM_PREP_PLATFORM.PUBLIC.MOCK_TEST_ATTEMPTS (
        ID VARCHAR(255) PRIMARY KEY,
        USER_ID VARCHAR(255),
        MOCK_TEST_ID NUMBER,
        STATUS VARCHAR(50),
        CURRENT_QUESTION_INDEX NUMBER,
        TIME_REMAINING NUMBER,
        QUESTIONS TEXT,
        GRADES TEXT,
        OVERALL_SCORE NUMBER,
        SPEAKING_SCORE NUMBER,
        WRITING_SCORE NUMBER,
        READING_SCORE NUMBER,
        LISTENING_SCORE NUMBER,
        CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
        UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
      )
    `);
    console.log("MOCK_TEST_ATTEMPTS table created successfully!");
  } catch (err) {
    console.error("Error creating table:", err);
  } finally {
    connection.destroy(() => process.exit(0));
  }
}

run();
