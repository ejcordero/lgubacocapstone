const express = require('express');
const router = express.Router();
const { pool, saveBase64Image, BASE_URL, getArrivalsBackgrounds } = require('./_shared');

// TOURISM ROUTES
router.get('/destinations', async (req, res, next) => {
    try {
        const [destinations] = await pool.execute('SELECT * FROM tourist_destinations');
        const [images] = await pool.execute('SELECT * FROM destination_images');
        const results = destinations.map(dest => {
            const destImages = images.filter(img => img.destination_id === dest.id);
            // Guard: skip rows with no stored file so we never build /uploads/ (a 404)
            const activities = destImages
                .filter(img => img.image_path)
                .map(img => ({
                    id: img.id, name: img.caption,
                    image: `${BASE_URL}/uploads/${img.image_path}`
                }));
            return {
                ...dest,
                image: dest.main_image ? `${BASE_URL}/uploads/${dest.main_image}` : null,
                activities: activities
            };
        });
        res.json(results);
    } catch (err) { next(err); }
});

router.post('/destinations', async (req, res, next) => {
    try {
        const { name, location, status, description, contact, image, activities, lat, lng, total_arrivals } = req.body;
        // blank/undefined → NULL (stat stays hidden on the public page); otherwise clamp to >= 0
        const totalArrivals = (total_arrivals === '' || total_arrivals == null)
            ? null
            : Math.max(0, parseInt(total_arrivals) || 0);

        let mainImageFilename = '';
        if (image && !image.includes('placeholder')) mainImageFilename = saveBase64Image(image) || '';

        const [result] = await pool.execute(
            'INSERT INTO tourist_destinations (name, location, status, description, contact, main_image, lat, lng, total_arrivals) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, location, status, description, contact, mainImageFilename || null, lat || null, lng || null, totalArrivals]
        );
        const destinationId = result.insertId;

        if (activities && activities.length > 0) {
            for (const act of activities) {
                let actImageFilename = null;
                if (act.image && !act.image.includes('placeholder')) actImageFilename = saveBase64Image(act.image) || null;
                await pool.execute(
                    'INSERT INTO destination_images (destination_id, caption, image_path) VALUES (?, ?, ?)',
                    [destinationId, act.name, actImageFilename]
                );
            }
        }
        const [newRows] = await pool.execute('SELECT * FROM tourist_destinations WHERE id = ?', [destinationId]);
        res.status(201).json(newRows[0]);
    } catch (err) { next(err); }
});

router.put('/destinations/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, location, status, description, contact, image, activities, lat, lng, total_arrivals } = req.body;
        const totalArrivals = (total_arrivals === '' || total_arrivals == null)
            ? null
            : Math.max(0, parseInt(total_arrivals) || 0);

        let mainImageFilename = '';
        const [currentRows] = await pool.execute('SELECT main_image FROM tourist_destinations WHERE id = ?', [id]);
        const currentImage = currentRows[0]?.main_image || '';
        if (image && image.startsWith('data:image')) mainImageFilename = saveBase64Image(image) || '';
        else mainImageFilename = currentImage;

        await pool.execute(
            'UPDATE tourist_destinations SET name=?, location=?, status=?, description=?, contact=?, main_image=?, lat=?, lng=?, total_arrivals=? WHERE id=?',
            [name, location, status, description, contact, mainImageFilename || null, lat || null, lng || null, totalArrivals, id]
        );
        await pool.execute('DELETE FROM destination_images WHERE destination_id = ?', [id]);
        if (activities && activities.length > 0) {
            for (const act of activities) {
                // New base64 upload → save file · existing URL → keep its filename · nothing → NULL (never '')
                let actImageFilename = null;
                if (act.image && act.image.startsWith('data:image')) actImageFilename = saveBase64Image(act.image) || null;
                else if (act.image && act.image.includes('/uploads/')) actImageFilename = act.image.split('/').pop();
                await pool.execute('INSERT INTO destination_images (destination_id, caption, image_path) VALUES (?, ?, ?)', [id, act.name, actImageFilename]);
            }
        }
        res.json({ message: 'Destination updated successfully' });
    } catch (err) { next(err); }
});

