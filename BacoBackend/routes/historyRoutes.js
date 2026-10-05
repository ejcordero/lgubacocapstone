const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool, saveBase64Image, BASE_URL, authenticateAdmin } = require('./_shared');

const HISTORY_INFO_DEFAULTS = {
    title: 'History of Baco',
    heroSub: "The story of one of Mindoro's oldest towns — from being the province's first capital to the strong community it is today.",
    introText: '',
    heritageNote: '',
    facts: [],
    asideImage: null, asideImageRaw: null
};

const clipForLog = (s) => (String(s).length > 120 ? String(s).slice(0, 120) + '…' : String(s));

const resolveHistoryImage = (val) => {
    if (!val) return null;
    if (/^https?:\/\//i.test(val) || val.startsWith('/')) return val;
    return `${BASE_URL}/uploads/${val}`;
};

const parseHistoryFacts = (raw) => {
    try {
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(arr)) return [];
        return arr
            .map(f => ({ label: String(f?.label || '').trim(), value: String(f?.value || '').trim() }))
            .filter(f => f.label && f.value);
    } catch (e) { return []; }
};

// Normalize a base64-or-URL image input → stored value (or null to clear)
function historyImageInput(input) {
    if (input === undefined) return undefined;      // keep current
    if (input === null || input === '') return null; // clear
    if (typeof input === 'string' && input.startsWith('data:image')) return saveBase64Image(input);
    if (typeof input === 'string') return input.trim();
    return undefined;
}

// ── Public: everything the History page needs, one call ──
router.get('/history-content', async (req, res, next) => {
    try {
        const [infoRows] = await pool.execute('SELECT * FROM history_page_info ORDER BY id ASC LIMIT 1');
        const [timeline] = await pool.execute('SELECT id, year, label, event, detail FROM history_timeline ORDER BY sort_order ASC, id ASC');
        const [gallery]  = await pool.execute('SELECT id, title, year, description, image FROM history_gallery ORDER BY sort_order ASC, id ASC');

        let info = { ...HISTORY_INFO_DEFAULTS };
        if (infoRows.length > 0) {
            const r = infoRows[0];
            info = {
                title: r.title,
                heroSub: r.hero_sub || '',
                introText: r.intro_text || '',
                heritageNote: r.heritage_note || '',
                facts: parseHistoryFacts(r.facts_json),
                asideImage: resolveHistoryImage(r.aside_image),
                asideImageRaw: r.aside_image || null
            };
        }

        res.json({
            info,
            timeline,
            gallery: gallery.map(g => ({ ...g, image: resolveHistoryImage(g.image), imageRaw: g.image || null }))
        });
    } catch (err) { next(err); }
});

