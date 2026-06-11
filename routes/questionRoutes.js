const express = require("express");
const router = express.Router();

const connection = require("../db/snowflake");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/authMiddleware");


router.get("/", verifyToken, (req, res) => {
  let { category, subCategory } = req.query;

  let mappedSubCategory = subCategory;
  if (
    category &&
    category.toLowerCase() === "writing" &&
    subCategory &&
    (subCategory.toLowerCase() === "write-essay" ||
      subCategory.toLowerCase() === "write essay")
  ) {
    mappedSubCategory = "Essay";
  }

  const query = `
  SELECT QUESTIONID, QUESTION_TEXT, TITLE 
  FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS
  WHERE LOWER(TRIM(CATEGORY)) = LOWER(TRIM(?))
  AND LOWER(TRIM(SUB_CATEGORY)) = LOWER(REPLACE(?, '-', ' '))
`;

  connection.execute({
    sqlText: query,
    binds: [category, mappedSubCategory],

    complete: function (err, stmt, rows) {
      if (err) {
        return res.status(500).json({
          message: "Failed to fetch questions",
          error: err.message,
        });
      }
      return res.json(rows);
    },
  });
});

// ================= GET ALL MODULES & SECTIONS =================
router.get("/sections", verifyToken, (req, res) => {

  const query = `
    SELECT DISTINCT CATEGORY, SUB_CATEGORY
    FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS
    ORDER BY CATEGORY, SUB_CATEGORY
  `;

  connection.execute({
    sqlText: query,

    complete: function (err, stmt, rows) {

      if (err) {
        return res.status(500).json({
          message: "Failed to fetch sections",
          error: err.message,
        });
      }

      return res.json(rows);
    },
  });
});

// GET PARTICULAR QUESTION

router.get("/question/:id", verifyToken, (req, res) => {
  const { id } = req.params;

  const query = `
    SELECT *
    FROM PTE_EXAM_PREP_PLATFORM.PUBLIC.QUESTION_DETAILS
    WHERE QUESTIONID = ?
  `;

  connection.execute({
    sqlText: query,
    binds: [id],

    complete: function (err, stmt, rows) {
      if (err) {
        return res.status(500).json({
          message: "Failed to fetch question",
          error: err.message,
        });
      }

      const question = rows[0];

      // get instruction from row
      const instruction = question?.INSTRUCTION || "";

      return res.json({
        instruction: rows[0]?.INSTRUCTION || "",
        question: rows[0] || null,
      });
    },
  });
});
module.exports = router;