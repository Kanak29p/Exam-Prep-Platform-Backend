const snowflake = require("snowflake-sdk");
const { snowflake: cfg } = require("../config/env");

const connection = snowflake.createConnection({
  account: cfg.account,
  username: cfg.username,
  password: cfg.password,
  warehouse: cfg.warehouse,
  database: cfg.database,
  schema: cfg.schema,
});

connection.connect((err) => {
  if (err) {
    console.error("Unable to connect to Snowflake:", err.message);
  } else {
    console.log("Connected to Snowflake!");
  }
});

// Promise wrapper around the callback-style execute API.
function query(sqlText, binds = []) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      },
    });
  });
}

module.exports = { connection, query };
