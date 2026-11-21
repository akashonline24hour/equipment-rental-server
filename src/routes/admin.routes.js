import { Router } from "express";
import verifyToken from "../middleware/verifyToken.js";
import { verifyAdmin } from "../middleware/verifyRole.js";
import { idFilter, toObjectId } from "../utils/ids.js";
import { EQUIPMENT_STATUSES } from "../utils/constants.js";

const router = Router();

// Every route in this file is for admins only
router.use(verifyToken, verifyAdmin);

const ROLES = ["customer", "owner", "admin"];
const usersCollection = (req) => req.app.locals.db.collection("user");
const equipmentCollection = (req) => req.app.locals.db.collection("equipment");

function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name || "",
    email: user.email,
    image: user.image || "",
    role: user.role || "customer",
    requestedRole: user.requestedRole || "none",
    roleRequestStatus: user.roleRequestStatus || "none",
    blocked: user.blocked === true,
    createdAt: user.createdAt,
  };
}

// Finds the user from :id. Sends the error response itself and returns null on failure.
async function loadTarget(req, res) {
  const filter = idFilter(req.params.id);
  if (!filter) {
    res.status(400).json({ message: "Invalid user ID" });
    return null;
  }
  const user = await usersCollection(req).findOne(filter);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return null;
  }
  return { user, filter };
}

// ---------- users ----------

router.get("/users", async (req, res, next) => {
  try {
    const list = await usersCollection(req)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(list.map(publicUser));
  } catch (err) {
    next(err);
  }
});

// Change a user's role directly
router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const role = String(req.body?.role ?? "");
    if (!ROLES.includes(role)) {
      return res
        .status(400)
        .json({ message: "Choose customer, owner or admin" });
    }

    const target = await loadTarget(req, res);
    if (!target) return;
    const { user, filter } = target;

    if (String(user._id) === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot change your own role" });
    }

    const changes = { role, updatedAt: new Date() };
    // If this matches what the user asked for, the request counts as approved
    if (user.roleRequestStatus === "pending" && user.requestedRole === role) {
      changes.roleRequestStatus = "approved";
      changes.requestedRole = "none";
    }

    await usersCollection(req).updateOne(filter, { $set: changes });

    res.json({
      message: `${user.name || user.email} is now ${role}`,
      user: publicUser({ ...user, ...changes }),
    });
  } catch (err) {
    next(err);
  }
});

// Approve or reject a role request
router.patch("/users/:id/role-request", async (req, res, next) => {
  try {
    const action = String(req.body?.action ?? "");
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ message: "Choose approve or reject" });
    }

    const target = await loadTarget(req, res);
    if (!target) return;
    const { user, filter } = target;

    const hasRequest =
      user.roleRequestStatus === "pending" &&
      ["owner", "admin"].includes(user.requestedRole);
    if (!hasRequest) {
      return res
        .status(400)
        .json({ message: "This user has no pending request" });
    }

    const changes =
      action === "approve"
        ? {
            role: user.requestedRole,
            roleRequestStatus: "approved",
            requestedRole: "none",
          }
        : { roleRequestStatus: "rejected", requestedRole: "none" };
    changes.updatedAt = new Date();

    await usersCollection(req).updateOne(filter, { $set: changes });

    res.json({
      message:
        action === "approve"
          ? `${user.name || user.email} is now ${user.requestedRole}`
          : "Request rejected",
      user: publicUser({ ...user, ...changes }),
    });
  } catch (err) {
    next(err);
  }
});

// Block or unblock a user
router.patch("/users/:id/block", async (req, res, next) => {
  try {
    if (typeof req.body?.blocked !== "boolean") {
      return res.status(400).json({ message: "Send blocked as true or false" });
    }
    const blocked = req.body.blocked;

    const target = await loadTarget(req, res);
    if (!target) return;
    const { user, filter } = target;

    if (String(user._id) === req.user.id) {
      return res
        .status(400)
        .json({ message: "You cannot block your own account" });
    }

    const changes = { blocked, updatedAt: new Date() };
    await usersCollection(req).updateOne(filter, { $set: changes });

    res.json({
      message: blocked ? "User blocked" : "User unblocked",
      user: publicUser({ ...user, ...changes }),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- equipment ----------

// Every item, including pending and rejected ones
router.get("/equipment", async (req, res, next) => {
  try {
    const items = await equipmentCollection(req)
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// Approve, reject or move an item back to pending
router.patch("/equipment/:id/status", async (req, res, next) => {
  try {
    const status = String(req.body?.status ?? "");
    if (!EQUIPMENT_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({ message: "Choose pending, approved or rejected" });
    }

    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid equipment ID" });

    const now = new Date();
    const result = await equipmentCollection(req).updateOne(
      { _id },
      {
        $set: {
          status,
          reviewedBy: req.user.email,
          reviewedAt: now,
          updatedAt: now,
        },
      },
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Equipment not found" });
    }

    const messages = {
      approved: "Equipment approved",
      rejected: "Equipment rejected",
      pending: "Equipment moved back to pending",
    };
    res.json({ message: messages[status], status });
  } catch (err) {
    next(err);
  }
});

export default router;
