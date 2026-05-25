const { query } = require("../db/snowflake");

const TABLE = "PTE_EXAM_PREP_PLATFORM.PUBLIC.USERDETAILS";

async function findByEmail(email) {
  const rows = await query(`SELECT * FROM ${TABLE} WHERE EMAIL = ?`, [email]);
  return rows[0] || null;
}

async function createStudent({ id, name, email }) {
  const sql = `
    INSERT INTO ${TABLE} (ID, NAME, EMAIL, ROLE)
    VALUES (?, ?, ?, 'student')
  `;
  await query(sql, [id, name, email]);
  return { id, name, email, role: "student" };
}

async function listStudents() {
  const rows = await query(
    `SELECT ID, NAME, EMAIL, ROLE, SCORE, PLAN, STATUS, JOINED, PHONE, LOCATION, TARGET_SCORE, EXAM_DATE, BIO, AVATAR, COUNTRY, STATE, CITY
     FROM ${TABLE}
     WHERE ROLE = 'student'`,
  );
  return rows.map((r) => ({
    id: r.ID,
    name: r.NAME || "",
    email: r.EMAIL || "",
    role: r.ROLE || "",
    score: r.SCORE || 0,
    plan: r.PLAN || "Free",
    status: r.STATUS || "inactive",
    joined: r.JOINED || null,
    phone: r.PHONE || "",
    location: r.LOCATION || "",
    targetScore: r.TARGET_SCORE || 0,
    examDate: r.EXAM_DATE || "",
    bio: r.BIO || "",
    avatar: r.AVATAR || "",
    country: r.COUNTRY || "",
    state: r.STATE || "",
    city: r.CITY || "",
  }));
}

async function updateProfile(id, { name, phone, location, targetScore, examDate, bio, avatar, country, state, city, plan }) {
  const sql = `
    UPDATE ${TABLE}
    SET NAME = ?, PHONE = ?, LOCATION = ?, TARGET_SCORE = ?, EXAM_DATE = ?, BIO = ?, AVATAR = ?, COUNTRY = ?, STATE = ?, CITY = ?, PLAN = ?
    WHERE ID = ?
  `;
  const dbExamDate = examDate ? examDate : null;
  const dbTargetScore = isNaN(parseInt(targetScore)) ? null : parseInt(targetScore);

  await query(sql, [name, phone, location, dbTargetScore, dbExamDate, bio, avatar, country, state, city, plan, id]);

  const rows = await query(`SELECT * FROM ${TABLE} WHERE ID = ?`, [id]);
  return rows[0] || null;
}

module.exports = { findByEmail, createStudent, listStudents, updateProfile };
