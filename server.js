const express = require("express");
const cors = require("cors");
require("dotenv").config();

require("./db/snowflake");

const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);

app.get("/", (req, res) => {
  res.send("Backend is running...");
});

// app.get("/test-db", async (req, res) => {
//   connection.execute({
//     sqlText: "SELECT CURRENT_TIMESTAMP()",
//     complete: (err, stmt, rows) => {
//       if (err) return res.status(500).json(err);
//       res.json(rows);
//     }
//   });
// });

const PORT = process.env.PORT || 5000;



app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

