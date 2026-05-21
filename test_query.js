const connection = require("./db/snowflake");

setTimeout(() => {
  const query = `
    SELECT CATEGORY, SUB_CATEGORY, COUNT(*) AS Q_COUNT
    FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS 
    GROUP BY CATEGORY, SUB_CATEGORY
    ORDER BY CATEGORY, SUB_CATEGORY
  `;

  connection.execute({
    sqlText: query,
    complete: function (err, stmt, rows) {
      if (err) {
        console.error("Query failed:", err.message);
        process.exit(1);
      }
      console.log("Database Subcategory Counts:", rows);
      process.exit(0);
    }
  });
}, 2000);

