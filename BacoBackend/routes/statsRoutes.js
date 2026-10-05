const express = require('express');
const router = express.Router();
const db = require('../db'); // adjust if db.js exports { pool } or similar

// normalize db.js export: works with a mysql2 promise pool or connection
const q = async (sql) => {
  const [rows] = await db.query(sql);
  return rows;
};

const safeJson = (raw) => {
  if (!raw || !String(raw).trim()) return {};
  try { const d = JSON.parse(raw); return d && typeof d === 'object' ? d : {}; }
  catch { return {}; }
};

/* GET /stats/home — public data for the homepage "Baco at a Glance" section */
router.get('/home', async (req, res) => {
  try {
    // 1. Editable headings + manual figures
    let settings = {};
    const [section] = await q(
      "SELECT settings FROM home_sections WHERE section_key = 'stats' LIMIT 1"
    );
    if (section) settings = safeJson(section.settings);

    // 2. Live computed values
    const [bgyRow]  = await q('SELECT COUNT(*) AS n FROM barangays');
    const [areaRow] = await q('SELECT total_area FROM municipality_info ORDER BY id ASC LIMIT 1');

    let landValue = null, landUnit = 'km²';
    const rawArea = String(areaRow?.total_area || '');
    const m = rawArea.match(/([\d][\d,\.]*)/);
    if (m) {
      landValue = parseFloat(m[1].replace(/,/g, ''));
      if (/ha/i.test(rawArea) && !/km/i.test(rawArea)) landUnit = 'ha';
    }

    const stats = [
      { key: 'barangays',  label: 'Barangays',            value: bgyRow?.n ?? 0,      icon: 'fa-solid fa-map' },
      { key: 'population', label: 'Population',           value: settings.population ?? 41417, icon: 'fa-solid fa-users' },
      { key: 'households', label: 'Households',           value: settings.households ?? 8450,  icon: 'fa-solid fa-house-chimney' },
      { key: 'land_area',  label: `Land Area (${landUnit})`, value: landValue,        icon: 'fa-solid fa-ruler-combined' },
    ];

    // 3. Optional per-stat overrides from settings.stats: [{key,label,value,icon,hidden}]
    if (Array.isArray(settings.stats)) {
      const byKey = Object.fromEntries(settings.stats.map(o => [o.key, o]));
      for (const s of stats) {
        const o = byKey[s.key];
        if (!o) continue;
        if ('label'  in o) s.label  = o.label;
        if ('value'  in o) s.value  = o.value;
        if ('icon'   in o) s.icon   = o.icon;
        if ('hidden' in o) s.hidden = !!o.hidden;
      }
    }

    res.json({
      eyebrow: settings.eyebrow || 'By the Numbers',
      title:   settings.title   || 'Baco at a Glance',
      stats:   stats.filter(s => !s.hidden && s.value !== null && s.value !== undefined),
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[statsRoutes] /home failed:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

module.exports = router;