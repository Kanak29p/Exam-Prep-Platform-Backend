const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const env = require("../config/env");
const userService = require("../services/userService");
const { query } = require("../db/snowflake");

async function login(req, res, next) {
  try {
    const { firebaseToken } = req.body;
    if (!firebaseToken) {
      return res.status(400).json({ message: "firebaseToken is required" });
    }

    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (err) {
      return res.status(401).json({
        message: "Invalid Firebase token",
        error: err.message,
      });
    }

    const email = decodedToken.email;
    const user = await userService.findByEmail(email);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const role = user.ROLE || user.role;
    const token = jwt.sign(
      { email: user.EMAIL, id: user.ID, role },
      env.jwtSecret,
      { expiresIn: "7d" },
    );

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user.ID,
        name: user.NAME,
        email: user.EMAIL,
        role: user.ROLE,
        phone: user.PHONE || "",
        location: user.LOCATION || "",
        targetScore: user.TARGET_SCORE || 0,
        examDate: user.EXAM_DATE || "",
        bio: user.BIO || "",
        avatar: user.AVATAR || "",
        country: user.COUNTRY || "",
        state: user.STATE || "",
        city: user.CITY || "",
        plan: user.PLAN || "Free",
      },
    });
  } catch (err) {
    next(err);
  }
}

async function dashboard(req, res, next) {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: No user ID" });
    }

    // 1. Fetch user profile details
    const userRows = await query(
      `SELECT TARGET_SCORE, PLAN, JOINED, SCORE, NAME FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS WHERE ID = ?`,
      [userId]
    );
    const dbUser = userRows[0] || {};

    // 2. Fetch student responses with category info
    const responsesSql = `
      SELECT 
        r.SCORE,
        r.SUBMITTED_AT,
        c.CATEGORY,
        c.TYPE AS SUB_CATEGORY
      FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.STUDENT_RESPONSES r
      JOIN PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS q ON r.QUESTION_ID = q.ID
      JOIN PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_TYPE_CONFIG c ON q.QUESTION_TYPE_ID = c.ID
      WHERE r.USER_ID = ?
      ORDER BY r.SUBMITTED_AT ASC
    `;
    const responses = await query(responsesSql, [String(userId)]);

    // 3. Compute stats
    const totalResponses = responses.length;
    
    // Overall score = average of all response scores, or user's registered score, or 0
    let overallScore = 0;
    if (totalResponses > 0) {
      const sum = responses.reduce((acc, r) => acc + (r.SCORE || 0), 0);
      overallScore = Math.round(sum / totalResponses);
    } else if (dbUser.SCORE !== undefined && dbUser.SCORE !== null) {
      overallScore = dbUser.SCORE;
    }

    // Points Improved: Difference between latest score and earliest score (minimum of 0)
    let pointsImproved = 0;
    if (totalResponses > 1) {
      const earliestScore = responses[0].SCORE || 0;
      const latestScore = responses[totalResponses - 1].SCORE || 0;
      pointsImproved = Math.max(0, latestScore - earliestScore);
    }

    // Mock Tests Completed: Estimated as total responses divided by 3, capped at 15
    const mockTestsCompleted = totalResponses > 0 ? Math.min(15, Math.floor(totalResponses / 3)) : 0;

    // Practice Time: Estimated as 5 minutes per response, formatted as hours/minutes
    let practiceTime = "0m";
    if (totalResponses > 0) {
      const totalMinutes = totalResponses * 5;
      if (totalMinutes >= 60) {
        practiceTime = (totalMinutes / 60).toFixed(1) + "h";
      } else {
        practiceTime = totalMinutes + "m";
      }
    }

    // 4. Group score progress by date (for the LineChart)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const progressMap = {};
    responses.forEach(r => {
      if (r.SUBMITTED_AT) {
        const dateObj = new Date(r.SUBMITTED_AT);
        const month = monthNames[dateObj.getMonth()];
        const day = dateObj.getDate();
        const dateStr = `${month} ${day}`;
        if (!progressMap[dateStr]) {
          progressMap[dateStr] = { sum: 0, count: 0 };
        }
        progressMap[dateStr].sum += (r.SCORE || 0);
        progressMap[dateStr].count += 1;
      }
    });

    const scoreProgress = Object.keys(progressMap).map(dateStr => {
      return {
        date: dateStr,
        score: Math.round(progressMap[dateStr].sum / progressMap[dateStr].count)
      };
    });

    // 5. Calculate module-specific performance averages (for the BarChart)
    const moduleSum = { Speaking: 0, Writing: 0, Reading: 0, Listening: 0 };
    const moduleCount = { Speaking: 0, Writing: 0, Reading: 0, Listening: 0 };

    responses.forEach(r => {
      let cat = r.CATEGORY;
      const sub = r.SUB_CATEGORY || "";
      if (cat === "Speaking & Writing") {
        const lowerSub = sub.toLowerCase();
        if (lowerSub.includes("summarize written") || lowerSub.includes("essay")) {
          cat = "Writing";
        } else {
          cat = "Speaking";
        }
      }

      if (moduleSum[cat] !== undefined) {
        moduleSum[cat] += (r.SCORE || 0);
        moduleCount[cat] += 1;
      }
    });

    const modulePerformance = Object.keys(moduleSum).map(mod => {
      const avg = moduleCount[mod] > 0 ? Math.round(moduleSum[mod] / moduleCount[mod]) : 0;
      return {
        module: mod,
        score: avg
      };
    });

    // 6. Generate Skill Analysis radar scores based on module performance
    const speakingAvg = moduleCount["Speaking"] > 0 ? Math.round(moduleSum["Speaking"] / moduleCount["Speaking"]) : 0;
    const writingAvg = moduleCount["Writing"] > 0 ? Math.round(moduleSum["Writing"] / moduleCount["Writing"]) : 0;
    const readingAvg = moduleCount["Reading"] > 0 ? Math.round(moduleSum["Reading"] / moduleCount["Reading"]) : 0;
    const listeningAvg = moduleCount["Listening"] > 0 ? Math.round(moduleSum["Listening"] / moduleCount["Listening"]) : 0;

    const skillRadar = [
      { skill: "Pronunciation", score: speakingAvg || 0 },
      { skill: "Fluency", score: Math.round(speakingAvg * 0.95) || 0 },
      { skill: "Grammar", score: writingAvg || 0 },
      { skill: "Vocabulary", score: Math.round((writingAvg + readingAvg) / 2) || 0 },
      { skill: "Spelling", score: Math.round(writingAvg * 0.98) || 0 },
      { skill: "Content", score: Math.round((speakingAvg + writingAvg + readingAvg + listeningAvg) / 4) || 0 }
    ];

    // 7. Determine Weakest Module & Recommendations
    let recommendations = [];
    if (totalResponses === 0) {
      recommendations = [
        "Complete your first practice question to see AI recommendations.",
        "Focus on speaking fluency and clarity to improve oral output.",
        "Practice write from dictation under the listening section.",
        "Review essay templates and grammar for writing tasks."
      ];
    } else {
      const moduleAverages = {
        Speaking: speakingAvg,
        Writing: writingAvg,
        Reading: readingAvg,
        Listening: listeningAvg
      };

      let weakestModule = "Speaking";
      let minScore = Infinity;
      Object.keys(moduleAverages).forEach(m => {
        if (moduleAverages[m] < minScore) {
          minScore = moduleAverages[m];
          weakestModule = m;
        }
      });

      if (weakestModule === "Speaking") {
        recommendations = [
          "Focus on improving oral fluency by avoiding hesitations and self-corrections.",
          "Practice read aloud and repeat sentence to improve word-level pronunciation.",
          "Keep a steady speed and mimic native intonation during speaking responses.",
          "Increase speaking practice time by 20 minutes daily."
        ];
      } else if (weakestModule === "Writing") {
        recommendations = [
          "Work on essay structure, ensuring clear introduction, body paragraphs, and conclusion.",
          "Review spelling and grammar errors in summarize written text responses.",
          "Use a rich variety of vocabulary and correct transition words in sentences.",
          "Keep essays within the target word range (200-300 words)."
        ];
      } else if (weakestModule === "Reading") {
        recommendations = [
          "Practice more fill-in-the-blanks questions to build contextual reading skills.",
          "Improve your speed-reading and scanning techniques to manage time effectively.",
          "Expand your academic vocabulary and collocation knowledge.",
          "Review incorrect responses in re-order paragraphs to understand coherent flows."
        ];
      } else {
        recommendations = [
          "Increase listening practice time by 30 minutes daily using podcasts or lectures.",
          "Practice write from dictation to capture exact word sequences and spellings.",
          "Focus on summarizing spoken text by capturing key nouns and themes.",
          "Listen to different native English accents to build robust comprehension."
        ];
      }
    }

    return res.json({
      targetScore: dbUser.TARGET_SCORE || 0,
      plan: dbUser.PLAN || "Free",
      overallScore,
      pointsImproved,
      mockTestsCompleted,
      practiceTime,
      scoreProgress,
      modulePerformance,
      skillRadar,
      recommendations,
      user: {
        id: dbUser.ID,
        name: dbUser.NAME,
        plan: dbUser.PLAN || "Free",
        targetScore: dbUser.TARGET_SCORE || 0
      }
    });

  } catch (err) {
    next(err);
  }
}

