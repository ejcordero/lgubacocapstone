const express = require('express');
const router = express.Router();
const { pool, fs, path, IMG_BASE, resolveMainImage, processGalleryImages, authenticateAdmin } = require('./_shared');

// ── helpers ──
// Explicit camelCase mapping — the DB is snake_case, the frontend is camelCase.
const mapSchool = (s) => {
    let gallery = [];
    try {
        gallery = s.gallery ? String(s.gallery).split(',').map(x => x.trim()).filter(Boolean).map(f => `${IMG_BASE}/${f}`) : [];
    } catch (e) { gallery = []; }
    let tags = [];
    try { tags = s.tags ? String(s.tags).split('|').filter(Boolean) : []; } catch (e) {}
    return {
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status || 'active',
        location: s.location || '',
        address: s.address || '',
        contactPerson: s.contact_person || '',
        phone: s.phone || '',
        email: s.email || '',
        hours: s.hours || '',
        fbLink: s.fb_link || '',
        lat: s.lat,
        lng: s.lng,
        description: s.description || '',
        tags,
        logo: s.logo ? `${IMG_BASE}/${s.logo}` : null,
        image: s.image ? `${IMG_BASE}/${s.image}` : null,
        gallery,
        createdAt: s.created_at
    };
};

const numOrNull = (v) => (v === '' || v == null || isNaN(Number(v))) ? null : Number(v);

const cleanUrl = (val) => {
    const str = String(val || '').trim();
    if (!str) return null;
    return /^https?:\/\//i.test(str) ? str : null;
};

const unlinkUpload = (filename) => {
    if (!filename) return;
    try { fs.unlinkSync(path.join(__dirname, '../uploads', filename)); } catch (e) {}
};

const logHistory = async (adminId, adminEmail, entityId, title, action, changes) => {
    try {
        await pool.execute(
            'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['schools', entityId, title, action, JSON.stringify(changes || {}), adminId, adminEmail || 'Admin']
        );
    } catch (e) { /* best-effort */ }
};

// ── Public: the full directory (no auth) ──
router.get('/schools', async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM schools ORDER BY name ASC');
        res.json(rows.map(mapSchool));
    } catch (err) { next(err); }
});

// ── Admin: create ──
router.post('/admin/schools', authenticateAdmin, async (req, res, next) => {
    try {
        const { name, type, status, location, address, contactPerson, phone, email, fbLink, hours,
                lat, lng, description, tags, logo, image, gallery } = req.body;
        if (!name || !String(name).trim()) return res.status(400).json({ message: 'School name is required.' });

        const logoFn = resolveMainImage(logo, '');
        const imageFn = resolveMainImage(image, '');
        const gal = processGalleryImages(gallery);
        const tagsStr = Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean).join('|') : null;
        const fb = cleanUrl(fbLink);
        if (fbLink && String(fbLink).trim() && !fb) {
            return res.status(400).json({ message: 'Facebook link must start with http:// or https://.' });
        }

        const [result] = await pool.execute(
            `INSERT INTO schools (name, type, status, location, address, contact_person, phone, email, fb_link, hours, lat, lng, description, tags, logo, image, gallery)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                String(name).trim(),
                type || 'elementary',
                status === 'closed' ? 'closed' : 'active',
                location || null, address || null, contactPerson || null, phone || null, email || null, fb, hours || null,
                numOrNull(lat), numOrNull(lng),
                description || null, tagsStr,
                logoFn || null, imageFn || null,
                gal.provided ? gal.filenames.join(',') : null
            ]
        );

        await logHistory(req.admin.id, req.admin.email, result.insertId, String(name).trim(), 'create',
            { name: { new: String(name).trim() }, type: { new: type || 'elementary' } });

        const [rows] = await pool.execute('SELECT * FROM schools WHERE id = ?', [result.insertId]);
        res.status(201).json(mapSchool(rows[0]));
    } catch (err) { next(err); }
});

// ── Admin: update ──
router.put('/admin/schools/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT * FROM schools WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'School not found.' });
        const c = cur[0];

        const b = req.body;
        const name = b.name !== undefined ? String(b.name).trim() : c.name;
        if (!name) return res.status(400).json({ message: 'School name is required.' });

        const logoFn = resolveMainImage(b.logo, c.logo);
        const imageFn = resolveMainImage(b.image, c.image);
        if (logoFn !== (c.logo || '')) unlinkUpload(c.logo);
        if (imageFn !== (c.image || '')) unlinkUpload(c.image);

        let galleryStr = c.gallery;
        const gal = processGalleryImages(b.gallery);
        if (gal.provided) {
            const keep = new Set(gal.filenames);
            String(c.gallery || '').split(',').map(x => x.trim()).filter(Boolean).forEach(f => { if (!keep.has(f)) unlinkUpload(f); });
            galleryStr = gal.filenames.join(',');
        }

        const tagsStr = b.tags !== undefined
            ? (Array.isArray(b.tags) ? b.tags.map(t => String(t).trim()).filter(Boolean).join('|') : null)
            : c.tags;

        let fb = c.fb_link;
        if (b.fbLink !== undefined) {
            fb = cleanUrl(b.fbLink);
            if (b.fbLink && String(b.fbLink).trim() && !fb) {
                return res.status(400).json({ message: 'Facebook link must start with http:// or https://.' });
            }
        }

        await pool.execute(
            `UPDATE schools SET name=?, type=?, status=?, location=?, address=?, contact_person=?, phone=?, email=?, fb_link=?, hours=?,
                    lat=?, lng=?, description=?, tags=?, logo=?, image=?, gallery=? WHERE id=?`,
            [
                name,
                b.type !== undefined ? b.type : c.type,
                b.status !== undefined ? (b.status === 'closed' ? 'closed' : 'active') : c.status,
                b.location !== undefined ? b.location : c.location,
                b.address !== undefined ? b.address : c.address,
                b.contactPerson !== undefined ? b.contactPerson : c.contact_person,
                b.phone !== undefined ? b.phone : c.phone,
                b.email !== undefined ? b.email : c.email,
                fb,
                b.hours !== undefined ? b.hours : c.hours,
                b.lat !== undefined ? numOrNull(b.lat) : c.lat,
                b.lng !== undefined ? numOrNull(b.lng) : c.lng,
                b.description !== undefined ? b.description : c.description,
                tagsStr,
                logoFn || null, imageFn || null, galleryStr,
                c.id
            ]
        );

        await logHistory(req.admin.id, req.admin.email, c.id, name, 'update', { name: { old: c.name, new: name } });

        const [rows] = await pool.execute('SELECT * FROM schools WHERE id = ?', [c.id]);
        res.json({ message: 'School updated.', school: mapSchool(rows[0]) });
    } catch (err) { next(err); }
});

// ── Admin: delete ──
router.delete('/admin/schools/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT * FROM schools WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'School not found.' });
        const c = cur[0];
        unlinkUpload(c.logo);
        unlinkUpload(c.image);
        String(c.gallery || '').split(',').map(x => x.trim()).filter(Boolean).forEach(unlinkUpload);
        await pool.execute('DELETE FROM schools WHERE id = ?', [c.id]);
        await logHistory(req.admin.id, req.admin.email, c.id, c.name, 'delete', null);
        res.json({ message: 'School deleted.' });
    } catch (err) { next(err); }
});

module.exports = router;