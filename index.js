import express from "express";
import cors from "cors";
import "dotenv/config";
import { getDb } from "./src/config/db.js";
import { notFound, errorHandler } from "./src/middleware/errorHandler.js";
import adminRoutes from "./src/routes/admin.routes.js";
import usersRoutes from "./src/routes/users.routes.js";
import equipmentRoutes from "./src/routes/equipment.routes.js";

const app = express();
const port = process.env.PORT || 5000;

// Allowed websites, for example: http://localhost:3000,https://your-site.vercel.app
const allowedOrigins = (process.env.CLIENT_URLS || "http://localhost:3000")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json());

// Root check (does not need the database)
app.get("/", (req, res) => {
  res.json({ message: "Equipment Rental API is running" });
});

// Make the database available to every route below
app.use(async (req, res, next) => {
  try {
    req.app.locals.db = await getDb();
    next();
  } catch (err) {
    console.error("Database connection failed:", err.message);
    res.status(503).json({ message: "Database unavailable" });
  }
});

app.get("/api/health", async (req, res, next) => {
  try {
    await req.app.locals.db.command({ ping: 1 });
    res.json({ ok: true, database: req.app.locals.db.databaseName });
  } catch (err) {
    next(err);
  }
});

// Feature routes are added here in the next steps
// Feature routes
app.use("/api/users", usersRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFound);
app.use(errorHandler);

// Local development only. Vercel imports the exported app instead.
if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

export default app;
