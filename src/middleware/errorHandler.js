export function notFound(req, res) {
  res.status(404).json({ message: "Route not found" });
}

// Express recognizes an error handler by its four parameters
export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || err.statusCode || 500;

  let message = "Something went wrong";
  if (status === 400) message = "Invalid request";
  else if (status < 500) message = err.message || "Request failed";

  res.status(status).json({ message });
}