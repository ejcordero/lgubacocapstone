const express = require('express');
const router = express.Router();
const { pool } = require('./_shared');

// USERS & TALA ROUTES
// Password hashes no longer leaked by this endpoint
router.get('/users', async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT id, username, full_name, email, first_name, middle_name, last_name, phone_number, google_id, created_at FROM users ORDER BY id DESC');
        res.json(rows);
    } catch (err) { next(err); }
});

router.post('/users', async (req, res, next) => {
    try {
        const { name, email, age } = req.body;
        const [result] = await pool.execute('INSERT INTO users (name, email, age) VALUES (?, ?, ?)', [name, email, age || null]);
        const [rows] = await pool.execute('SELECT * FROM users WHERE id=?', [result.insertId]);
        res.status(201).json(rows[0]);
    } catch (err) { next(err); }
});

module.exports = router;