import { Router } from "express";
import {
  createBooking,
  listMyBookings,
  updateBookingStatus,
  cancelBooking
} from "../controllers/bookingController.js";
import { authenticate, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(authenticate);

router.post("/", requireRole("student"), createBooking);
router.get("/mine", listMyBookings);
router.patch("/:id/status", requireRole("tutor"), updateBookingStatus);
router.delete("/:id", cancelBooking);

export default router;