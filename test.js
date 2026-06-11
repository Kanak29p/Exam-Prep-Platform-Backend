const express = require("express");
require("dotenv").config();
const env = require("./src/config/env");
require("./src/db/snowflake");

const authRoutes = require("./src/routes/authRoutes");
const questionRoutes = require("./src/routes/questionRoutes");
const mockTestRoutes = require("./src/routes/mockTestRoutes");
const forumRoutes = require("./src/routes/forumRoutes");
const notificationRoutes = require("./src/routes/notificationRoutes");

const app = express();

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/mock-tests", mockTestRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/notifications", notificationRoutes);

app.listen(5002, "0.0.0.0", () => {
  console.log("Listening on 5002...");
});

process.on('exit', (code) => console.log('test.js exiting with code', code));