// ── Admin: page info ──
router.put('/admin/history-settings', authenticateAdmin, async (req, res, next) => {
    try {
        const title        = String(req.body.title || '').trim();
        const heroSub      = String(req.body.heroSub || '').trim();
        const introText    = String(req.body.introText || '').trim();
        const heritageNote = String(req.body.heritageNote || '').trim();
        const facts        = parseHistoryFacts(req.body.facts);

        if (!title) return res.status(400).json({ message: 'Title is required.' });
        if (title.length > 255)        return res.status(400).json({ message: 'Title is too long (max 255 characters).' });
        if (heroSub.length > 500)      return res.status(400).json({ message: 'Hero subtitle is too long (max 500 characters).' });
        if (introText.length > 20000)  return res.status(400).json({ message: 'Intro text is too long (max 20,000 characters).' });
        if (heritageNote.length > 2000) return res.status(400).json({ message: 'Heritage note is too long (max 2,000 characters).' });
        if (facts.length > 12)         return res.status(400).json({ message: 'Too many facts (max 12).' });

        const asideStored = historyImageInput(req.body.asideImage);

        const [current] = await pool.execute('SELECT * FROM history_page_info ORDER BY id ASC LIMIT 1');
        const old = current.length > 0 ? {
            title: current[0].title, heroSub: current[0].hero_sub || '',
            introText: current[0].intro_text || '', heritageNote: current[0].heritage_note || '',
            facts: parseHistoryFacts(current[0].facts_json), aside: current[0].aside_image || null
        } : { ...HISTORY_INFO_DEFAULTS, facts: [], aside: HISTORY_INFO_DEFAULTS.asideImageRaw };

        const factsJson = JSON.stringify(facts);
        if (current.length === 0) {
            await pool.execute(
                'INSERT INTO history_page_info (title, hero_sub, intro_text, heritage_note, facts_json, aside_image, updated_by) VALUES (?,?,?,?,?,?,?)',
                [title, heroSub, introText, heritageNote, factsJson, asideStored ?? null, req.admin.id]
            );
        } else {
            const asideFinal = asideStored === undefined ? old.aside : asideStored;
            await pool.execute(
                'UPDATE history_page_info SET title=?, hero_sub=?, intro_text=?, heritage_note=?, facts_json=?, aside_image=?, updated_by=? WHERE id=?',
                [title, heroSub, introText, heritageNote, factsJson, asideFinal, req.admin.id, current[0].id]
            );
        }

        const saved = { title, heroSub, introText, heritageNote, facts, aside: asideStored === undefined ? old.aside : asideStored };
        const changes = {};
        if (old.title !== saved.title)                            changes.title = { old: clipForLog(old.title), new: clipForLog(saved.title) };
        if (old.heroSub !== saved.heroSub)                        changes.heroSub = { old: clipForLog(old.heroSub), new: clipForLog(saved.heroSub) };
        if (old.introText !== saved.introText)                    changes.introText = { old: clipForLog(old.introText), new: clipForLog(saved.introText) };
        if (old.heritageNote !== saved.heritageNote)              changes.heritageNote = { old: clipForLog(old.heritageNote), new: clipForLog(saved.heritageNote) };
        if (JSON.stringify(old.facts) !== factsJson)              changes.facts = { old: `${old.facts.length} item(s)`, new: `${facts.length} item(s)` };
        if ((old.aside || '') !== (saved.aside || ''))            changes.asideImage = { old: clipForLog(old.aside || '(none)'), new: clipForLog(saved.aside || '(none)') };
        if (Object.keys(changes).length > 0) {
            try {
                await pool.execute(
                    'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, NULL, ?, ?, ?, ?, ?)',
                    ['history', 'History Page Content', 'update', JSON.stringify(changes), req.admin.id, req.admin.email || 'Admin']
                );
            } catch (e) { /* best-effort */ }
        }

        res.json({ message: 'History page content updated.' });
    } catch (err) { next(err); }
});

router.put('/admin/history/timeline/reorder', authenticateAdmin, async (req, res) => {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
    if (ids.length === 0) return res.status(400).json({ message: 'ids array required.' }); // validate BEFORE getConnection
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        for (let i = 0; i < ids.length; i++) {
            await conn.execute('UPDATE history_timeline SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
        }
        await conn.commit();
        res.json({ message: 'Timeline order updated.' });
    } catch (e) {
        try { await conn.rollback(); } catch (e2) {}
        res.status(500).json({ message: 'Reorder failed.' });
    } finally { conn.release(); }
});

router.post('/admin/history/timeline', authenticateAdmin, async (req, res, next) => {
    try {
        const year  = String(req.body.year || '').trim().slice(0, 50);
        const label = String(req.body.label || '').trim().slice(0, 100);
        const event = String(req.body.event || '').trim().slice(0, 255);
        const detail = String(req.body.detail || '').trim();
        if (!year)  return res.status(400).json({ message: 'Year is required.' });
        if (!event) return res.status(400).json({ message: 'Event is required.' });
        const [mx] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM history_timeline');
        const [r] = await pool.execute(
            'INSERT INTO history_timeline (year, label, event, detail, sort_order) VALUES (?,?,?,?,?)',
            [year, label || null, event, detail || null, mx[0].next]
        );
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['history', r.insertId, `${year} — ${event}`, 'create', JSON.stringify({ year: { new: year }, event: { new: event } }), req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.status(201).json({ message: 'Timeline entry added.', id: r.insertId });
    } catch (err) { next(err); }
});

router.put('/admin/history/timeline/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT * FROM history_timeline WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Timeline entry not found.' });
        const c = cur[0];
        const year  = req.body.year  !== undefined ? String(req.body.year).trim().slice(0, 50)  : c.year;
        const label = req.body.label !== undefined ? String(req.body.label).trim().slice(0, 100) : c.label;
        const event = req.body.event !== undefined ? String(req.body.event).trim().slice(0, 255) : c.event;
        const detail = req.body.detail !== undefined ? String(req.body.detail).trim() : c.detail;
        if (!year || !event) return res.status(400).json({ message: 'Year and event are required.' });
        await pool.execute('UPDATE history_timeline SET year=?, label=?, event=?, detail=? WHERE id=?', [year, label || null, event, detail || null, c.id]);
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['history', c.id, `${year} — ${event}`, 'update',
                 JSON.stringify({ from: `${c.year} — ${clipForLog(c.event)}`, to: `${year} — ${clipForLog(event)}` }),
                 req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.json({ message: 'Timeline entry updated.' });
    } catch (err) { next(err); }
});

