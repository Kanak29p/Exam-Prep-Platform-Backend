const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const ctrl = require("../controllers/mockTestController");

const router = express.Router();

router.get("/", verifyToken, ctrl.listMockTests);
router.get("/attempts", verifyToken, ctrl.listMockTestAttempts);
router.post("/attempts/:id/start", verifyToken, ctrl.startMockTestAttempt);
router.put("/attempts/:id/progress", verifyToken, ctrl.updateAttemptProgress);
router.post("/attempts/:id/submit", verifyToken, ctrl.submitMockTestAttempt);
router.get("/:id", verifyToken, ctrl.getMockTestById);
router.get("/:id/questions", verifyToken, ctrl.getQuestionsForMockTest);

module.exports = router;
