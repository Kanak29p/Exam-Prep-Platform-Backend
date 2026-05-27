const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const ctrl = require("../controllers/notificationController");

const router = express.Router();

router.post("/token", verifyToken, ctrl.registerToken);
router.post("/test-trigger", verifyToken, ctrl.testTrigger);
router.post("/cron-trigger", verifyToken, ctrl.simulateCronTrigger);
router.post("/send-all", verifyToken, ctrl.sendBroadcastNotification);
router.get("/subscribers-count", verifyToken, ctrl.getSubscribersCount);

module.exports = router;
