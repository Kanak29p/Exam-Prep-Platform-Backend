const express = require("express");
const verifyToken = require("../middleware/authMiddleware");
const ctrl = require("../controllers/forumController");

const router = express.Router();

router.get("/stats", verifyToken, ctrl.getForumStats);
router.get("/posts", verifyToken, ctrl.listPosts);
router.post("/posts", verifyToken, ctrl.createPost);
router.post("/posts/:id/like", verifyToken, ctrl.toggleLike);
router.get("/posts/:id/replies", verifyToken, ctrl.listReplies);
router.post("/posts/:id/replies", verifyToken, ctrl.createReply);
router.post("/posts/:id/view", verifyToken, ctrl.incrementView);

module.exports = router;
