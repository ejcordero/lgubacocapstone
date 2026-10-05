const express = require('express');
const router = express.Router();
const { pool, saveBase64Image, BASE_URL } = require('./_shared');

const NEWS_CATEGORIES = [
    'Announcement', 'Tourism', 'Health', 'Education', 'Agriculture',
    'Infrastructure', 'Social Services', 'Environment', 'Events', 'Public Advisory'
];
const normalizeNewsCategory = (val, fallback = 'Announcement') =>
    NEWS_CATEGORIES.includes(val) ? val : fallback;

// Accepts 'YYYY-MM-DD' from the admin date input; anything else → NULL
// (NULL = the public page falls back to the publish date)
const normalizeNewsDate = (val) => {
    if (!val) return null;
    const s = String(val).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

router.get('/news', async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM news ORDER BY created_at DESC');
        const results = rows.map(n => {
            const rawImages = n.images || ''; let imageArray = [];
            if (rawImages) imageArray = rawImages.split(',').map(img => img.trim()).filter(img => img).map(img => `${BASE_URL}/uploads/${img}`);
            const dateObj = n.date || n.created_at;
            const formattedDate = dateObj ? new Date(dateObj).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
            return {
                ...n,
                date: formattedDate,                                        // display string (unchanged contract)
                date_raw: n.date || null,                                   // YYYY-MM-DD → admin date input
                date_sort: dateObj ? new Date(dateObj).toISOString() : null, // sortable → "newest" ordering
                image: imageArray.length > 0 ? imageArray[0] : 'https://via.placeholder.com/400x300?text=News',
                gallery: imageArray
            };
        });
        res.json(results);
    } catch (err) { next(err); }
});

router.post('/news', async (req, res, next) => {
    try {
        const { title, content, images, category, date } = req.body;
        const filenames = [];
        if (images && images.length > 0) { for (const img of images) { if (img && img.startsWith('data:image')) filenames.push(saveBase64Image(img)); } }
        const imagesString = filenames.join(',');
        const [result] = await pool.execute(
            'INSERT INTO news (title, content, read_more_text, images, category, date) VALUES (?, ?, ?, ?, ?, ?)',
            [title, content, 'Read More', imagesString, normalizeNewsCategory(category), normalizeNewsDate(date)]
        );
        const [newRows] = await pool.execute('SELECT * FROM news WHERE id = ?', [result.insertId]);
        res.status(201).json(newRows[0]);
    } catch (err) { next(err); }
});

router.put('/news/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { title, content, images, category, date } = req.body;
        const filenames = [];
        if (images && images.length > 0) { for (const img of images) { if (img && img.startsWith('data:image')) filenames.push(saveBase64Image(img)); else if (img && img.includes(`${BASE_URL}/uploads/`)) filenames.push(img.split('/').pop()); } }
        const imagesString = filenames.join(',');
        // Preserve the existing category if none was sent
        const [curr] = await pool.execute('SELECT category FROM news WHERE id = ?', [id]);
        const finalCategory = normalizeNewsCategory(category, curr[0]?.category || 'Announcement');
        await pool.execute(
            'UPDATE news SET title=?, content=?, read_more_text=?, images=?, category=?, date=? WHERE id=?',
            [title, content || '', 'Read More', imagesString, finalCategory, normalizeNewsDate(date), id]
        );
        res.json({ message: 'News updated successfully' });
    } catch (err) { next(err); }
});

router.delete('/news/:id', async (req, res, next) => { try { await pool.execute('DELETE FROM news WHERE id = ?', [req.params.id]); res.json({ message: 'Deleted successfully' }); } catch (err) { next(err); } });

module.exports = router;