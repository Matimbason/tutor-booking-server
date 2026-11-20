import pool from "../config/db.js";

const tutorQuery = `
  SELECT tp.id, u.name, tp.bio, tp.hourly_rate AS rate,
         GROUP_CONCAT(s.name ORDER BY s.name SEPARATOR ',') AS subjects
  FROM tutor_profiles tp
  JOIN users u ON u.id = tp.user_id
  LEFT JOIN tutor_subjects ts ON ts.tutor_id = tp.id
  LEFT JOIN subjects s ON s.id = ts.subject_id
`;

const format = (row) => ({
  id: row.id,
  name: row.name,
  bio: row.bio || "",
  rate: Number(row.rate),
  subjects: row.subjects ? row.subjects.split(",") : []
});

export const listTutors = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${tutorQuery} GROUP BY tp.id, u.name, tp.bio, tp.hourly_rate HAVING COUNT(s.id) > 0 ORDER BY u.name`
    );
    res.json(rows.map(format));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getTutor = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${tutorQuery} WHERE tp.id = ? GROUP BY tp.id, u.name, tp.bio, tp.hourly_rate`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "Tutor not found" });
    res.json(format(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateMyProfile = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { bio, rate, subjectIds } = req.body;

    if (rate === undefined || isNaN(Number(rate)) || Number(rate) < 0) {
      return res.status(400).json({ message: "Enter a valid hourly rate" });
    }
    if (!Array.isArray(subjectIds)) {
      return res.status(400).json({ message: "subjectIds must be an array" });
    }

    const [profiles] = await conn.query(
      "SELECT id FROM tutor_profiles WHERE user_id = ?",
      [req.user.id]
    );
    if (!profiles[0]) return res.status(404).json({ message: "Profile not found" });
    const tutorId = profiles[0].id;

    await conn.beginTransaction();
    await conn.query(
      "UPDATE tutor_profiles SET bio = ?, hourly_rate = ? WHERE id = ?",
      [bio || "", Number(rate), tutorId]
    );
    await conn.query("DELETE FROM tutor_subjects WHERE tutor_id = ?", [tutorId]);
    for (const subjectId of subjectIds) {
      await conn.query(
        "INSERT INTO tutor_subjects (tutor_id, subject_id) VALUES (?, ?)",
        [tutorId, subjectId]
      );
    }
    await conn.commit();

    res.json({ message: "Profile updated", tutorId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    conn.release();
  }
};

export const listSubjects = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM subjects ORDER BY name");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, bio, hourly_rate AS rate FROM tutor_profiles WHERE user_id = ?",
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "Profile not found" });

    const [subs] = await pool.query(
      "SELECT subject_id FROM tutor_subjects WHERE tutor_id = ?",
      [rows[0].id]
    );

    res.json({
      id: rows[0].id,
      bio: rows[0].bio || "",
      rate: Number(rows[0].rate),
      subjectIds: subs.map((s) => s.subject_id)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};