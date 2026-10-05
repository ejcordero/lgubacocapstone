const express = require('express');
const router = express.Router();
const { pool, saveBase64Image, BASE_URL } = require('./_shared');

router.get('/health-services', async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM health_services ORDER BY created_at DESC');
        const results = rows.map(s => {
            const rawImages = s.images || s.image || '';
            let imageArray = [];
            if (rawImages) imageArray = rawImages.split(',').map(img => img.trim()).filter(img => img).map(img => `${BASE_URL}/uploads/${img}`);
            const dateObj = s.date || s.created_at;
            const formattedDate = dateObj ? new Date(dateObj).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
            return { ...s, date: formattedDate, image: imageArray.length > 0 ? imageArray[0] : 'https://via.placeholder.com/300x200?text=No+Image', gallery: imageArray };
        });
        res.json(results);
    } catch (err) { next(err); }
});
router.post('/health-services', async (req, res, next) => {
    try {
        const { title, description, images } = req.body;
        const filenames = [];
        if (images && images.length > 0) { for (const img of images) { if (img && img.startsWith('data:image')) filenames.push(saveBase64Image(img)); } }
        const imagesString = filenames.join(',');
        const [result] = await pool.execute('INSERT INTO health_services (title, description, images) VALUES (?, ?, ?)', [title, description, imagesString]);
        const [newRows] = await pool.execute('SELECT * FROM health_services WHERE id = ?', [result.insertId]);
        res.status(201).json(newRows[0]);
    } catch (err) { next(err); }
});
router.put('/health-services/:id', async (req, res, next) => {
    try {
        const { id } = req.params; const { title, description, images } = req.body; const filenames = [];
        if (images && images.length > 0) { for (const img of images) { if (img.startsWith('data:image')) filenames.push(saveBase64Image(img)); else if (img.includes(`${BASE_URL}/uploads/`)) filenames.push(img.split('/').pop()); } }
        const imagesString = filenames.join(',');
        await pool.execute('UPDATE health_services SET title=?, description=?, images=? WHERE id=?', [title, description, imagesString, id]);
        res.json({ message: 'Service updated successfully' });
    } catch (err) { next(err); }
});
router.delete('/health-services/:id', async (req, res, next) => { try { await pool.execute('DELETE FROM health_services WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted successfully' }); } catch (err) { next(err); } });

module.exports = router;