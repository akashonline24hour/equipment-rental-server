import { Router } from "express";
import verifyToken from "../middleware/verifyToken.js";
import { verifyOwner, verifyOwnerOrAdmin } from "../middleware/verifyRole.js";
import { validateEquipment } from "../utils/validateEquipment.js";
import { toObjectId } from "../utils/ids.js";
import { CATEGORIES, RENTAL_TYPES } from "../utils/constants.js";

const router = Router();
const equipmentCollection = (req) => req.app.locals.db.collection("equipment");

// Public responses never include the owner's contact details or review fields
const PUBLIC_PROJECTION = {
  ownerId: 0,
  ownerEmail: 0,
  ownerPhone: 0,
  terms: 0,
  reviewedBy: 0,
  reviewedAt: 0,
};

const SORTS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-low": { price: 1, createdAt: -1 },
  "price-high": { price: -1, createdAt: -1 },
  name: { name: 1 },
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Turns "25" into 25, and blank or invalid text into undefined
function toNumber(value) {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

// ---------- add equipment (owners only) ----------
router.post("/", verifyToken, verifyOwner, async (req, res, next) => {
  try {
    const { errors, data } = validateEquipment(req.body);
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors });
    }

    const now = new Date();
    const result = await equipmentCollection(req).insertOne({
      ...data,
      availableQuantity: data.quantity,
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

// ---------- public: all approved equipment with search, filters, sorting and pages ----------
router.get("/", async (req, res, next) => {
  try {
    const search =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    const { category, rentalType, availability, sort } = req.query;
    const minPrice = toNumber(req.query.minPrice);
    const maxPrice = toNumber(req.query.maxPrice);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(24, Math.max(1, parseInt(req.query.limit, 10) || 9));

    const conditions = [{ status: "approved" }];

    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      conditions.push({
        $or: [
          { name: pattern },
          { category: pattern },
          { location: pattern },
          { brand: pattern },
          { model: pattern },
        ],
      });
    }
    if (CATEGORIES.includes(category)) conditions.push({ category });
    if (RENTAL_TYPES.includes(rentalType)) conditions.push({ rentalType });
    if (minPrice !== undefined) conditions.push({ price: { $gte: minPrice } });
    if (maxPrice !== undefined) conditions.push({ price: { $lte: maxPrice } });
    if (availability === "available") {
      conditions.push({
        $or: [
          { availableQuantity: { $gt: 0 } },
          { availableQuantity: { $exists: false } },
        ],
      });
    }
    if (availability === "unavailable") {
      conditions.push({ availableQuantity: { $lte: 0 } });
    }

    const filter = { $and: conditions };
    const order =
      typeof sort === "string" && Object.hasOwn(SORTS, sort)
        ? SORTS[sort]
        : SORTS.newest;

    const [items, total] = await Promise.all([
      equipmentCollection(req)
        .find(filter, { projection: PUBLIC_PROJECTION })
        .sort(order)
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      equipmentCollection(req).countDocuments(filter),
    ]);

    res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    next(err);
  }
});

// ---------- public: six approved items for the home page ----------
router.get("/featured", async (req, res, next) => {
  try {
    const items = await equipmentCollection(req)
      .find({ status: "approved" }, { projection: PUBLIC_PROJECTION })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(items);
  } catch (err) {
    next(err);
  }
});

// ---------- public: how many approved items each category has ----------
router.get("/categories", async (req, res, next) => {
  try {
    const rows = await equipmentCollection(req)
      .aggregate([
        { $match: { status: "approved" } },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ])
      .toArray();

    const counts = new Map(rows.map((row) => [row._id, row.count]));
    res.json(
      CATEGORIES.map((category) => ({
        category,
        count: counts.get(category) ?? 0,
      })),
    );
  } catch (err) {
    next(err);
  }
});

// ---------- public: owners with approved listings ----------
router.get("/owners", async (req, res, next) => {
  try {
    const owners = await equipmentCollection(req)
      .aggregate([
        { $match: { status: "approved" } },
        {
          $group: {
            _id: "$ownerId",
            name: { $first: "$ownerName" },
            image: { $first: "$ownerImage" },
            listings: { $sum: 1 },
          },
        },
        { $sort: { listings: -1, name: 1 } },
        { $limit: 4 },
        { $project: { _id: 0, name: 1, image: 1, listings: 1 } },
      ])
      .toArray();
    res.json(owners);
  } catch (err) {
    next(err);
  }
});

// ---------- my equipment (owners only) ----------
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

// ---------- one item (logged-in users) ----------
// Approved items are visible to everyone who is logged in.
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

// ---------- update (owner: own items, admin: any item) ----------
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

    // Keep the number of free units in step with the new total
    const currentAvailable = item.availableQuantity ?? item.quantity;
    const nextAvailable = Math.max(
      0,
      Math.min(
        data.quantity,
        currentAvailable + (data.quantity - item.quantity),
      ),
    );

    const changes = {
      ...data,
      availableQuantity: nextAvailable,
      updatedAt: new Date(),
    };

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

// ---------- delete (owner: own items, admin: any item) ----------
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
