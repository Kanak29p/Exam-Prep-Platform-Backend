const errorHandler = require("../../src/middleware/errorHandler");

describe("errorHandler middleware", () => {
  let req, res, next;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("returns 500 default status and generic error message", () => {
    const error = new Error("Database connection timed out");
    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Internal server error",
        error: "Database connection timed out",
      })
    );
  });

  test("uses err.status and err.publicMessage when provided", () => {
    const error = new Error("Specific validation issue");
    error.status = 422;
    error.publicMessage = "Validation failed on fields";
    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation failed on fields",
        error: "Specific validation issue",
      })
    );
  });
});
