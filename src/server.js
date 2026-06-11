const express = require("express");
const cors = require("cors");

const originalExit = process.exit;
process.exit = function(code) {
  console.trace("process.exit called with code:", code);
  originalExit.call(process, code);
};


const env = require("./config/env");
// require("./db/snowflake");

const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const mockTestRoutes = require("./routes/mockTestRoutes");
const forumRoutes = require("./routes/forumRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend is running...");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/mock-tests", mockTestRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

const server = app.listen(5005, "0.0.0.0", () => {
  console.log(`Server running on port 5005`);
});

process.on('exit', (code) => {
  console.log('Process exiting with code:', code);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

