const db = require('../config/db');
const bcrypt = require('bcryptjs');

// GET ALL USERS
exports.getAllUsers = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, full_name, username, role, created_at FROM users ORDER BY id ASC'
    );
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// CREATE USER (MANAGER / CASHIER ONLY)
exports.createUser = async (req, res) => {
  try {
    const { fullName, username, password, role } = req.body;

    if (role === 'ADMIN') {
      return res.status(400).json({ message: 'Isa lamang ang pwedeng maging System Admin!' });
    }

    const checkUser = await db.query(
      'SELECT id FROM users WHERE UPPER(username) = UPPER($1)',
      [username]
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ message: `Ang username na "${username}" ay may gumagamit na!` });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const query = `
      INSERT INTO users (full_name, username, password, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, username, role, created_at
    `;

    const result = await db.query(query, [fullName.toUpperCase(), username.toUpperCase(), hashedPassword, role]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE USER
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const userCheck = await db.query('SELECT role FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (userCheck.rows[0].role === 'ADMIN') {
      return res.status(403).json({ message: 'Hindi pwedeng burahin ang Admin account!' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};