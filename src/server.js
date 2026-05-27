const express = require("express");
const cors = require("cors");

const env = require("./config/env");
require("./db/snowflake");

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

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Server running on port ${env.port}`);
});