async function signup(req, res, next) {
  try {
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ message: "name and email are required" });
    }

    const existing = await userService.findByEmail(email);
    if (existing) {
      return res.status(200).json({
        message: "User already exists",
        isNewUser: false,
      });
    }

    const id = Date.now().toString();
    const user = await userService.createStudent({ id, name, email });

    return res.status(201).json({
      message: "User created successfully",
      isNewUser: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

async function listStudents(req, res, next) {
  try {
    const students = await userService.listStudents();
    return res.json(students);
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, phone, location, targetScore, examDate, bio, avatar, country, state, city, plan } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await userService.updateProfile(userId, {
      name,
      phone,
      location,
      targetScore,
      examDate,
      bio,
      avatar,
      country,
      state,
      city,
      plan,
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Profile updated successfully",
      user: {
        id: user.ID,
        name: user.NAME,
        email: user.EMAIL,
        role: user.ROLE,
        phone: user.PHONE || "",
        location: user.LOCATION || "",
        targetScore: user.TARGET_SCORE || 0,
        examDate: user.EXAM_DATE || "",
        bio: user.BIO || "",
        avatar: user.AVATAR || "",
        country: user.COUNTRY || "",
        state: user.STATE || "",
        city: user.CITY || "",
        plan: user.PLAN || "Free",
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, dashboard, signup, listStudents, updateProfile };
