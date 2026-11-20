import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const makeToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });

export const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ message: "Enter your name" });
    }
    if (!email || !email.includes("@")) {
      return res.status(400).json({ message: "Enter a valid email" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }
    if (!["student", "tutor"].includes(role)) {
      return res.status(400).json({ message: "Role must be student or tutor" });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name.trim(), email.toLowerCase(), hash, role]
    );

    if (role === "tutor") {
      await pool.query("INSERT INTO tutor_profiles (user_id) VALUES (?)", [result.insertId]);
    }

    const user = { id: result.insertId, name: name.trim(), email: email.toLowerCase(), role };
    res.status(201).json({ token: makeToken(user), user });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Email already registered" });
    }
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email.toLowerCase()
    ]);
    const found = rows[0];

    if (!found || !(await bcrypt.compare(password, found.password_hash))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = { id: found.id, name: found.name, email: found.email, role: found.role };
    res.json({ token: makeToken(user), user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, role FROM users WHERE id = ?",
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ message: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};