router.delete('/destinations/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        await pool.execute('DELETE FROM destination_images WHERE destination_id = ?', [id]);
        await pool.execute('DELETE FROM tourist_destinations WHERE id = ?', [id]);
        res.json({ message: 'Destination deleted successfully' });
    } catch (err) { next(err); }
});

// ══════════════════════════════════════════════════════════
// TOURISM — ARRIVALS + ANALYTICS (public)
// ══════════════════════════════════════════════════════════

// ── BACO TOURIST ARRIVALS (quarterly, admin-managed — feeds public Tourism page) ──
router.get('/tourism/arrivals', async (req, res) => {
    try {
        const [summaryRows] = await pool.execute(
            'SELECT quarter_year, quarter_num, total_arrivals, domestic_pct, peak_label FROM arrivals_summary ORDER BY quarter_year DESC, quarter_num DESC LIMIT 1'
        );
        const backgrounds = await getArrivalsBackgrounds();
        if (summaryRows.length === 0) {
            return res.json({ hasData: false, summary: null, attractions: [], backgrounds });
        }
        const s = summaryRows[0];
        const [attrRows] = await pool.execute(
            'SELECT attraction_name, visitors FROM tourist_arrivals WHERE quarter_year = ? AND quarter_num = ? ORDER BY visitors DESC LIMIT 5',
            [s.quarter_year, s.quarter_num]
        );
        const domestic = Number(s.domestic_pct) || 0;
        res.json({
            hasData: true,
            summary: {
                year: s.quarter_year,
                quarter: s.quarter_num,
                label: `Q${s.quarter_num} ${s.quarter_year}`,
                totalArrivals: Number(s.total_arrivals) || 0,
                domesticPct: domestic,
                foreignPct: Math.max(0, 100 - domestic),
                peakLabel: s.peak_label || ''
            },
            attractions: attrRows.map(a => ({ name: a.attraction_name, visitors: Number(a.visitors) || 0 })),
            backgrounds
        });
    } catch (e) {
        console.error('Tourism arrivals fetch error:', e.message);
        res.status(500).json({ hasData: false, summary: null, attractions: [], backgrounds: { heroBg: null, top5Bg: null } });
    }
});

// ── TOURISM ANALYTICS — quarterly visitors chart (bookings + permits) ──
router.get('/tourism/analytics', async (req, res) => {
    try {
        const now = new Date();
        const quarters = [];
        for (let i = 7; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
            const q = Math.floor(d.getMonth() / 3) + 1;
            quarters.push({ year: d.getFullYear(), q, key: `${d.getFullYear()}-Q${q}`, label: `Q${q} ${String(d.getFullYear()).slice(2)}` });
        }

        const [hotelRows] = await pool.execute(
            `SELECT YEAR(created_at) as y, QUARTER(created_at) as q, COALESCE(SUM(pax), 0) as v
             FROM hotel_bookings WHERE status IN ('confirmed', 'completed') GROUP BY y, q`
        );
        const [permitRows] = await pool.execute(
            `SELECT YEAR(created_at) as y, QUARTER(created_at) as q, COALESCE(SUM(group_size), 0) as v
             FROM halcon_permits WHERE status != 'Cancelled' GROUP BY y, q`
        );

        const hotelMap = {};
        hotelRows.forEach(r => { hotelMap[`${r.y}-Q${r.q}`] = Number(r.v) || 0; });
        const permitMap = {};
        permitRows.forEach(r => { permitMap[`${r.y}-Q${r.q}`] = Number(r.v) || 0; });

        let total = 0;
        const result = quarters.map(qk => {
            const visitors = (hotelMap[qk.key] || 0) + (permitMap[qk.key] || 0);
            total += visitors;
            return { key: qk.key, label: qk.label, visitors };
        });

        res.json({ quarters: result, total });
    } catch (e) {
        console.error('Tourism analytics error:', e.message);
        res.json({ quarters: [], total: 0 });
    }
});

module.exports = router;