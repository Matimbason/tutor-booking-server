import express from "express";
import cors from "cors";
import pool from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import tutorRoutes from "./routes/tutorRoutes.js";
import slotRoutes from "./routes/slotRoutes.js";
import { listSubjects } from "./controllers/tutorController.js";
import bookingRoutes from "./routes/bookingRoutes.js";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ status: "ok", db: rows[0].ok === 1 });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

app.use("/api/auth", authRoutes);
app.get("/api/subjects", listSubjects);
app.use("/api/tutors", tutorRoutes);
app.use("/api/slots", slotRoutes);
app.use("/api/bookings", bookingRoutes);

export default app;