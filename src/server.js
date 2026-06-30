const express = require("express");
const cors = require("cors");
const path = require("path");

const env = require("./config/env");
require("./db/snowflake");

const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const mockTestRoutes = require("./routes/mockTestRoutes");
const forumRoutes = require("./routes/forumRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const corsOptions = {
  origin(origin, callback) {
    // Allow same-origin / curl / mobile apps (no Origin header)
    if (!origin) return callback(null, true);
    if (env.corsOrigins.includes(origin)) return callback(null, true);
    // In dev, be lenient so port collisions don't break the developer flow.
    if (env.nodeEnv !== "production") return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
  res.send("Backend is running...");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    snowflake: env.snowflake.account ? "configured" : "disabled",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/mock-tests", mockTestRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

app.listen(env.port, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${env.port}`);
  console.log(`CORS allowed origins: ${env.corsOrigins.join(", ")}`);
});
