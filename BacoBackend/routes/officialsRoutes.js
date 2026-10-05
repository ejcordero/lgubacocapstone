const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool, saveBase64Image, BASE_URL, authenticateAdmin } = require('./_shared');

router.get('/officials', async (req, res, next) => {
    try {
        const [r] = await pool.execute('SELECT * FROM officials ORDER BY id ASC');
        res.json(r.map(o => ({
            id: o.id,
            name: o.name,
            position: o.position,
            term: o.term || null,
            bio: o.bio || null,
            image: o.image ? `${BASE_URL}/uploads/${o.image}` : null
        })));
    } catch (e) { next(e); }
});

router.post('/officials', authenticateAdmin, async (req, res, next) => {
    try {
        const { name, position, term, bio, image } = req.body;
        if (!name || !position) return res.status(400).json({ message: 'Name and position are required.' });
        let fn = '';
        if (image && image.startsWith('data:image')) fn = saveBase64Image(image) || '';
        const [r] = await pool.execute(
            'INSERT INTO officials (name, position, term, bio, image) VALUES (?, ?, ?, ?, ?)',
            [name, position, term || null, bio || null, fn]
        );
        const [n] = await pool.execute('SELECT * FROM officials WHERE id = ?', [r.insertId]);
        res.status(201).json(n[0]);
    } catch (e) { next(e); }
});

router.put('/officials/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, position, term, bio, image } = req.body;
        const [curr] = await pool.execute('SELECT * FROM officials WHERE id = ?', [id]);
        if (curr.length === 0) return res.status(404).json({ message: 'Official not found.' });
        const c = curr[0];
        let fn = c.image || '';
        if (image && image.startsWith('data:image')) {
            fn = saveBase64Image(image) || fn;
        } else if (image === '') {
            fn = '';
        }
        await pool.execute(
            'UPDATE officials SET name=?, position=?, term=?, bio=?, image=? WHERE id=?',
            [name || c.name, position || c.position,
             term !== undefined ? term : c.term,
             bio !== undefined ? bio : c.bio, fn, id]
        );
        const [n] = await pool.execute('SELECT * FROM officials WHERE id = ?', [id]);
        res.json(n[0]);
    } catch (e) { next(e); }
});

router.delete('/officials/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [curr] = await pool.execute('SELECT image FROM officials WHERE id = ?', [req.params.id]);
        if (curr.length === 0) return res.status(404).json({ message: 'Official not found.' });
        if (curr[0].image) { try { fs.unlinkSync(path.join(__dirname, '../uploads', curr[0].image)); } catch (e) {} }
        await pool.execute('DELETE FROM officials WHERE id = ?', [req.params.id]);
        res.json({ message: 'Official deleted.' });
    } catch (e) { next(e); }
});

   const safeJson = (raw) => {
    if (!raw || !String(raw).trim()) return {};
    try { const d = JSON.parse(raw); return d && typeof d === 'object' ? d : {}; }
    catch { return {}; }
  };
  const pick = (v, fallback) => (v === undefined ? fallback : v);
  
  async function buildMayorPayload () {
    const [rows] = await pool.execute(
      "SELECT title, subtitle, content, image, settings FROM home_sections WHERE section_key = 'mayor' LIMIT 1"
    );
    const row = rows[0] || {};
    const s = safeJson(row.settings);
  
    // live barangay count
    const [[b]] = await pool.execute('SELECT COUNT(*) AS n FROM barangays');
  
    // population single-source-of-truth = stats section settings
    let population = null;
    const [statsRows] = await pool.execute(
      "SELECT settings FROM home_sections WHERE section_key = 'stats' LIMIT 1"
    );
    if (statsRows[0]) population = safeJson(statsRows[0].settings).population ?? null;
  
    // name/photo fallback → the Officials list
    let mayorName = row.subtitle || '';
    let photo = row.image || '';
    if (!mayorName || !photo) {
      const [m] = await pool.execute(
        "SELECT name, image FROM officials WHERE position LIKE '%mayor%' AND position NOT LIKE '%vice%' ORDER BY id ASC LIMIT 1"
      );
      if (m[0]) {
        if (!mayorName) mayorName = m[0].name;
        if (!photo) photo = m[0].image || '';
      }
    }
  
    return {
      title: row.title || 'Message from the Mayor',
      mayorName,
      mayorTitle: s.mayorTitle || 'Municipal Mayor',
      image: photo ? `${BASE_URL}/uploads/${photo}` : null,
      message: row.content || '',
      bodyText: s.bodyText || '',
      buttonText: s.buttonText || 'Read Full Address',
      buttonLink: s.buttonLink || '#',
      stats: {
        barangays: s.statBarangays ?? b.n,
        population: s.statPopulation ?? population
      },
      overridden: {
        barangays: s.statBarangays != null,
        population: s.statPopulation != null
      }
    };
  }
  
  // Public
  router.get('/mayor-message', async (req, res, next) => {
    try { res.json(await buildMayorPayload()); } catch (e) { next(e); }
  });
  
  // Admin
  router.put('/mayor-message', authenticateAdmin, async (req, res, next) => {
    try {
      const { title, mayorName, mayorTitle, image, message, bodyText,
              buttonText, buttonLink, statBarangays, statPopulation } = req.body;
  
      const [currRows] = await pool.execute(
        "SELECT * FROM home_sections WHERE section_key = 'mayor' LIMIT 1"
      );
      const c = currRows[0] || null;
      const cur = c ? safeJson(c.settings) : {};
  
      // ── photo: dataURL → replace (and delete old file), '' → clear, undefined → keep
      let photo = c?.image || null;
      if (image && image.startsWith('data:image')) {
        const fn = saveBase64Image(image);
        if (fn) {
          if (photo && photo !== fn) {
            try { fs.unlinkSync(path.join(__dirname, '../uploads', photo)); } catch (e) {}
          }
          photo = fn;
        }
      } else if (image === '') {
        if (photo) { try { fs.unlinkSync(path.join(__dirname, '../uploads', photo)); } catch (e) {} }
        photo = null; // cleared → GET falls back to the Officials photo
      }
  
      const settings = JSON.stringify({
        mayorTitle:     pick(mayorTitle, cur.mayorTitle ?? 'Municipal Mayor'),
        bodyText:       pick(bodyText, cur.bodyText ?? ''),
        buttonText:     pick(buttonText, cur.buttonText ?? 'Read Full Address'),
        buttonLink:     pick(buttonLink, cur.buttonLink ?? '#'),
        statBarangays:  pick(statBarangays, cur.statBarangays ?? null),
        statPopulation: pick(statPopulation, cur.statPopulation ?? null)
      });
  
      if (c) {
        await pool.execute(
          "UPDATE home_sections SET title=?, subtitle=?, content=?, image=?, settings=? WHERE section_key='mayor'",
          [pick(title, c.title), pick(mayorName, c.subtitle), pick(message, c.content), photo, settings]
        );
      } else {
        await pool.execute(
          "INSERT INTO home_sections (section_key, title, subtitle, content, image, settings) VALUES ('mayor', ?, ?, ?, ?, ?)",
          [title ?? 'Message from the Mayor', mayorName ?? '', message ?? '', photo, settings]
        );
      }
  
      res.json(await buildMayorPayload());
    } catch (e) { next(e); }
  });

module.exports = router;