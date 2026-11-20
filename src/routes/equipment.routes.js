import { Router } from "express";
import verifyToken from "../middleware/verifyToken.js";
import { verifyOwner, verifyOwnerOrAdmin } from "../middleware/verifyRole.js";
import { validateEquipment } from "../utils/validateEquipment.js";
import { toObjectId } from "../utils/ids.js";

const router = Router();
const equipmentCollection = (req) => req.app.locals.db.collection("equipment");

// Add equipment (owners only). It starts as "pending" until an admin approves it.
router.post("/", verifyToken, verifyOwner, async (req, res, next) => {
  try {
    const { errors, data } = validateEquipment(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const now = new Date();
    const result = await equipmentCollection(req).insertOne({
      ...data,
      status: "pending",
      // The owner always comes from the verified token, never from the request body
      ownerId: req.user.id,
      ownerName: req.user.name,
      ownerEmail: req.user.email,
      ownerImage: req.user.image,
      ownerPhone: req.user.phone,
      createdAt: now,
      updatedAt: now,
    });

    res.status(201).json({
      message: "Equipment submitted for approval",
      id: String(result.insertedId),
    });
  } catch (err) {
    next(err);
  }
});

// My equipment (owners only). Must stay above "/:id".
router.get("/mine", verifyToken, verifyOwner, async (req, res, next) => {
  try {
    const items = await equipmentCollection(req)
      .find({ ownerId: req.user.id })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// One item. Approved items are visible to everyone who is logged in.
// Pending and rejected items are visible only to their owner and to admins.
router.get("/:id", verifyToken, async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid equipment ID" });

    const item = await equipmentCollection(req).findOne({ _id });
    const canSee =
      item &&
      (item.status === "approved" ||
        req.user.role === "admin" ||
        item.ownerId === req.user.id);

    // The same answer for "missing" and "not allowed", so ids can't be guessed
    if (!canSee)
      return res.status(404).json({ message: "Equipment not found" });

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Update an item. Owners can change their own items, admins can change any item.
router.put("/:id", verifyToken, verifyOwnerOrAdmin, async (req, res, next) => {
  try {
    const _id = toObjectId(req.params.id);
    if (!_id) return res.status(400).json({ message: "Invalid equipment ID" });

    const item = await equipmentCollection(req).findOne({ _id });
    if (!item) return res.status(404).json({ message: "Equipment not found" });

    if (req.user.role === "owner" && item.ownerId !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You can only change your own equipment" });
    }

    const { errors, data } = validateEquipment(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const changes = { ...data, updatedAt: new Date() };

    // An owner fixing a rejected item sends it back for review
    const resubmitted = req.user.role === "owner" && item.status === "rejected";
    if (resubmitted) changes.status = "pending";

    await equipmentCollection(req).updateOne({ _id }, { $set: changes });

    res.json({
      message: resubmitted
        ? "Equipment updated and sent for approval again"
        : "Equipment updated successfully",
      status: changes.status ?? item.status,
    });
  } catch (err) {
    next(err);
  }
});

// Delete an item. Owners can delete their own items, admins can delete any item.
router.delete(
  "/:id",
  verifyToken,
  verifyOwnerOrAdmin,
  async (req, res, next) => {
    try {
      const _id = toObjectId(req.params.id);
      if (!_id)
        return res.status(400).json({ message: "Invalid equipment ID" });

      const item = await equipmentCollection(req).findOne({ _id });
      if (!item)
        return res.status(404).json({ message: "Equipment not found" });

      if (req.user.role === "owner" && item.ownerId !== req.user.id) {
        return res
          .status(403)
          .json({ message: "You can only delete your own equipment" });
      }

      await equipmentCollection(req).deleteOne({ _id });
      res.json({ message: "Equipment deleted successfully" });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
