const express = require('express');
const router = express.Router();
const { pool, authenticateAdmin } = require('./_shared');

const MUNICIPALITY_INFO_DEFAULTS = {
    heading: 'Barangays\nin Baco',
    body: 'Locate and explore the barangays, landmarks, and communities of Baco. This interactive map lets you discover each subdivision — from coastal villages to highland settlements.',
    about: `The Municipality of Baco is a 1st class municipality in the province of Oriental Mindoro, Philippines. As of July 1, 2024, the total population of the municipality of Baco in Oriental Mindoro is 40,159 people, according to census data.

Baco is known for its rich natural resources, including the vast agricultural lands that produce high-quality rice and fruits. The town is also the gateway to the majestic Mount Halcon, one of the toughest mountain climbs in the country.

The municipality is politically subdivided into 27 barangays. It is home to a diverse population, including the indigenous Alangan Mangyan tribes.`,
    totalArea: '216 km²'
};

const mapMunicipalityRow = (row) => ({
    heading: row.heading,
    body: row.body || '',
    about: row.about || '',
    totalArea: row.total_area || ''
});

// ── Public: any visitor can read the page content ──
router.get('/municipality-settings', async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            'SELECT heading, body, about, total_area FROM municipality_info ORDER BY id ASC LIMIT 1'
        );
        if (rows.length === 0) return res.json({ ...MUNICIPALITY_INFO_DEFAULTS });
        res.json(mapMunicipalityRow(rows[0]));
    } catch (err) { next(err); }
});

// ── Admin: update the page content (also writes an audit trail) ──
router.put('/admin/municipality-settings', authenticateAdmin, async (req, res, next) => {
    try {
        const heading   = String(req.body.heading || '').trim();
        const body      = String(req.body.body || '').trim();
        const about     = String(req.body.about || '').trim();
        const totalArea = String(req.body.totalArea || '').trim().slice(0, 100);

        if (!heading)             return res.status(400).json({ message: 'Heading is required.' });
        if (heading.length > 200) return res.status(400).json({ message: 'Heading is too long (max 200 characters).' });
        if (body.length > 2000)   return res.status(400).json({ message: 'Map description is too long (max 2000 characters).' });
        if (about.length > 10000) return res.status(400).json({ message: 'About text is too long (max 10,000 characters).' });

        // Snapshot the current row for the audit diff (before overwriting)
        const [current] = await pool.execute(
            'SELECT heading, body, about, total_area FROM municipality_info ORDER BY id ASC LIMIT 1'
        );
        const oldRow = current.length > 0 ? mapMunicipalityRow(current[0]) : { ...MUNICIPALITY_INFO_DEFAULTS };

        // Upsert: update the seeded row, or insert if the table was somehow empty
        const [rows] = await pool.execute('SELECT id FROM municipality_info LIMIT 1');
        if (rows.length > 0) {
            await pool.execute(
                'UPDATE municipality_info SET heading = ?, body = ?, about = ?, total_area = ?, updated_by = ? WHERE id = ?',
                [heading, body, about, totalArea, req.admin.id, rows[0].id]
            );
        } else {
            await pool.execute(
                'INSERT INTO municipality_info (heading, body, about, total_area, updated_by) VALUES (?, ?, ?, ?, ?)',
                [heading, body, about, totalArea, req.admin.id]
            );
        }
        const saved = { heading, body, about, totalArea };

        // Audit trail — only log fields that actually changed
        const clip = (s) => (s.length > 120 ? s.slice(0, 120) + '…' : s);
        const changes = {};
        for (const key of ['heading', 'body', 'about', 'totalArea']) {
            const oldVal = String(oldRow[key] ?? '');
            const newVal = String(saved[key] ?? '');
            if (oldVal !== newVal) changes[key] = { old: clip(oldVal), new: clip(newVal) };
        }
        if (Object.keys(changes).length > 0) {
            try {
                await pool.execute(
                    'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, NULL, ?, ?, ?, ?, ?)',
                    ['municipality', 'Municipality Page Content', 'update', JSON.stringify(changes), req.admin.id, req.admin.email || 'Admin']
                );
            } catch (e) { /* best-effort audit */ }
        }

        res.json({ message: 'Municipality page content updated.', content: saved });
    } catch (err) { next(err); }
});

module.exports = router;