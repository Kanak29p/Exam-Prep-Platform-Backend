const verifyAdmin = require("../../src/middleware/adminMiddleware");

describe("adminMiddleware.verifyAdmin", () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: null };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  test("returns 403 if req.user is missing", () => {
    verifyAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden: Admin access required" });
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 403 if user role is not admin", () => {
    req.user = { role: "student" };
    verifyAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Forbidden: Admin access required" });
    expect(next).not.toHaveBeenCalled();
  });

  test("calls next() if user role is admin", () => {
    req.user = { role: "admin" };
    verifyAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
