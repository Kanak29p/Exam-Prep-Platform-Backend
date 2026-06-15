const { connection, query } = require("./src/db/snowflake");

setTimeout(async () => {
  try {
    console.log("Updating Read Aloud questions to set AUDIO_URL to NULL...");
    const result = await query(`
      UPDATE PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
      SET AUDIO_URL = NULL 
      WHERE QUESTION_TYPE_ID IN (
        SELECT ID FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG 
        WHERE LOWER(TRIM(TYPE)) = 'read aloud'
      )
    `);
    
    console.log("Update successful. Result:", result);

    connection.destroy(() => process.exit(0));
  } catch (err) {
    console.error("Query failed:", err.message);
    process.exit(1);
  }
}, 2000);
