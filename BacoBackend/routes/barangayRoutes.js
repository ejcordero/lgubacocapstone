const express = require('express');
const router = express.Router();
const { pool } = require('./_shared');

// GET all barangays
router.get('/barangays', async (req, res, next) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');

        const [rows] = await pool.execute('SELECT * FROM barangays ORDER BY id ASC');
        res.json(rows);
    } catch (err) {
        console.error('Get barangays error:', err);
        next(err);
    }
});

// GET single barangay by ID
router.get('/barangays/:id', async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM barangays WHERE id = ?', [req.params.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Barangay not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Get barangay error:', err);
        next(err);
    }
});

// POST create new barangay
router.post('/barangays', async (req, res, next) => {
    try {
        const { name, lat, lng, population, elevation, area_type, overview, seal_image } = req.body;
        if (!name || lat === undefined || lng === undefined) return res.status(400).json({ error: 'Name, latitude, and longitude are required' });
        const [result] = await pool.execute(
            `INSERT INTO barangays (name, lat, lng, population, elevation, area_type, overview, seal_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, lat, lng, population || 0, elevation || 0.0, area_type || 'Lowland', overview || null, seal_image || null]
        );
        const [newRows] = await pool.execute('SELECT * FROM barangays WHERE id = ?', [result.insertId]);
        res.status(201).json(newRows[0]);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Barangay with this name already exists' });
        next(err);
    }
});

// PUT update barangay
router.put('/barangays/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, lat, lng, population, elevation, area_type, overview, seal_image } = req.body;
        const [existing] = await pool.execute('SELECT id FROM barangays WHERE id = ?', [id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Barangay not found' });
        await pool.execute(
            `UPDATE barangays SET name=?, lat=?, lng=?, population=?, elevation=?, area_type=?, overview=?, seal_image=? WHERE id=?`,
            [name, lat, lng, population !== undefined ? population : 0, elevation !== undefined ? elevation : 0.0, area_type || 'Lowland', overview, seal_image, id]
        );
        res.json({ message: 'Barangay updated successfully' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Barangay with this name already exists' });
        next(err);
    }
});

// DELETE barangay
router.delete('/barangays/:id', async (req, res, next) => {
    try {
        const [existing] = await pool.execute('SELECT id FROM barangays WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ error: 'Barangay not found' });
        await pool.execute('DELETE FROM barangays WHERE id = ?', [req.params.id]);
        res.json({ message: 'Barangay deleted successfully' });
    } catch (err) { next(err); }
});

// GET barangay statistics summary
router.get('/barangays/stats/summary', async (req, res, next) => {
    try {
        const [totalPop] = await pool.execute('SELECT SUM(population) as total FROM barangays');
        const [byArea] = await pool.execute('SELECT area_type, COUNT(*) as count, SUM(population) as population FROM barangays GROUP BY area_type');
        res.json({ totalPopulation: totalPop[0].total || 0, totalBarangays: 27, byArea: byArea });
    } catch (err) { next(err); }
});

module.exports = router;