const express = require('express');
const router = express.Router();
const { pool, fs, path, saveBase64Image, BASE_URL, authenticateAdmin } = require('./_shared');

const mapOffice = (o) => ({
    id: o.id,
    name: o.name,
    location: o.location || '',
    contact: o.contact || '',
    email: o.email || '',
    linkPage: o.link_page || '',
    logo: o.logo_path ? `${BASE_URL}/uploads/${o.logo_path}` : null,
    createdAt: o.created_at
});

// Validate + normalize an http(s) URL; '' / null → null
const normalizeUrl = (val) => {
    const s = String(val || '').trim();
    if (!s) return null;
    try {
        const u = new URL(s);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u.href;
    } catch (e) { return null; }
};

// Multiline fields (contact/email/location): trim each line, drop empties
const cleanMultiline = (val, maxLines = 6) =>
    String(val || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, maxLines)
        .join('\n') || null;

// ── Public: the full offices directory ──
router.get('/offices', async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM offices ORDER BY sort_order ASC, id ASC');
        res.json(rows.map(mapOffice));
    } catch (err) { next(err); }
});

// ── Admin: reorder (MUST be registered before /offices/:id) ──
router.put('/admin/offices/reorder', authenticateAdmin, async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
    if (ids.length === 0) return res.status(400).json({ message: 'ids array required.' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < ids.length; i++) {
            await conn.execute('UPDATE offices SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
        }
        await conn.commit();
        res.json({ message: 'Office order updated.' });
    } catch (e) {
        try { await conn.rollback(); } catch (e2) {}
        res.status(500).json({ message: 'Reorder failed.' });
    } finally { conn.release(); }
});

// ── Admin: add an office ──
router.post('/admin/offices', authenticateAdmin, async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim();
        if (!name) return res.status(400).json({ message: 'Office name is required.' });
        if (name.length > 255) return res.status(400).json({ message: 'Name is too long (max 255 characters).' });

        const rawLink = String(req.body.linkPage || '').trim();
        const linkPage = rawLink ? normalizeUrl(rawLink) : null;
        if (rawLink && !linkPage) {
            return res.status(400).json({ message: 'Link page must be a valid http(s) URL.' });
        }

        let logoPath = null;
        if (req.body.logo && typeof req.body.logo === 'string' && req.body.logo.startsWith('data:image')) {
            logoPath = saveBase64Image(req.body.logo);
            if (!logoPath) return res.status(400).json({ message: 'Invalid logo image data.' });
        }

        const [mx] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM offices');
        const [r] = await pool.execute(
            'INSERT INTO offices (name, location, contact, email, link_page, logo_path, sort_order) VALUES (?,?,?,?,?,?,?)',
            [name, cleanMultiline(req.body.location, 3), cleanMultiline(req.body.contact), cleanMultiline(req.body.email), linkPage, logoPath, mx[0].next]
        );

        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['offices', r.insertId, name, 'create', JSON.stringify({ name: { new: name } }), req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}

        const [rows] = await pool.execute('SELECT * FROM offices WHERE id = ?', [r.insertId]);
        res.status(201).json(mapOffice(rows[0]));
    } catch (err) { next(err); }
});

// ── Admin: update an office ──
// Logo semantics: omitted → keep current · '' → clear (file unlinked) · base64 → replace (old file unlinked)
router.put('/admin/offices/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT * FROM offices WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Office not found.' });
        const c = cur[0];

        const name = req.body.name !== undefined ? String(req.body.name).trim() : c.name;
        if (!name) return res.status(400).json({ message: 'Office name is required.' });

        let linkPage = c.link_page;
        if (req.body.linkPage !== undefined) {
            const rawLink = String(req.body.linkPage || '').trim();
            linkPage = rawLink ? normalizeUrl(rawLink) : null;
            if (rawLink && !linkPage) {
                return res.status(400).json({ message: 'Link page must be a valid http(s) URL.' });
            }
        }

        let logoPath = c.logo_path;
        if (req.body.logo !== undefined) {
            if (req.body.logo === null || req.body.logo === '') {
                if (c.logo_path) { try { fs.unlinkSync(path.join(__dirname, '../uploads', c.logo_path)); } catch (e) {} }
                logoPath = null;
            } else if (typeof req.body.logo === 'string' && req.body.logo.startsWith('data:image')) {
                const fn = saveBase64Image(req.body.logo);
                if (!fn) return res.status(400).json({ message: 'Invalid logo image data.' });
                if (c.logo_path) { try { fs.unlinkSync(path.join(__dirname, '../uploads', c.logo_path)); } catch (e) {} }
                logoPath = fn;
            }
        }

        await pool.execute(
            'UPDATE offices SET name=?, location=?, contact=?, email=?, link_page=?, logo_path=? WHERE id=?',
            [
                name,
                req.body.location !== undefined ? cleanMultiline(req.body.location, 3) : c.location,
                req.body.contact !== undefined ? cleanMultiline(req.body.contact) : c.contact,
                req.body.email !== undefined ? cleanMultiline(req.body.email) : c.email,
                linkPage,
                logoPath,
                c.id
            ]
        );

        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['offices', c.id, name, 'update', JSON.stringify({ from: c.name, to: name }), req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}

        const [rows] = await pool.execute('SELECT * FROM offices WHERE id = ?', [c.id]);
        res.json({ message: 'Office updated.', office: mapOffice(rows[0]) });
    } catch (err) { next(err); }
});

// ── Admin: delete an office ──
router.delete('/admin/offices/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT name, logo_path FROM offices WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Office not found.' });
        if (cur[0].logo_path) { try { fs.unlinkSync(path.join(__dirname, '../uploads', cur[0].logo_path)); } catch (e) {} }
        await pool.execute('DELETE FROM offices WHERE id = ?', [req.params.id]);
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['offices', req.params.id, cur[0].name, 'delete', null, req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.json({ message: 'Office deleted.' });
    } catch (err) { next(err); }
});

module.exports = router;