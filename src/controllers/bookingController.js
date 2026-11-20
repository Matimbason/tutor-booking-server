import pool from "../config/db.js";

const bookingSelect = `
  SELECT b.id, b.slot_id AS slotId, b.status, b.notes,
         s.tutor_id AS tutorId, tu.name AS tutorName,
         b.student_id AS studentId, su.name AS studentName,
         sub.name AS subject,
         DATE_FORMAT(s.start_time, '%Y-%m-%d') AS date,
         DATE_FORMAT(s.start_time, '%H:%i') AS start,
         DATE_FORMAT(s.end_time, '%H:%i') AS end
  FROM bookings b
  JOIN availability_slots s ON s.id = b.slot_id
  JOIN tutor_profiles tp ON tp.id = s.tutor_id
  JOIN users tu ON tu.id = tp.user_id
  JOIN users su ON su.id = b.student_id
  JOIN subjects sub ON sub.id = b.subject_id
`;

const getProfileId = async (userId) => {
  const [rows] = await pool.query(
    "SELECT id FROM tutor_profiles WHERE user_id = ?",
    [userId]
  );
  return rows[0] ? rows[0].id : null;
};

export const createBooking = async (req, res) => {
  try {
    const { slotId, subjectId, notes } = req.body;

    if (!slotId || !subjectId) {
      return res.status(400).json({ message: "slotId and subjectId are required" });
    }

    const [slots] = await pool.query(
      "SELECT id, tutor_id, start_time FROM availability_slots WHERE id = ?",
      [slotId]
    );
    const slot = slots[0];
    if (!slot) return res.status(404).json({ message: "Slot not found" });

    if (new Date(slot.start_time) <= new Date()) {
      return res.status(400).json({ message: "That slot is in the past" });
    }

    const [taught] = await pool.query(
      "SELECT 1 FROM tutor_subjects WHERE tutor_id = ? AND subject_id = ?",
      [slot.tutor_id, subjectId]
    );
    if (!taught[0]) {
      return res.status(400).json({ message: "This tutor does not teach that subject" });
    }

    const [result] = await pool.query(
      "INSERT INTO bookings (slot_id, student_id, subject_id, notes) VALUES (?, ?, ?, ?)",
      [slotId, req.user.id, subjectId, (notes || "").slice(0, 500)]
    );

    res.status(201).json({ id: result.insertId, slotId, status: "pending" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "That slot has already been booked" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const listMyBookings = async (req, res) => {
  try {
    let rows;

    if (req.user.role === "tutor") {
      const tutorId = await getProfileId(req.user.id);
      if (!tutorId) return res.status(404).json({ message: "Profile not found" });
      [rows] = await pool.query(
        `${bookingSelect} WHERE s.tutor_id = ? ORDER BY s.start_time`,
        [tutorId]
      );
    } else {
      [rows] = await pool.query(
        `${bookingSelect} WHERE b.student_id = ? ORDER BY s.start_time`,
        [req.user.id]
      );
    }

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!["confirmed", "completed"].includes(status)) {
      return res.status(400).json({ message: "Status must be confirmed or completed" });
    }

    const tutorId = await getProfileId(req.user.id);
    if (!tutorId) return res.status(404).json({ message: "Profile not found" });

    const [result] = await pool.query(
      `UPDATE bookings b
       JOIN availability_slots s ON s.id = b.slot_id
       SET b.status = ?
       WHERE b.id = ? AND s.tutor_id = ?`,
      [status, req.params.id, tutorId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Booking not found" });
    }
    res.json({ message: "Status updated", status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.id, b.student_id, tp.user_id AS tutorUserId
       FROM bookings b
       JOIN availability_slots s ON s.id = b.slot_id
       JOIN tutor_profiles tp ON tp.id = s.tutor_id
       WHERE b.id = ?`,
      [req.params.id]
    );
    const booking = rows[0];

    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.student_id !== req.user.id && booking.tutorUserId !== req.user.id) {
      return res.status(403).json({ message: "Not allowed" });
    }

    await pool.query("DELETE FROM bookings WHERE id = ?", [booking.id]);
    res.json({ message: "Booking cancelled" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};