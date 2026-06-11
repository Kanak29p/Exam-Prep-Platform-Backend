const { connection, query } = require("../src/db/snowflake");

setTimeout(async () => {
  try {
    console.log("Adding columns...");
    await query(`ALTER TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS ADD COLUMN PHONE VARCHAR(30)`);
    await query(`ALTER TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS ADD COLUMN LOCATION VARCHAR(100)`);
    await query(`ALTER TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS ADD COLUMN TARGET_SCORE NUMBER(38,0)`);
    await query(`ALTER TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS ADD COLUMN EXAM_DATE DATE`);
    await query(`ALTER TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS ADD COLUMN BIO VARCHAR(1000)`);
    await query(`ALTER TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS ADD COLUMN AVATAR VARCHAR(1000)`);
    console.log("Columns added successfully!");
    connection.destroy(() => process.exit(0));
  } catch (err) {
    console.error("Query failed:", err.message);
    process.exit(1);
  }
}, 2000);
