const { query } = require("../db/snowflake");
const admin = require("../config/firebaseAdmin");

const TOKENS_TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.USER_FCM_TOKENS";
const USER_TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS";

async function registerToken(userId, token, deviceType = "web") {
  // Check if token exists for this user
  const rows = await query(`SELECT * FROM ${TOKENS_TABLE} WHERE USER_ID = ? AND TOKEN = ?`, [String(userId), token]);
  if (rows.length === 0) {
    await query(`INSERT INTO ${TOKENS_TABLE} (USER_ID, TOKEN, DEVICE_TYPE) VALUES (?, ?, ?)`, [String(userId), token, deviceType]);
    console.log(`[FCM] Registered token for user ${userId}`);
  }

  // Subscribe to 'all_users' topic for broadcasting admin notifications
  if (typeof admin.messaging === "function") {
    try {
      await admin.messaging().subscribeToTopic([token], "all_users");
      console.log(`[FCM] Subscribed token to 'all_users' topic`);
    } catch (err) {
      console.error(`[FCM] Failed to subscribe token to 'all_users' topic:`, err.message);
    }
  }

  return { success: true };
}

async function getSubscriberCount() {
  const rows = await query(`
    SELECT COUNT(DISTINCT t.TOKEN) AS COUNT 
    FROM ${TOKENS_TABLE} t
    JOIN ${USER_TABLE} u ON t.USER_ID = u.ID
    WHERE u.ROLE = 'student'
  `);
  return Number(rows[0]?.COUNT || 0);
}

async function removeFcmToken(token) {
  await query(`DELETE FROM ${TOKENS_TABLE} WHERE TOKEN = ?`, [token]);
  console.log(`[FCM] Deleted invalid token from DB`);
}

async function sendPushNotification(tokens, { title, body, data }) {
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };

  if (typeof admin.messaging !== "function") {
    console.warn(`[FCM Mock] Firebase messaging is not ready. Logged notification to ${tokens.length} devices:`, { title, body, data });
    return { successCount: tokens.length, failureCount: 0, mock: true };
  }

  // Format message payload for sendEachForMulticast
  const message = {
    tokens: tokens,
    notification: {
      title,
      body,
    },
    data: data || {},
    webpush: {
      notification: {
        icon: "/logo.png",
        badge: "/logo.png",
        click_action: "http://localhost:5173/dashboard"
      }
    }
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[FCM] Multicast stats: Success=${response.successCount}, Failure=${response.failureCount}`);

    // Clean up expired or invalid tokens
    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            console.log(`[FCM] Cleaning up invalid token index ${idx}`);
            removeFcmToken(tokens[idx]).catch(err => console.error(err));
          }
        }
      });
    }
    return { successCount: response.successCount, failureCount: response.failureCount };
  } catch (err) {
    console.error("[FCM] Error sending multicast notifications:", err);
    throw err;
  }
}

async function sendNotificationToUser(userId, { title, body, data }) {
  const rows = await query(`SELECT TOKEN FROM ${TOKENS_TABLE} WHERE USER_ID = ?`, [String(userId)]);
  const tokens = rows.map(r => r.TOKEN);
  return sendPushNotification(tokens, { title, body, data });
}

async function sendNotificationToAll({ title, body, data }) {
  const rows = await query(`
    SELECT DISTINCT t.TOKEN 
    FROM ${TOKENS_TABLE} t
    JOIN ${USER_TABLE} u ON t.USER_ID = u.ID
    WHERE u.ROLE = 'student'
  `);
  const tokens = rows.map(r => r.TOKEN);
  return sendPushNotification(tokens, { title, body, data });
}

async function triggerNotificationScenario(userId, scenarioType) {
  // Fetch user information
  const userRows = await query(`SELECT NAME, EXAM_DATE FROM ${USER_TABLE} WHERE ID = ?`, [String(userId)]);
  const user = userRows[0] || { NAME: "Student" };
  const userName = user.NAME || "Student";

  let title = "";
  let body = "";
  let data = { scenario: scenarioType };

  switch (scenarioType) {
    case "daily_practice":
      title = "Daily Practice Reminder 📝";
      body = `Hi ${userName}, it's time for your daily PTE practice! Spend 15 minutes today on Speaking or Writing.`;
      data.url = "/practice";
      break;

    case "mock_test":
      title = "Mock Test Reminder ⏰";
      body = `Hi ${userName}, don't forget to attempt your pending mock tests to assess your current score!`;
      data.url = "/mock-tests";
      break;

    case "new_questions":
      title = "New Questions Added! 🚀";
      body = "Fresh Speaking & Writing questions have been uploaded to the database. Test your skills now!";
      data.url = "/practice";
      break;

    case "practice_streak":
      title = "Practice Streak Active! 🔥";
      body = `Awesome job, ${userName}! You're on a 5-day continuous practice streak. Keep it up!`;
      data.url = "/dashboard";
      break;

    case "performance_progress":
      title = "Milestone Achieved! 🏆";
      body = "Congratulations! You have completed 10 practice modules this week and improved your accuracy.";
      data.url = "/dashboard";
      break;

    case "exam_countdown":
      let days = 7;
      if (user.EXAM_DATE) {
        const diffTime = new Date(user.EXAM_DATE).getTime() - Date.now();
        days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      title = "Exam Countdown! ⏳";
      body = days > 0 
        ? `Only ${days} days left until your PTE Exam on ${new Date(user.EXAM_DATE).toLocaleDateString()}. Make every day count!`
        : `Your PTE exam is upcoming! Ready to take a final mock test?`;
      data.url = "/mock-tests";
      break;

    case "module_completion":
      title = "Module Completed! ✅";
      body = `Great effort! You finished the Read Aloud module. Check your score and AI feedback now.`;
      data.url = "/dashboard";
      break;

    default:
      title = "PTE Master Notification";
      body = "Keep practicing to achieve your target PTE score!";
      data.url = "/dashboard";
  }

  return sendNotificationToUser(userId, { title, body, data });
}

module.exports = {
  registerToken,
  getSubscriberCount,
  removeFcmToken,
  sendPushNotification,
  sendNotificationToUser,
  sendNotificationToAll,
  triggerNotificationScenario
};
