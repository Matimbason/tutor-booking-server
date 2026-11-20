import pool from "../config/db.js";

const slotColumns = `
  s.id,
  s.tutor_id AS tutorId,
  DATE_FORMAT(s.start_time, '%Y-%m-%d') AS date,
  DATE_FORMAT(s.start_time, '%H:%i') AS start,
  DATE_FORMAT(s.end_time, '%H:%i') AS end
`;

const getProfileId = async (userId) => {
  const [rows] = await pool.query(
    "SELECT id FROM tutor_profiles WHERE user_id = ?",
    [userId]
  );
  return rows[0] ? rows[0].id : null;
};

export const getTutorSlots = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${slotColumns}
       FROM availability_slots s
       LEFT JOIN bookings b ON b.slot_id = s.id
       WHERE s.tutor_id = ? AND b.id IS NULL AND s.start_time > NOW()
       ORDER BY s.start_time`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listMySlots = async (req, res) => {
  try {
    const tutorId = await getProfileId(req.user.id);
    if (!tutorId) return res.status(404).json({ message: "Profile not found" });

    const [rows] = await pool.query(
      `SELECT ${slotColumns}, (b.id IS NOT NULL) AS booked
       FROM availability_slots s
       LEFT JOIN bookings b ON b.slot_id = s.id
       WHERE s.tutor_id = ?
       ORDER BY s.start_time`,
      [tutorId]
    );
    res.json(rows.map((r) => ({ ...r, booked: Boolean(r.booked) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const createSlot = async (req, res) => {
  try {
    const { date, start, end } = req.body;

    const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date || "");
    const timeOk = (t) => /^\d{2}:\d{2}$/.test(t || "");
    if (!dateOk || !timeOk(start) || !timeOk(end)) {
      return res.status(400).json({ message: "Use date YYYY-MM-DD and times HH:MM" });
    }
    if (end <= start) {
      return res.status(400).json({ message: "End time must be after start time" });
    }
    if (new Date(`${date}T${start}:00`) <= new Date()) {
      return res.status(400).json({ message: "Slot must be in the future" });
    }

    const tutorId = await getProfileId(req.user.id);
    if (!tutorId) return res.status(404).json({ message: "Profile not found" });

    const [result] = await pool.query(
      "INSERT INTO availability_slots (tutor_id, start_time, end_time) VALUES (?, ?, ?)",
      [tutorId, `${date} ${start}:00`, `${date} ${end}:00`]
    );
    res.status(201).json({ id: result.insertId, tutorId, date, start, end });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "You already have a slot at that time" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteSlot = async (req, res) => {
  try {
    const tutorId = await getProfileId(req.user.id);
    if (!tutorId) return res.status(404).json({ message: "Profile not found" });

    const [booked] = await pool.query(
      "SELECT 1 FROM bookings WHERE slot_id = ?",
      [req.params.id]
    );
    if (booked[0]) {
      return res.status(409).json({ message: "Cancel the booking first" });
    }

    const [result] = await pool.query(
      "DELETE FROM availability_slots WHERE id = ? AND tutor_id = ?",
      [req.params.id, tutorId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Slot not found" });
    }
    res.json({ message: "Slot deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};