import { Router } from "express";
import verifyToken from "../middleware/verifyToken.js";

const router = Router();

// The logged-in user, with their current role
router.get("/me", verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Ask for the owner or admin role. An admin approves it in a later step.
router.post("/role-request", verifyToken, async (req, res, next) => {
  try {
    const requested = String(req.body?.role ?? "");

    if (!["owner", "admin"].includes(requested)) {
      return res.status(400).json({ message: "Choose owner or admin" });
    }
    if (req.user.role === requested) {
      return res
        .status(400)
        .json({ message: `You already have the ${requested} role` });
    }
    if (req.user.role === "admin") {
      return res.status(400).json({ message: "Admins cannot change role" });
    }
    if (req.user.roleRequestStatus === "pending") {
      return res
        .status(400)
        .json({ message: "You already have a request waiting for approval" });
    }

    await req.app.locals.db.collection("user").updateOne(
      { email: req.user.email },
      {
        $set: {
          requestedRole: requested,
          roleRequestStatus: "pending",
          updatedAt: new Date(),
        },
      },
    );

    res.status(201).json({
      message: `Your ${requested} request was sent for approval`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
