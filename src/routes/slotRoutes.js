import { Router } from "express";
import {
  listMySlots,
  createSlot,
  deleteSlot
} from "../controllers/slotController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate, requireRole("tutor"));

router.get("/mine", listMySlots);
router.post("/", createSlot);
router.delete("/:id", deleteSlot);

export default router;