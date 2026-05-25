const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const ctrl = require("../controllers/questionController");

const router = express.Router();

router.get("/", verifyToken, ctrl.listQuestions);
router.get("/sections", verifyToken, ctrl.listSections);
router.get("/question/:id", verifyToken, ctrl.getQuestionById);
router.post("/submit", verifyToken, ctrl.submitAnswer);

module.exports = router;
