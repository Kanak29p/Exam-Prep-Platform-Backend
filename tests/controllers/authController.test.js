jest.mock("../../src/config/env", () => ({ jwtSecret: "test-secret" }));
jest.mock("../../src/config/firebaseAdmin", () => ({
  auth: () => ({
    verifyIdToken: jest.fn(),
  }),
}));
jest.mock("../../src/services/userService", () => ({
  findByEmail: jest.fn(),
  createStudent: jest.fn(),
  updateProfile: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const admin = require("../../src/config/firebaseAdmin");
const userService = require("../../src/services/userService");
const { login, signup, updateProfile } = require("../../src/controllers/authController");

// --------------- helpers ---------------
function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// =====================================================================
// login()
// =====================================================================
describe("authController.login", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("400 – missing firebaseToken", async () => {
    await login(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "firebaseToken is required" });
  });

  test("401 – invalid Firebase token", async () => {
    req.body.firebaseToken = "bad-token";
    admin.auth().verifyIdToken.mockRejectedValueOnce(new Error("invalid token"));
    await login(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid Firebase token" })
    );
  });

  test("404 – user not found in DB", async () => {
    req.body.firebaseToken = "good-token";
    admin.auth().verifyIdToken.mockResolvedValueOnce({ email: "unknown@test.com" });
    userService.findByEmail.mockResolvedValueOnce(null);
    await login(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
  });

  test("200 – successful login returns JWT and user payload", async () => {
    req.body.firebaseToken = "good-token";
    admin.auth().verifyIdToken.mockResolvedValueOnce({ email: "student@test.com" });
    userService.findByEmail.mockResolvedValueOnce({
      ID: "u1", NAME: "Alice", EMAIL: "student@test.com",
      ROLE: "student", PLAN: "Premium",
      PHONE: "", LOCATION: "", TARGET_SCORE: 79,
      EXAM_DATE: "", BIO: "", AVATAR: "", COUNTRY: "", STATE: "", CITY: "",
    });

    await login(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Login successful",
        token: expect.any(String),
        user: expect.objectContaining({ id: "u1", email: "student@test.com" }),
      })
    );

    // Verify the returned token is a valid JWT
    const call = res.json.mock.calls[0][0];
    const decoded = jwt.verify(call.token, "test-secret");
    expect(decoded.email).toBe("student@test.com");
    expect(decoded.role).toBe("student");
  });

  test("calls next(err) on unexpected error", async () => {
    req.body.firebaseToken = "t";
    admin.auth().verifyIdToken.mockResolvedValueOnce({ email: "a@b.com" });
    userService.findByEmail.mockRejectedValueOnce(new Error("DB error"));
    await login(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// signup()
// =====================================================================
describe("authController.signup", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("400 – missing name", async () => {
    req.body = { email: "a@b.com" };
    await signup(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "name and email are required" });
  });

  test("400 – missing email", async () => {
    req.body = { name: "Alice" };
    await signup(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("200 – user already exists (duplicate email)", async () => {
    req.body = { name: "Alice", email: "existing@test.com" };
    userService.findByEmail.mockResolvedValueOnce({ ID: "u1" });
    await signup(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "User already exists", isNewUser: false })
    );
  });

  test("201 – successful registration", async () => {
    req.body = { name: "Alice", email: "new@test.com" };
    userService.findByEmail.mockResolvedValueOnce(null);
    userService.createStudent.mockResolvedValueOnce({ id: "u2", name: "Alice", email: "new@test.com" });
    await signup(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ isNewUser: true, user: expect.objectContaining({ email: "new@test.com" }) })
    );
  });

  test("calls next(err) on DB error", async () => {
    req.body = { name: "Alice", email: "fail@test.com" };
    userService.findByEmail.mockRejectedValueOnce(new Error("DB error"));
    await signup(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// =====================================================================
// updateProfile()
// =====================================================================
describe("authController.updateProfile", () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { id: "u1" }, body: {} };
    res = makeRes();
    next = jest.fn();
  });

  test("400 – missing name", async () => {
    req.body = { phone: "111" };
    await updateProfile(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Name is required" });
  });

  test("404 – user not found after update", async () => {
    req.body = { name: "Alice" };
    userService.updateProfile.mockResolvedValueOnce(null);
    await updateProfile(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
  });

  test("200 – successful profile update", async () => {
    req.body = { name: "Alice Updated", phone: "999" };
    userService.updateProfile.mockResolvedValueOnce({
      ID: "u1", NAME: "Alice Updated", EMAIL: "a@b.com", ROLE: "student",
      PHONE: "999", LOCATION: "", TARGET_SCORE: 0, EXAM_DATE: "",
      BIO: "", AVATAR: "", COUNTRY: "", STATE: "", CITY: "", PLAN: "Free",
    });
    await updateProfile(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Profile updated successfully",
        user: expect.objectContaining({ name: "Alice Updated" }),
      })
    );
  });
});
