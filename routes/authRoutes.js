const express = require("express");
const router = express.Router();

const connection = require("../db/snowflake");
const jwt = require("jsonwebtoken");
const verifyToken = require("../middleware/authMiddleware");
const admin = require("../firebaseAdmin");


// ================= LOGIN ROUTE =================
router.post("/login", async (req, res) => {

  try {

    const { firebaseToken } = req.body;

    // VERIFY FIREBASE TOKEN
    const decodedToken =
      await admin.auth().verifyIdToken(firebaseToken);

    const email = decodedToken.email;

    console.log("EMAIL FROM FIREBASE:", email);

    // FIND USER IN DATABASE
    const query = `
      SELECT *
      FROM LOGINDETAILS.PUBLIC.USERDETAILS
      WHERE EMAIL = ?
    `;

    connection.execute({
      sqlText: query,
      binds: [email],

      complete: function (err, stmt, rows) {

        // DATABASE ERROR
        if (err) {
          return res.status(500).json({
            message: "Database error",
            error: err.message,
          });
        }

        // USER NOT FOUND
        if (rows.length === 0) {
          return res.status(404).json({
            message: "User not found",
          });
        }

        const user = rows[0];

        const role=user.role || user.ROLE;

        // GENERATE APP JWT
        const token = jwt.sign(
          {
            email: user.EMAIL,
            id: user.ID,
            role: role,
          },
          process.env.JWT_SECRET,
          {
            expiresIn: "1h",
          }
        );
         
        console.log("user from db:",user);
        console.log("ROLE FROM DB:",role );

        // SUCCESS RESPONSE
        return res.json({
          message: "Login successful",
          token,
          user: {
            id: user.ID,
            name: user.NAME,
            email: user.EMAIL,
            role: user.ROLE,
          },
        });
      },
    });

  } catch (error) {

    return res.status(401).json({
      message: "Invalid Firebase token",
      error: error.message,
    });
  }
});

// ================= PROTECTED DASHBOARD ROUTE =================
router.get("/dashboard", verifyToken, (req, res) => {

  res.json({
    message: "Welcome to dashboard",
    user: req.user,
  });

});


// ================= SIGNUP ROUTE =================
router.post("/signup", (req, res) => {

  const { name, email, firebaseUid } = req.body;

  // CHECK IF USER EXISTS
  const checkQuery = `
    SELECT * 
    FROM LOGINDETAILS.PUBLIC.USERDETAILS
    WHERE EMAIL = ?
  `;

  connection.execute({
    sqlText: checkQuery,
    binds: [email],

    complete: function (err, stmt, rows) {

      // DATABASE ERROR
      if (err) {
        return res.status(500).json({
          message: "Database error",
          error: err.message,
        });
      }

      // USER ALREADY EXISTS
      if (rows.length > 0) {
        return res.status(200).json({
          message: "User already exists",
          isNewUser:false
        });
      }

      // INSERT NEW USER
      const insertQuery = `
        INSERT INTO LOGINDETAILS.PUBLIC.USERDETAILS
        (ID, NAME, EMAIL, ROLE)
        VALUES (?, ?, ?, 'student')
      `;

      const id = Date.now().toString();

      connection.execute({
        sqlText: insertQuery,
        binds: [id, name, email],

        complete: function (err2) {

          // INSERT ERROR
          if (err2) {
            return res.status(500).json({
              message: "Insert failed",
              error: err2.message,
            });
          }

          // SUCCESS RESPONSE
          return res.status(201).json({
            message: "User created successfully",
            isNewUser:true,
            user: {
              id,
              name,
              email,
            },
          });
        },
      });
    },
  });
});

// ================= SET PASSWORD ROUTE =================
// router.post("/set-password", (req, res) => {

//   const { email, password } = req.body;

//   // UPDATE PASSWORD QUERY
//   const updateQuery = `
//     UPDATE LOGINDETAILS.PUBLIC.USERDETAILS
//     SET PASSWORD = ?
//     WHERE EMAIL = ?
//   `;

//   connection.execute({
//     sqlText: updateQuery,
//     binds: [password, email],

//     complete: function (err, stmt, rows) {

//       // DATABASE ERROR
//       if (err) {
//         return res.status(500).json({
//           message: "Password update failed",
//           error: err.message,
//         });
//       }

//       // SUCCESS RESPONSE
//       return res.json({
//         message: "Password updated successfully",
//       });
//     },
//   });
// });

module.exports = router;