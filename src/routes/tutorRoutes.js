import { Router } from "express";
import {
  listTutors,
  getTutor,
  getMyProfile,
  updateMyProfile
} from "../controllers/tutorController.js";
import { getTutorSlots } from "../controllers/slotController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/", listTutors);
router.get("/me", authenticate, requireRole("tutor"), getMyProfile);
router.put("/me", authenticate, requireRole("tutor"), updateMyProfile);
router.get("/:id", getTutor);
router.get("/:id/slots", getTutorSlots);

export default router;