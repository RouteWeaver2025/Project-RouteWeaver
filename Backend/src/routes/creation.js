import express from "express";
import landmarksRouter from "../utils/landmarks.js";

const router = express.Router();

// Mount the landmarks router on the '/landmarks' path.
// This means that all endpoints in landmarks.js will be accessible under /api/landmarks
router.use("/landmarks", landmarksRouter);

export default router;
