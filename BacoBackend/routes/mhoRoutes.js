const express = require('express');
const router = express.Router();
const { pool, fs, path, saveBase64Image, BASE_URL, authenticateAdmin } = require('./_shared');

const parseMhoBadges = (raw) => {
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) return [];
        return arr.map(b => String(b || '').trim()).filter(Boolean).slice(0, 6);
    } catch (e) { return []; }
};

const parseMhoBullets = (raw) => {
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) return [];
        return arr.map(b => String(b || '').trim()).filter(Boolean);
    } catch (e) { return []; }
};

// Validate + normalize an http(s) URL; '' or null clears it
const normalizeFormUrl = (val) => {
    const s = String(val || '').trim();
    if (!s) return null;
    try {
        const u = new URL(s);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        return u.href;
    } catch (e) { return null; }
};

// ── Public: everything the MHO page needs, one call ──
router.get('/mho-content', async (req, res, next) => {
    try {
        const [infoRows] = await pool.execute('SELECT title, poster_title, badges_json FROM mho_page_info ORDER BY id ASC LIMIT 1');
        const [services] = await pool.execute('SELECT id, name, description, bullets_json, detail, sort_order FROM mho_services ORDER BY sort_order ASC, id ASC');
        const [gform] = await pool.execute('SELECT form_url, image_path FROM mho_google_form ORDER BY id ASC LIMIT 1');
        const gf = gform[0] || null;
        res.json({
            info: {
                title: infoRows.length > 0 ? infoRows[0].title : 'Municipal Health Office',
                posterTitle: infoRows.length > 0 ? (infoRows[0].poster_title || 'Municipal Health\nOffice Services') : 'Municipal Health\nOffice Services',
                badges: infoRows.length > 0 ? parseMhoBadges(infoRows[0].badges_json) : []
            },
            services: services.map(s => ({
                id: s.id,
                name: s.name,
                desc: s.description || '',
                bullets: parseMhoBullets(s.bullets_json),
                detail: s.detail || null
            })),
            googleForm: gf ? {
                url: gf.form_url || null,
                image: gf.image_path ? `${BASE_URL}/uploads/${gf.image_path}` : null
            } : null
        });
    } catch (err) { next(err); }
});

// ── Admin: page settings ──
router.put('/admin/mho/settings', authenticateAdmin, async (req, res, next) => {
    try {
        const title = String(req.body.title || '').trim();
        const posterTitle = String(req.body.posterTitle || '').trim();
        const badges = parseMhoBadges(req.body.badges);
        if (!title) return res.status(400).json({ message: 'Hero title is required.' });
        if (title.length > 255)  return res.status(400).json({ message: 'Title is too long (max 255 characters).' });
        if (posterTitle.length > 255) return res.status(400).json({ message: 'Poster title is too long (max 255 characters).' });

        const [current] = await pool.execute('SELECT * FROM mho_page_info ORDER BY id ASC LIMIT 1');
        const badgesJson = JSON.stringify(badges);
        if (current.length === 0) {
            await pool.execute('INSERT INTO mho_page_info (title, poster_title, badges_json, updated_by) VALUES (?,?,?,?)',
                [title, posterTitle || 'Municipal Health\nOffice Services', badgesJson, req.admin.id]);
        } else {
            await pool.execute('UPDATE mho_page_info SET title=?, poster_title=?, badges_json=?, updated_by=? WHERE id=?',
                [title, posterTitle || 'Municipal Health\nOffice Services', badgesJson, req.admin.id, current[0].id]);
        }

        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, NULL, ?, ?, ?, ?, ?)',
                ['mho', 'MHO Page Content', 'update',
                 JSON.stringify({ title: { new: title }, badges: { new: `${badges.length} item(s)` } }),
                 req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) { /* best-effort audit */ }
        res.json({ message: 'MHO page settings updated.' });
    } catch (err) { next(err); }
});

