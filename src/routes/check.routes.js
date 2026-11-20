import { Router } from "express";
import verifyToken from "../middleware/verifyToken.js";
import {
  verifyAdmin,
  verifyOwner,
  verifyRenter,
} from "../middleware/verifyRole.js";

// Temporary test routes. We delete this file after Step 4.
const router = Router();

const reply = (req, res) =>
  res.json({ ok: true, role: req.user.role, email: req.user.email });

router.get("/any", verifyToken, reply);
router.get("/renter", verifyToken, verifyRenter, reply);
router.get("/owner", verifyToken, verifyOwner, reply);
router.get("/admin", verifyToken, verifyAdmin, reply);

export default router;
