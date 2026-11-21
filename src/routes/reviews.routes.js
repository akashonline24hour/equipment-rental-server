import { Router } from "express";

const router = Router();

// Public: the latest customer reviews for the home page
router.get("/", async (req, res, next) => {
  try {
    const reviews = await req.app.locals.db
      .collection("reviews")
      .find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json(reviews);
  } catch (err) {
    next(err);
  }
});

export default router;
