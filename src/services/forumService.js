const { query } = require("../db/snowflake");

const TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.FORUM_POSTS";
const USER_TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS";
const LIKES_TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.FORUM_LIKES";
const REPLIES_TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.FORUM_REPLIES";

async function listPosts(userId) {
  const sql = `
    SELECT 
      p.ID, 
      p.USER_ID, 
      p.TITLE, 
      p.CONTENT, 
      p.CATEGORY, 
      p.LIKES, 
      p.REPLIES, 
      p.VIEWS, 
      p.CREATED_AT,
      u.NAME AS AUTHOR_NAME, 
      u.EMAIL AS AUTHOR_EMAIL,
      u.AVATAR AS AUTHOR_AVATAR,
      CASE WHEN l.USER_ID IS NOT NULL THEN 1 ELSE 0 END AS USER_LIKED
    FROM ${TABLE} p
    LEFT JOIN ${USER_TABLE} u ON p.USER_ID = u.ID
    LEFT JOIN ${LIKES_TABLE} l ON p.ID = l.POST_ID AND l.USER_ID = ?
    ORDER BY p.CREATED_AT DESC
  `;
  return query(sql, [String(userId)]);
}

async function createPost(userId, { title, content, category }) {
  const sql = `
    INSERT INTO ${TABLE} (USER_ID, TITLE, CONTENT, CATEGORY)
    VALUES (?, ?, ?, ?)
  `;
  return query(sql, [String(userId), title, content, category]);
}

async function toggleLike(userId, postId) {
  // Check if already liked
  const rows = await query(`SELECT * FROM ${LIKES_TABLE} WHERE USER_ID = ? AND POST_ID = ?`, [String(userId), Number(postId)]);
  const alreadyLiked = rows.length > 0;

  if (alreadyLiked) {
    // Delete like row
    await query(`DELETE FROM ${LIKES_TABLE} WHERE USER_ID = ? AND POST_ID = ?`, [String(userId), Number(postId)]);
    // Decrement likes count
    await query(`UPDATE ${TABLE} SET LIKES = GREATEST(0, COALESCE(LIKES, 0) - 1) WHERE ID = ?`, [Number(postId)]);
    return { liked: false };
  } else {
    // Insert like row
    await query(`INSERT INTO ${LIKES_TABLE} (USER_ID, POST_ID) VALUES (?, ?)`, [String(userId), Number(postId)]);
    // Increment likes count
    await query(`UPDATE ${TABLE} SET LIKES = COALESCE(LIKES, 0) + 1 WHERE ID = ?`, [Number(postId)]);
    return { liked: true };
  }
}

async function getForumStats() {
  // Total Discussions
  const discussionsRes = await query(`SELECT COUNT(*) AS CNT FROM ${TABLE}`);
  const totalDiscussions = discussionsRes[0]?.CNT || 0;

  // Active Members (registered users in the platform)
  const membersRes = await query(`SELECT COUNT(*) AS CNT FROM ${USER_TABLE}`);
  const activeMembers = membersRes[0]?.CNT || 0;

  // Total Replies
  const repliesRes = await query(`SELECT COALESCE(SUM(REPLIES), 0) AS CNT FROM ${TABLE}`);
  const totalReplies = repliesRes[0]?.CNT || 0;

  // Total Views
  const viewsRes = await query(`SELECT COALESCE(SUM(VIEWS), 0) AS CNT FROM ${TABLE}`);
  const totalViews = viewsRes[0]?.CNT || 0;

  // Trending Topics - select top 4 posts by Views + 5 * Likes
  const trendingRes = await query(`
    SELECT TITLE 
    FROM ${TABLE} 
    ORDER BY (COALESCE(VIEWS, 0) + COALESCE(LIKES, 0) * 5) DESC, CREATED_AT DESC
    LIMIT 4
  `);
  const trendingTopics = trendingRes.map(r => r.TITLE);

  // Fallbacks if not enough posts are present
  const fallbacks = ['Speaking Tips', 'Mock Test Strategy', 'Essay Writing', 'Time Management'];
  while (trendingTopics.length < 4) {
    const nextFallback = fallbacks.find(f => !trendingTopics.includes(f));
    if (!nextFallback) break;
    trendingTopics.push(nextFallback);
  }

  return {
    totalDiscussions,
    activeMembers,
    totalReplies,
    totalViews,
    trendingTopics
  };
}

async function listReplies(postId) {
  const sql = `
    SELECT 
      r.ID, 
      r.POST_ID, 
      r.USER_ID, 
      r.CONTENT, 
      r.CREATED_AT,
      u.NAME AS AUTHOR_NAME,
      u.EMAIL AS AUTHOR_EMAIL,
      u.AVATAR AS AUTHOR_AVATAR
    FROM ${REPLIES_TABLE} r
    LEFT JOIN ${USER_TABLE} u ON r.USER_ID = u.ID
    WHERE r.POST_ID = ?
    ORDER BY r.CREATED_AT ASC
  `;
  return query(sql, [Number(postId)]);
}

async function createReply(userId, postId, content) {
  const insertSql = `
    INSERT INTO ${REPLIES_TABLE} (POST_ID, USER_ID, CONTENT)
    VALUES (?, ?, ?)
  `;
  await query(insertSql, [Number(postId), String(userId), content]);

  const updateSql = `
    UPDATE ${TABLE} 
    SET REPLIES = COALESCE(REPLIES, 0) + 1 
    WHERE ID = ?
  `;
  await query(updateSql, [Number(postId)]);
  return { success: true };
}

async function incrementPostViews(postId) {
  const sql = `
    UPDATE ${TABLE} 
    SET VIEWS = COALESCE(VIEWS, 0) + 1 
    WHERE ID = ?
  `;
  await query(sql, [Number(postId)]);
  return { success: true };
}

module.exports = { 
  listPosts, 
  createPost, 
  toggleLike, 
  getForumStats, 
  listReplies, 
  createReply, 
  incrementPostViews 
};
