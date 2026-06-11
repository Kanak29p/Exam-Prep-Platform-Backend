const connection = require("./db/snowflake");

setTimeout(() => {
  const query = `DESCRIBE TABLE PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS`;

  connection.execute({
    sqlText: query,
    complete: function (err, stmt, rows) {
      if (err) {
        console.error("Query failed:", err.message);
        process.exit(1);
      }
      console.log("Table columns:");
      rows.forEach(r => console.log(`- ${r.name} (${r.type})`));
      process.exit(0);
    }
  });
}, 2000);