// ── Admin: Google Form (link + picture) — one record, partial updates ──
// Body semantics: field omitted → keep current · '' → clear · base64 image → replace
router.put('/admin/mho/google-form', authenticateAdmin, async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM mho_google_form ORDER BY id ASC LIMIT 1');
        const current = rows[0] || { form_url: null, image_path: null };

        // ── link ──
        let newUrl = current.form_url;
        if (req.body.formUrl !== undefined) {
            if (req.body.formUrl === null || req.body.formUrl === '') {
                newUrl = null;
            } else {
                const normalized = normalizeFormUrl(req.body.formUrl);
                if (!normalized) {
                    return res.status(400).json({ message: 'Invalid URL — must start with http:// or https:// (e.g. a Google Form link).' });
                }
                newUrl = normalized;
            }
        }

        // ── image (base64 upload · '' clears · undefined keeps) ──
        let newImage = current.image_path;
        if (req.body.image !== undefined) {
            if (req.body.image === null || req.body.image === '') {
                if (current.image_path) {
                    try { fs.unlinkSync(path.join(__dirname, '../uploads', current.image_path)); } catch (e) {}
                }
                newImage = null;
            } else if (typeof req.body.image === 'string' && req.body.image.startsWith('data:image')) {
                const fn = saveBase64Image(req.body.image);
                if (!fn) return res.status(400).json({ message: 'Invalid image data.' });
                if (current.image_path) {
                    try { fs.unlinkSync(path.join(__dirname, '../uploads', current.image_path)); } catch (e) {}
                }
                newImage = fn;
            }
        }

        const [existing] = await pool.execute('SELECT id FROM mho_google_form ORDER BY id ASC LIMIT 1');
        if (existing.length > 0) {
            await pool.execute('UPDATE mho_google_form SET form_url = ?, image_path = ?, updated_by = ? WHERE id = ?',
                [newUrl, newImage, req.admin.id, existing[0].id]);
        } else {
            await pool.execute('INSERT INTO mho_google_form (form_url, image_path, updated_by) VALUES (?, ?, ?)',
                [newUrl, newImage, req.admin.id]);
        }

        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, NULL, ?, ?, ?, ?, ?)',
                ['mho', 'MHO Google Form', 'update',
                 JSON.stringify({ link: { new: newUrl ? 'Set' : 'Cleared' }, image: { new: newImage ? 'Updated' : 'Cleared' } }),
                 req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) { /* best-effort audit */ }

        res.json({
            message: 'Google Form saved.',
            googleForm: {
                url: newUrl,
                image: newImage ? `${BASE_URL}/uploads/${newImage}` : null
            }
        });
    } catch (err) { next(err); }
});

// ── Admin: add a service ──
router.post('/admin/mho/services', authenticateAdmin, async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim();
        const description = String(req.body.description || '').trim();
        const bullets = parseMhoBullets(req.body.bullets);
        const detail = String(req.body.detail || '').trim().slice(0, 500) || null;
        if (!name) return res.status(400).json({ message: 'Service name is required.' });
        if (name.length > 255) return res.status(400).json({ message: 'Name is too long (max 255 characters).' });

        const [mx] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM mho_services');
        const [r] = await pool.execute(
            'INSERT INTO mho_services (name, description, bullets_json, detail, sort_order) VALUES (?,?,?,?,?)',
            [name, description || null, bullets.length ? JSON.stringify(bullets) : null, detail, mx[0].next]
        );
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['mho', r.insertId, name, 'create', JSON.stringify({ name: { new: name } }), req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.status(201).json({ message: 'Service added.', id: r.insertId });
    } catch (err) { next(err); }
});

// ── Admin: reorder (MUST be registered before /services/:id) ──
router.put('/admin/mho/services/reorder', authenticateAdmin, async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
    if (ids.length === 0) return res.status(400).json({ message: 'ids array required.' });
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < ids.length; i++) {
            await conn.execute('UPDATE mho_services SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
        }
        await conn.commit();
        res.json({ message: 'Service order updated.' });
    } catch (e) {
        try { await conn.rollback(); } catch (e2) {}
        res.status(500).json({ message: 'Reorder failed.' });
    } finally { conn.release(); }
});

// ── Admin: update a service ──
router.put('/admin/mho/services/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT * FROM mho_services WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Service not found.' });
        const c = cur[0];
        const name = req.body.name !== undefined ? String(req.body.name).trim() : c.name;
        const description = req.body.description !== undefined ? String(req.body.description).trim() : (c.description || '');
        const bullets = req.body.bullets !== undefined ? parseMhoBullets(req.body.bullets) : parseMhoBullets(c.bullets_json);
        const detail = req.body.detail !== undefined ? (String(req.body.detail).trim().slice(0, 500) || null) : c.detail;
        if (!name) return res.status(400).json({ message: 'Service name is required.' });

        await pool.execute(
            'UPDATE mho_services SET name=?, description=?, bullets_json=?, detail=? WHERE id=?',
            [name, description || null, bullets.length ? JSON.stringify(bullets) : null, detail, c.id]
        );
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['mho', c.id, name, 'update', JSON.stringify({ from: c.name, to: name }), req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.json({ message: 'Service updated.' });
    } catch (err) { next(err); }
});

// ── Admin: delete a service ──
router.delete('/admin/mho/services/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT name FROM mho_services WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Service not found.' });
        await pool.execute('DELETE FROM mho_services WHERE id = ?', [req.params.id]);
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['mho', req.params.id, cur[0].name, 'delete', null, req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.json({ message: 'Service deleted.' });
    } catch (err) { next(err); }
});

module.exports = router;