router.delete('/admin/history/timeline/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT year, event FROM history_timeline WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Timeline entry not found.' });
        await pool.execute('DELETE FROM history_timeline WHERE id = ?', [req.params.id]);
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['history', req.params.id, `${cur[0].year} — ${cur[0].event}`, 'delete', null, req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.json({ message: 'Timeline entry deleted.' });
    } catch (err) { next(err); }
});

// ── Admin: GALLERY ──
router.put('/admin/history/gallery/reorder', authenticateAdmin, async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
        if (ids.length === 0) { conn.release(); return res.status(400).json({ message: 'ids array required.' }); }
        await conn.beginTransaction();
        for (let i = 0; i < ids.length; i++) {
            await conn.execute('UPDATE history_gallery SET sort_order = ? WHERE id = ?', [i + 1, ids[i]]);
        }
        await conn.commit();
        res.json({ message: 'Gallery order updated.' });
    } catch (e) {
        try { await conn.rollback(); } catch (e2) {}
        res.status(500).json({ message: 'Reorder failed.' });
    } finally { conn.release(); }
});

router.post('/admin/history/gallery', authenticateAdmin, async (req, res, next) => {
    try {
        const title = String(req.body.title || '').trim().slice(0, 255);
        const year  = String(req.body.year || '').trim().slice(0, 50);
        const description = String(req.body.description || '').trim();
        if (!title) return res.status(400).json({ message: 'Title is required.' });
        const imageStored = historyImageInput(req.body.image);
        const [mx] = await pool.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 as next FROM history_gallery');
        const [r] = await pool.execute(
            'INSERT INTO history_gallery (title, year, description, image, sort_order) VALUES (?,?,?,?,?)',
            [title, year || null, description || null, imageStored || null, mx[0].next]
        );
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['history', r.insertId, title, 'create', JSON.stringify({ title: { new: title }, year: { new: year } }), req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        const [row] = await pool.execute('SELECT * FROM history_gallery WHERE id = ?', [r.insertId]);
        res.status(201).json({ message: 'Gallery item added.', item: { ...row[0], image: resolveHistoryImage(row[0].image), imageRaw: row[0].image } });
    } catch (err) { next(err); }
});

router.put('/admin/history/gallery/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT * FROM history_gallery WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Gallery item not found.' });
        const c = cur[0];
        const title = req.body.title !== undefined ? String(req.body.title).trim().slice(0, 255) : c.title;
        const year  = req.body.year  !== undefined ? String(req.body.year).trim().slice(0, 50)  : c.year;
        const description = req.body.description !== undefined ? String(req.body.description).trim() : c.description;
        if (!title) return res.status(400).json({ message: 'Title is required.' });
        const imageStored = historyImageInput(req.body.image);
        const imageFinal = imageStored === undefined ? c.image : imageStored;

        // If replacing a backend-uploaded file (bare filename), remove the old file
        if (imageStored && c.image && !c.image.startsWith('/') && !/^https?:/i.test(c.image) && c.image !== imageStored) {
            try { fs.unlinkSync(path.join(__dirname, '../uploads', c.image)); } catch (e) {}
        }

        await pool.execute('UPDATE history_gallery SET title=?, year=?, description=?, image=? WHERE id=?', [title, year || null, description || null, imageFinal, c.id]);
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['history', c.id, title, 'update',
                 JSON.stringify({ from: clipForLog(`${c.title} (${c.year || ''})`), to: clipForLog(`${title} (${year || ''})`) }),
                 req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        const [row] = await pool.execute('SELECT * FROM history_gallery WHERE id = ?', [c.id]);
        res.json({ message: 'Gallery item updated.', item: { ...row[0], image: resolveHistoryImage(row[0].image), imageRaw: row[0].image } });
    } catch (err) { next(err); }
});

router.delete('/admin/history/gallery/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [cur] = await pool.execute('SELECT * FROM history_gallery WHERE id = ?', [req.params.id]);
        if (cur.length === 0) return res.status(404).json({ message: 'Gallery item not found.' });
        const img = cur[0].image;
        if (img && !img.startsWith('/') && !/^https?:/i.test(img)) {
            try { fs.unlinkSync(path.join(__dirname, '../uploads', img)); } catch (e) {}
        }
        await pool.execute('DELETE FROM history_gallery WHERE id = ?', [req.params.id]);
        try {
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                ['history', req.params.id, cur[0].title, 'delete', null, req.admin.id, req.admin.email || 'Admin']
            );
        } catch (e) {}
        res.json({ message: 'Gallery item deleted.' });
    } catch (err) { next(err); }
});

module.exports = router;