const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");
const ctrl = require("../controllers/questionController");

// Ensure uploads directory exists at project root
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup multer disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname || ".mp3"));
  }
});

const upload = multer({ storage });

const router = express.Router();

router.get("/", verifyToken, ctrl.listQuestions);
router.get("/sections", verifyToken, ctrl.listSections);
router.get("/question/:id", verifyToken, ctrl.getQuestionById);
router.post("/submit", verifyToken, ctrl.submitAnswer);

router.post("/upload", verifyToken, upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  // Construct standard HTTP URL pointing to the static endpoint
  const protocol = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  return res.status(200).json({
    message: "File uploaded successfully",
    url: fileUrl
  });
});

router.post("/", verifyToken, verifyAdmin, ctrl.createQuestion);
router.put("/:id", verifyToken, verifyAdmin, ctrl.updateQuestion);
router.delete("/:id", verifyToken, verifyAdmin, ctrl.deleteQuestion);

module.exports = router;
