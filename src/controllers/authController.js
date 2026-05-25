const jwt = require("jsonwebtoken");
const admin = require("../config/firebaseAdmin");
const env = require("../config/env");
const userService = require("../services/userService");

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

function dashboard(req, res) {
  res.json({
    message: "Welcome to dashboard",
    user: req.user,
  });
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
