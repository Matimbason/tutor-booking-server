import "dotenv/config";
import bcrypt from "bcrypt";
import pool from "./src/config/db.js";

const PASSWORD = "demo1234";

const pad = (n) => String(n).padStart(2, "0");

const dateFromToday = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const tutors = [
  {
    name: "Naledi Khumalo",
    email: "naledi.demo@tutorbook.test",
    bio: "Honours maths student. I make calculus and linear algebra feel doable.",
    rate: 160,
    subjects: ["Mathematics", "Statistics"]
  },
  {
    name: "Kagiso Sithole",
    email: "kagiso.demo@tutorbook.test",
    bio: "Software developer and CS tutor. Java, data structures, and web basics.",
    rate: 200,
    subjects: ["Computer Science"]
  },
  {
    name: "Ayanda Mthembu",
    email: "ayanda.demo@tutorbook.test",
    bio: "Mechanics and differential equations with plenty of worked examples.",
    rate: 170,
    subjects: ["Applied Mathematics", "Mathematics"]
  }
];

const dayOffsets = [2, 3, 4, 5, 6, 9, 10];
const times = [
  ["10:00", "11:00"],
  ["14:00", "15:00"]
];

const run = async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const [subjectRows] = await pool.query("SELECT id, name FROM subjects");
  const subjectId = Object.fromEntries(subjectRows.map((s) => [s.name, s.id]));

  for (const t of tutors) {
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [t.email]);
    if (existing[0]) {
      console.log(`Skipped ${t.email} (already exists)`);
      continue;
    }

    const [u] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'tutor')",
      [t.name, t.email, hash]
    );
    const [p] = await pool.query(
      "INSERT INTO tutor_profiles (user_id, bio, hourly_rate) VALUES (?, ?, ?)",
      [u.insertId, t.bio, t.rate]
    );

    for (const name of t.subjects) {
      await pool.query(
        "INSERT INTO tutor_subjects (tutor_id, subject_id) VALUES (?, ?)",
        [p.insertId, subjectId[name]]
      );
    }

    for (const offset of dayOffsets) {
      const date = dateFromToday(offset);
      for (const [start, end] of times) {
        await pool.query(
          "INSERT INTO availability_slots (tutor_id, start_time, end_time) VALUES (?, ?, ?)",
          [p.insertId, `${date} ${start}:00`, `${date} ${end}:00`]
        );
      }
    }

    console.log(`Created tutor ${t.email}`);
  }

  const studentEmail = "demo.student@tutorbook.test";
  const [s] = await pool.query("SELECT id FROM users WHERE email = ?", [studentEmail]);
  if (s[0]) {
    console.log(`Skipped ${studentEmail} (already exists)`);
  } else {
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'student')",
      ["Demo Student", studentEmail, hash]
    );
    console.log(`Created student ${studentEmail}`);
  }

  await pool.end();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});