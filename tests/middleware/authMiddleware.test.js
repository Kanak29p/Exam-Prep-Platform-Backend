jest.mock("../../src/config/env", () => ({
  jwtSecret: "test-secret",
}));

const jwt = require("jsonwebtoken");
const verifyToken = require("../../src/middleware/authMiddleware");

describe("authMiddleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test("should return 401 if Authorization header is missing", () => {
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token missing" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if token is malformed or missing after Bearer", () => {
    req.headers.authorization = "Bearer";
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Malformed authorization header" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should return 401 if token is invalid or expired", () => {
    req.headers.authorization = "Bearer invalid-token-string";
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("should verify a valid token, inject user details into req.user, and call next()", () => {
    const payload = { id: "student_123", email: "test@domain.com", role: "student" };
    const token = jwt.sign(payload, "test-secret");
    req.headers.authorization = `Bearer ${token}`;

    verifyToken(req, res, next);

    expect(req.user).toBeDefined();
    expect(req.user.id).toBe("student_123");
    expect(req.user.email).toBe("test@domain.com");
    expect(next).toHaveBeenCalled();
  });
});
