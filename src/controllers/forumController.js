const forumService = require("../services/forumService");

async function listPosts(req, res, next) {
  try {
    const userId = req.user.id;
    const rows = await forumService.listPosts(userId);
    
    // Map the database rows to the camelCase keys and structure expected by the frontend
    const posts = rows.map(r => {
      // Calculate timeAgo
      let timeAgo = "Just now";
      if (r.CREATED_AT) {
        const diffMs = Date.now() - new Date(r.CREATED_AT).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);
        
        if (diffDays > 0) {
          timeAgo = diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
        } else if (diffHrs > 0) {
          timeAgo = diffHrs === 1 ? "1 hour ago" : `${diffHrs} hours ago`;
        } else if (diffMins > 0) {
          timeAgo = diffMins === 1 ? "1 minute ago" : `${diffMins} minutes ago`;
        }
      }

      const authorName = r.AUTHOR_NAME || "PTE Student";
      const avatarUrl = r.AUTHOR_AVATAR || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(r.AUTHOR_EMAIL || authorName)}`;

      return {
        id: r.ID,
        title: r.TITLE,
        content: r.CONTENT,
        category: r.CATEGORY,
        likes: r.LIKES || 0,
        replies: r.REPLIES || 0,
        views: r.VIEWS || 0,
        timeAgo: timeAgo,
        author: authorName,
        avatar: avatarUrl,
        isTrending: (r.VIEWS || 0) > 300 || (r.LIKES || 0) > 20,
        userLiked: r.USER_LIKED === 1
      };
    });

    return res.json(posts);
  } catch (err) {
    next(err);
  }
}

async function createPost(req, res, next) {
  try {
    const userId = req.user.id;
    const { title, content, category } = req.body;
    
    if (!title || !content || !category) {
      return res.status(400).json({ message: "title, content, and category are required" });
    }

    await forumService.createPost(userId, { title, content, category });
    return res.status(201).json({ message: "Post created successfully" });
  } catch (err) {
    next(err);
  }
}

async function toggleLike(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: postId } = req.params;
    
    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    const result = await forumService.toggleLike(userId, postId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getForumStats(req, res, next) {
  try {
    const stats = await forumService.getForumStats();
    return res.json(stats);
  } catch (err) {
    next(err);
  }
}

async function listReplies(req, res, next) {
  try {
    const { id: postId } = req.params;
    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }
    
    const rows = await forumService.listReplies(postId);
    const replies = rows.map(r => {
      let timeAgo = "Just now";
      if (r.CREATED_AT) {
        const diffMs = Date.now() - new Date(r.CREATED_AT).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHrs / 24);
        
        if (diffDays > 0) {
          timeAgo = diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
        } else if (diffHrs > 0) {
          timeAgo = diffHrs === 1 ? "1 hour ago" : `${diffHrs} hours ago`;
        } else if (diffMins > 0) {
          timeAgo = diffMins === 1 ? "1 minute ago" : `${diffMins} minutes ago`;
        }
      }

      const authorName = r.AUTHOR_NAME || "PTE Student";
      const avatarUrl = r.AUTHOR_AVATAR || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(r.AUTHOR_EMAIL || authorName)}`;

      return {
        id: r.ID,
        postId: r.POST_ID,
        userId: r.USER_ID,
        content: r.CONTENT,
        author: authorName,
        avatar: avatarUrl,
        timeAgo
      };
    });

    return res.json(replies);
  } catch (err) {
    next(err);
  }
}

async function createReply(req, res, next) {
  try {
    const userId = req.user.id;
    const { id: postId } = req.params;
    const { content } = req.body;

    if (!postId || !content || !content.trim()) {
      return res.status(400).json({ message: "Post ID and content are required" });
    }

    const result = await forumService.createReply(userId, postId, content);
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function incrementView(req, res, next) {
  try {
    const { id: postId } = req.params;
    if (!postId) {
      return res.status(400).json({ message: "Post ID is required" });
    }

    const result = await forumService.incrementPostViews(postId);
    return res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { 
  listPosts, 
  createPost, 
  toggleLike, 
  getForumStats, 
  listReplies, 
  createReply, 
  incrementView 
};
