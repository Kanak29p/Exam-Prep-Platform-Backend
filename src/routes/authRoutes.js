const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const ctrl = require("../controllers/authController");

const router = express.Router();

router.put("/profile", verifyToken, ctrl.updateProfile);
router.post("/login", ctrl.login);
router.post("/signup", ctrl.signup);
router.get("/dashboard", verifyToken, ctrl.dashboard);
router.get("/students", verifyToken, ctrl.listStudents);

module.exports = router;
