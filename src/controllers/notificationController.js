const notificationService = require("../services/notificationService");

async function registerToken(req, res, next) {
  try {
    const userId = req.user.id;
    const { token, deviceType } = req.body;

    if (!token) {
      return res.status(400).json({ message: "token is required" });
    }

    await notificationService.registerToken(userId, token, deviceType || "web");
    return res.status(200).json({ message: "Token registered successfully" });
  } catch (err) {
    next(err);
  }
}

async function testTrigger(req, res, next) {
  try {
    const userId = req.user.id;
    const { scenarioType } = req.body;

    if (!scenarioType) {
      return res.status(400).json({ message: "scenarioType is required" });
    }

    const result = await notificationService.triggerNotificationScenario(userId, scenarioType);
    return res.status(200).json({ message: `Scenario '${scenarioType}' triggered`, result });
  } catch (err) {
    next(err);
  }
}

async function simulateCronTrigger(req, res, next) {
  try {
    const { reminderType } = req.body; // 'daily_practice', 'mock_test', or 'exam_countdown'

    if (!reminderType) {
      return res.status(400).json({ message: "reminderType is required ('daily_practice', 'mock_test', 'exam_countdown')" });
    }

    let title = "";
    let body = "";

    if (reminderType === "daily_practice") {
      title = "Practice Reminder! 📝";
      body = "Don't break your streak! Spend 10 minutes practicing modules today.";
    } else if (reminderType === "mock_test") {
      title = "Mock Test Reminder ⏰";
      body = "You have scheduled tests waiting. Attempt a mock test now to check your readiness.";
    } else if (reminderType === "exam_countdown") {
      title = "Exam Prep Alert! ⏳";
      body = "Your exam is approaching quickly. Review your dashboard and complete a practice test.";
    } else {
      title = "Daily Study Tip 💡";
      body = "Consistent preparation is key to achieving a 79+ score in PTE. Start practicing!";
    }

    const result = await notificationService.sendNotificationToAll({
      title,
      body,
      data: { cronReminder: reminderType, url: "/dashboard" }
    });

    return res.status(200).json({ message: `Cron reminder '${reminderType}' dispatched to all active devices`, result });
  } catch (err) {
    next(err);
  }
}

async function sendBroadcastNotification(req, res, next) {
  try {
    const role = req.user.role;
    if (role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const { title, body, url } = req.body;
    if (!title || !body) {
      return res.status(400).json({ message: "title and body are required" });
    }

    const result = await notificationService.sendNotificationToAll({
      title,
      body,
      data: { url: url || "/dashboard" }
    });

    return res.status(200).json({ message: "Broadcast notification sent to all active devices", result });
  } catch (err) {
    next(err);
  }
}

async function getSubscribersCount(req, res, next) {
  try {
    const role = req.user.role;
    if (role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const count = await notificationService.getSubscriberCount();
    return res.status(200).json({ count });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerToken,
  testTrigger,
  simulateCronTrigger,
  sendBroadcastNotification,
  getSubscribersCount
};
