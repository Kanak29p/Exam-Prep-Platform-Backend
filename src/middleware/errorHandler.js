// Express error-handling middleware. Must be registered LAST.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error("Unhandled error:", err);
  const status = err.status || 500;
  res.status(status).json({
    message: err.publicMessage || "Internal server error",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
}

module.exports = errorHandler;
