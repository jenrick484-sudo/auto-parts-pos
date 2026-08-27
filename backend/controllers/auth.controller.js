const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const userResult = await db.query(
      'SELECT * FROM users WHERE UPPER(username) = UPPER($1)',
      [username]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Mali ang Username o Password!' });
    }

    const user = userResult.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Mali ang Username o Password!' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.status(200).json({
      message: 'Login Successful',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};