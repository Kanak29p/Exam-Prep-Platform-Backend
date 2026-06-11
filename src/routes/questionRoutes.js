const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const verifyAdmin = require("../middleware/adminMiddleware");
const ctrl = require("../controllers/questionController");

const router = express.Router();

router.get("/", verifyToken, ctrl.listQuestions);
router.get("/sections", verifyToken, ctrl.listSections);
router.get("/question/:id", verifyToken, ctrl.getQuestionById);
router.post("/submit", verifyToken, ctrl.submitAnswer);

router.post("/", verifyToken, verifyAdmin, ctrl.createQuestion);
router.put("/:id", verifyToken, verifyAdmin, ctrl.updateQuestion);
router.delete("/:id", verifyToken, verifyAdmin, ctrl.deleteQuestion);

module.exports = router;
