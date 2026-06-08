jest.mock("../../src/services/notificationService", () => ({
  registerToken: jest.fn(),
  triggerNotificationScenario: jest.fn(),
  sendNotificationToAll: jest.fn(),
  getSubscriberCount: jest.fn(),
}));

const notificationService = require("../../src/services/notificationService");
const {
  registerToken,
  testTrigger,
  simulateCronTrigger,
  sendBroadcastNotification,
  getSubscribersCount,
} = require("../../src/controllers/notificationController");

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// =====================================================================
// registerToken
// =====================================================================
describe("notificationController.registerToken", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("400 – missing token", async () => {
    await registerToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "token is required" });
  });

  test("200 – registers FCM token successfully", async () => {
    req.body = { token: "fcm-abc", deviceType: "android" };
    notificationService.registerToken.mockResolvedValueOnce(undefined);
    await registerToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Token registered successfully" });
    expect(notificationService.registerToken).toHaveBeenCalledWith("u1", "fcm-abc", "android");
  });

  test("defaults deviceType to 'web' when not provided", async () => {
    req.body = { token: "fcm-xyz" };
    notificationService.registerToken.mockResolvedValueOnce(undefined);
    await registerToken(req, res, next);
    expect(notificationService.registerToken).toHaveBeenCalledWith("u1", "fcm-xyz", "web");
  });

  test("calls next(err) on service failure", async () => {
    req.body = { token: "fcm-bad" };
    notificationService.registerToken.mockRejectedValueOnce(new Error("fail"));
    await registerToken(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// testTrigger
// =====================================================================
describe("notificationController.testTrigger", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("400 – missing scenarioType", async () => {
    await testTrigger(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "scenarioType is required" });
  });

  test("200 – triggers scenario successfully", async () => {
    req.body = { scenarioType: "mock_test_complete" };
    notificationService.triggerNotificationScenario.mockResolvedValueOnce({ sent: 3 });
    await testTrigger(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("mock_test_complete") })
    );
  });
});

// =====================================================================
// simulateCronTrigger
// =====================================================================
describe("notificationController.simulateCronTrigger", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("400 – missing reminderType", async () => {
    await simulateCronTrigger(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("reminderType is required") })
    );
  });

  test("200 – dispatches daily_practice reminder", async () => {
    req.body = { reminderType: "daily_practice" };
    notificationService.sendNotificationToAll.mockResolvedValueOnce({ sent: 10 });
    await simulateCronTrigger(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(notificationService.sendNotificationToAll).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Practice Reminder! 📝" })
    );
  });

  test("200 – dispatches mock_test reminder", async () => {
    req.body = { reminderType: "mock_test" };
    notificationService.sendNotificationToAll.mockResolvedValueOnce({ sent: 5 });
    await simulateCronTrigger(req, res, next);
    expect(notificationService.sendNotificationToAll).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Mock Test Reminder ⏰" })
    );
  });

  test("200 – dispatches exam_countdown reminder", async () => {
    req.body = { reminderType: "exam_countdown" };
    notificationService.sendNotificationToAll.mockResolvedValueOnce({ sent: 7 });
    await simulateCronTrigger(req, res, next);
    expect(notificationService.sendNotificationToAll).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Exam Prep Alert! ⏳" })
    );
  });
});

// =====================================================================
// sendBroadcastNotification (admin only)
// =====================================================================
describe("notificationController.sendBroadcastNotification", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { role: "admin" }, body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("403 – non-admin user denied", async () => {
    req.user.role = "student";
    await sendBroadcastNotification(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Admin access required" });
  });

  test("400 – missing title and body", async () => {
    await sendBroadcastNotification(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "title and body are required" });
  });

  test("200 – admin sends broadcast successfully", async () => {
    req.body = { title: "New Feature!", body: "Check out the new feature." };
    notificationService.sendNotificationToAll.mockResolvedValueOnce({ sent: 50 });
    await sendBroadcastNotification(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("Broadcast") })
    );
  });
});

// =====================================================================
// getSubscribersCount (admin only)
// =====================================================================
describe("notificationController.getSubscribersCount", () => {
  let req, res, next;
  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { role: "admin" } };
    res = makeRes();
    next = jest.fn();
  });

  test("403 – non-admin denied", async () => {
    req.user.role = "student";
    await getSubscribersCount(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("200 – returns subscriber count", async () => {
    notificationService.getSubscriberCount.mockResolvedValueOnce(42);
    await getSubscribersCount(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ count: 42 });
  });
});
