const jwt = require("jsonwebtoken");

const jwtSecret = "96fcb371ea2574c45b08130fad15c9738a5b994ece381d6bcc57f79ec96eb41691c5ea751d1329c488d4f2c8b79b2a1dbbe782635427eaedfcc9d2adc813d95a";

const token = jwt.sign({ id: 1, email: "piya@mailinator.com" }, jwtSecret, { expiresIn: "1h" });

console.log("Generated Token:", token);

fetch("http://localhost:5000/api/mock-tests", {
  headers: {
    Authorization: `Bearer ${token}`
  }
})
.then(res => {
  console.log("Response Status:", res.status);
  return res.json();
})
.then(data => {
  console.log("Response Data:", data);
})
.catch(err => {
  console.error("API Call Failed:", err);
});
