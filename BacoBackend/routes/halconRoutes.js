const express = require('express');
const router = express.Router();
const { pool, fs, path, bcrypt, jwt, BASE_URL, FRONTEND_URL, authenticateToken, authenticateAdmin } = require('./_shared');
const multer = require('multer');

// ── Mt. Halcon: public availability status (admin-controlled toggle) ──
router.get('/halcon/status', async (req, res) => {
    try {
        const [rows] = await pool.execute("SELECT settings FROM page_settings WHERE page_key = 'halcon'");
        let enabled = false;
        if (rows.length > 0) {
            try {
                const raw = rows[0].settings;
                const parsed = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
                enabled = !!parsed.booking_enabled;
            } catch (e) {}
        }
        res.json({ bookingEnabled: enabled });
    } catch (e) { res.json({ bookingEnabled: false }); }
});

if (bcrypt && jwt) {

    const PERMIT_FEE_PER_HEAD = 1000;

    const halconDocDir = path.join(__dirname, '../halcon_documents');

    const halconPdfStorage = multer.diskStorage({
        destination: function (req, file, cb) {
            if (!fs.existsSync(halconDocDir)) fs.mkdirSync(halconDocDir, { recursive: true });
            cb(null, halconDocDir);
        },
        filename: function (req, file, cb) {
            const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, unique + path.extname(file.originalname));
        }
    });
    const uploadHalconPdf = multer({
        storage: halconPdfStorage,
        fileFilter: function (req, file, cb) {
            if (file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf') {
                cb(null, true);
            } else {
                cb(new Error('Only PDF files are allowed. Please upload a .pdf file.'), false);
            }
        },
        limits: { fileSize: 10 * 1024 * 1024 }
    });

    router.post('/halcon/upload-pdf', authenticateToken, (req, res) => {
        uploadHalconPdf.single('file')(req, res, function (err) {
            if (err) {
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File is too large. Maximum size is 10MB.' });
                    return res.status(400).json({ message: err.message });
                }
                return res.status(400).json({ message: err.message });
            }
            if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
            res.json({
                filePath: req.file.filename,
                originalName: req.file.originalname,
                url: `${BASE_URL}/halcon_documents/${req.file.filename}`
            });
        });
    });

    async function generatePermitId(conn) {
        const year = new Date().getFullYear();
        const [rows] = await conn.execute('SELECT COUNT(*) as cnt FROM halcon_permits WHERE YEAR(created_at) = ?', [year]);
        const nextNum = (rows[0].cnt + 1).toString().padStart(3, '0');
        return `HLCN-${year}-${nextNum}`;
    }

    // CREATE new permit
    router.post('/halcon/permits', authenticateToken, async (req, res) => {
        // ── Gate: system-wide availability (admin toggle) ──
        try {
            const [sysRows] = await pool.execute("SELECT settings FROM page_settings WHERE page_key = 'halcon'");
            const rawSettings = sysRows[0]?.settings;
            const parsedSettings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
            if (!parsedSettings.booking_enabled) {
                return res.status(403).json({ message: 'The Mt. Halcon Permit System is currently unavailable. Please email lgubacotourism@gmail.com for assistance.' });
            }
        } catch (gateErr) {
            return res.status(503).json({ message: 'Unable to verify permit system status. Please try again later.' });
        }
        const conn = await pool.getConnection();
        try {
            const { trekDate, duration, groupSize, trail, members, waiver, paymentMethod, idsFile, idsFileName, medicalFile, medicalFileName } = req.body;
            const userId = req.user.id;
            const totalFee = groupSize * PERMIT_FEE_PER_HEAD;

            if (!trekDate || !groupSize || !members || members.length === 0) return res.status(400).json({ message: 'Missing required fields.' });
            if (!waiver) return res.status(400).json({ message: 'You must accept the waiver.' });
            if (paymentMethod === 'gcash' && !idsFile) return res.status(400).json({ message: 'Valid IDs PDF is required for GCash payment.' });

            await conn.beginTransaction();
            const permitId = await generatePermitId(conn);

            let checkoutUrl = null;
            let checkoutSessionId = null;
            let paymentStatus = 'unpaid';

            if (paymentMethod === 'gcash') {
                try {
                    const paymongoRes = await fetch('https://pg-sandbox.paymongo.com/v1/checkout_sessions', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64'),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            data: { attributes: {
                                amount: Math.round(totalFee * 100), currency: 'PHP',
                                description: `Mt. Halcon Climbing Permit ${permitId}`,
                                payment_method_types: ['gcash'],
                                success_url: `${FRONTEND_URL}/user/permits/${permitId}?payment=success`,
                                cancel_url: `${FRONTEND_URL}/user/permits/${permitId}?payment=cancelled`,
                                metadata: { permit_id: permitId, user_id: String(userId) }
                            }}
                        })
                    });
                    const paymongoData = await paymongoRes.json();
                    if (paymongoData.errors) throw new Error(paymongoData.errors[0]?.detail || 'PayMongo error');
                    checkoutUrl = paymongoData.data.attributes.checkout_url;
                    checkoutSessionId = paymongoData.data.id;
                    paymentStatus = 'pending';
                } catch (pmErr) {
                    console.error('PayMongo Error:', pmErr.message);
                    return res.status(500).json({ message: 'Failed to create GCash payment. Please try On-site payment instead.' });
                }
            }

            const [permResult] = await conn.execute(
                `INSERT INTO halcon_permits (user_id, permit_id, trek_date, duration, group_size, trail, status, payment_method, payment_status, total_fee, checkout_session_id, waiver_accepted) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)`,
                [userId, permitId, trekDate, duration, groupSize, trail, paymentMethod, paymentStatus, totalFee, checkoutSessionId, waiver ? 1 : 0]
            );
            const dbPermitId = permResult.insertId;

            for (const m of members) {
                await conn.execute(`INSERT INTO halcon_members (permit_id, member_index, name, age, contact, emergency_contact, medical_condition) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [dbPermitId, m.id || m.member_index || 0, m.name, m.age, m.contact, m.emergency, m.medCondition || 'None']);
            }

            if (idsFile) await conn.execute('INSERT INTO halcon_documents (permit_id, doc_type, file_path, original_name) VALUES (?, ?, ?, ?)', [dbPermitId, 'valid_ids', idsFile, idsFileName || 'Valid_IDs.pdf']);
            if (medicalFile) await conn.execute('INSERT INTO halcon_documents (permit_id, doc_type, file_path, original_name) VALUES (?, ?, ?, ?)', [dbPermitId, 'medical_certificates', medicalFile, medicalFileName || 'Medical_Certificates.pdf']);

            await conn.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [dbPermitId, 'Application submitted', 'User']);
            if (paymentMethod === 'gcash') await conn.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [dbPermitId, 'GCash payment initiated', 'System']);

            await conn.commit();
            res.status(201).json({ permitId, id: dbPermitId, checkoutUrl, paymentMethod, paymentStatus, message: 'Application submitted successfully.' });
        } catch (err) {
            await conn.rollback();
            console.error('Create permit error:', err);
            res.status(500).json({ message: 'Failed to submit application.' });
        } finally { conn.release(); }
    });

    // GET all permits for user
    router.get('/halcon/permits', authenticateToken, async (req, res) => {
        try {
            const [permits] = await pool.execute('SELECT * FROM halcon_permits WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
            res.json(permits);
        } catch (err) { res.status(500).json({ message: 'Failed to fetch permits.' }); }
    });

    // GET single permit
    router.get('/halcon/permits/:id', authenticateToken, async (req, res) => {
        try {
            const permitId = req.params.id;
            const [permits] = await pool.execute('SELECT * FROM halcon_permits WHERE id = ? AND user_id = ?', [permitId, req.user.id]);
            if (permits.length === 0) return res.status(404).json({ message: 'Permit not found.' });
            const permit = permits[0];
            const [members] = await pool.execute('SELECT * FROM halcon_members WHERE permit_id = ? ORDER BY member_index ASC', [permitId]);
            const [documents] = await pool.execute('SELECT * FROM halcon_documents WHERE permit_id = ?', [permitId]);
            const [history] = await pool.execute('SELECT * FROM halcon_history WHERE permit_id = ? ORDER BY created_at ASC', [permitId]);

            res.json({
                ...permit,
                members: members.map(m => ({ id: m.member_index + 1, name: m.name, age: m.age, contact: m.contact, emergency: m.emergency_contact, medCondition: m.medical_condition })),
                documents: documents.map(d => ({ ...d, url: `${BASE_URL}/halcon_documents/${d.file_path}` })),
                history: history.map(h => ({ date: new Date(h.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), action: h.action }))
            });
        } catch (err) { res.status(500).json({ message: 'Failed to fetch permit.' }); }
    });

    // GET permit by code
    router.get('/halcon/permit-by-code/:code', authenticateToken, async (req, res) => {
        try {
            const [permits] = await pool.execute('SELECT * FROM halcon_permits WHERE permit_id = ? AND user_id = ?', [req.params.code, req.user.id]);
            if (permits.length === 0) return res.status(404).json({ message: 'Permit not found.' });
            const permit = permits[0];
            const [members] = await pool.execute('SELECT * FROM halcon_members WHERE permit_id = ? ORDER BY member_index ASC', [permit.id]);
            const [documents] = await pool.execute('SELECT * FROM halcon_documents WHERE permit_id = ?', [permit.id]);
            const [history] = await pool.execute('SELECT * FROM halcon_history WHERE permit_id = ? ORDER BY created_at ASC', [permit.id]);

            res.json({
                ...permit,
                members: members.map(m => ({ id: m.member_index + 1, name: m.name, age: m.age, contact: m.contact, emergency: m.emergency_contact, medCondition: m.medical_condition })),
                documents: documents.map(d => ({ ...d, url: `${BASE_URL}/halcon_documents/${d.file_path}` })),
                history: history.map(h => ({ date: new Date(h.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), action: h.action }))
            });
        } catch (err) { res.status(500).json({ message: 'Failed to fetch permit.' }); }
    });

    // UPDATE permit
    router.put('/halcon/permits/:id', authenticateToken, async (req, res) => {
        const conn = await pool.getConnection();
        try {
            const permitDbId = req.params.id;
            const { trekDate, duration, groupSize, trail, members, waiver, paymentMethod, idsFile, idsFileName, medicalFile, medicalFileName } = req.body;
            const [existing] = await conn.execute('SELECT * FROM halcon_permits WHERE id = ? AND user_id = ?', [permitDbId, req.user.id]);
            if (existing.length === 0) return res.status(404).json({ message: 'Permit not found.' });
            const permit = existing[0];
            if (!['Pending', 'Rejected'].includes(permit.status)) return res.status(400).json({ message: 'Cannot edit a permit that is already under review, approved, or cancelled.' });

            const totalFee = groupSize * PERMIT_FEE_PER_HEAD;
            const newStatus = permit.status === 'Rejected' ? 'Pending' : permit.status;
            await conn.beginTransaction();

            await conn.execute(`UPDATE halcon_permits SET trek_date=?, duration=?, group_size=?, trail=?, status=?, payment_method=?, total_fee=?, waiver_accepted=?, updated_at=NOW() WHERE id=?`,
                [trekDate, duration, groupSize, trail, newStatus, paymentMethod, totalFee, waiver ? 1 : 0, permitDbId]);

            await conn.execute('DELETE FROM halcon_members WHERE permit_id = ?', [permitDbId]);
            for (const m of members) {
                await conn.execute(`INSERT INTO halcon_members (permit_id, member_index, name, age, contact, emergency_contact, medical_condition) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [permitDbId, m.id || m.member_index || 0, m.name, m.age, m.contact, m.emergency, m.medCondition || 'None']);
            }

            if (idsFile) {
                await conn.execute('DELETE FROM halcon_documents WHERE permit_id = ? AND doc_type = ?', [permitDbId, 'valid_ids']);
                await conn.execute('INSERT INTO halcon_documents (permit_id, doc_type, file_path, original_name) VALUES (?, ?, ?, ?)', [permitDbId, 'valid_ids', idsFile, idsFileName || 'Valid_IDs.pdf']);
            }
            if (medicalFile) {
                await conn.execute('DELETE FROM halcon_documents WHERE permit_id = ? AND doc_type = ?', [permitDbId, 'medical_certificates']);
                await conn.execute('INSERT INTO halcon_documents (permit_id, doc_type, file_path, original_name) VALUES (?, ?, ?, ?)', [permitDbId, 'medical_certificates', medicalFile, medicalFileName || 'Medical_Certificates.pdf']);
            }

            const historyAction = permit.status === 'Rejected' ? 'Application resubmitted after rejection' : 'Application updated';
            await conn.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [permitDbId, historyAction, 'User']);

            let checkoutUrl = null;
            if (paymentMethod === 'gcash' && permit.payment_status !== 'paid') {
                try {
                    const paymongoRes = await fetch('https://pg-sandbox.paymongo.com/v1/checkout_sessions', {
                        method: 'POST',
                        headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64'), 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            data: { attributes: {
                                amount: Math.round(totalFee * 100), currency: 'PHP',
                                description: `Mt. Halcon Permit ${permit.permit_id} (Resubmit)`,
                                payment_method_types: ['gcash'],
                                success_url: `${FRONTEND_URL}/user/permits/${permit.permit_id}?payment=success`,
                                cancel_url: `${FRONTEND_URL}/user/permits/${permit.permit_id}?payment=cancelled`,
                                metadata: { permit_id: permit.permit_id, user_id: String(req.user.id) }
                            }}
                        })
                    });
                    const paymongoData = await paymongoRes.json();
                    if (!paymongoData.errors) {
                        checkoutUrl = paymongoData.data.attributes.checkout_url;
                        await conn.execute('UPDATE halcon_permits SET checkout_session_id=?, payment_status=? WHERE id=?', [paymongoData.data.id, 'pending', permitDbId]);
                        await conn.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [permitDbId, 'GCash payment initiated (resubmit)', 'System']);
                    }
                } catch (pmErr) { console.error('PayMongo resubmit error:', pmErr.message); }
            }

            await conn.commit();
            res.json({ message: permit.status === 'Rejected' ? 'Application resubmitted successfully.' : 'Application updated successfully.', checkoutUrl, permitId: permit.permit_id });
        } catch (err) {
            await conn.rollback(); console.error('Update permit error:', err); res.status(500).json({ message: 'Failed to update application.' });
        } finally { conn.release(); }
    });

    // CANCEL permit
    router.put('/halcon/permits/:id/cancel', authenticateToken, async (req, res) => {
        try {
            const [existing] = await pool.execute('SELECT * FROM halcon_permits WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            if (existing.length === 0) return res.status(404).json({ message: 'Permit not found.' });
            if (existing[0].status !== 'Pending') return res.status(400).json({ message: 'Only pending permits can be cancelled.' });
            await pool.execute('UPDATE halcon_permits SET status = ? WHERE id = ?', ['Cancelled', req.params.id]);
            await pool.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [req.params.id, 'Application cancelled by user', 'User']);
            res.json({ message: 'Permit cancelled successfully.' });
        } catch (err) { res.status(500).json({ message: 'Failed to cancel permit.' }); }
    });

    // CHECK GCash payment status
    router.get('/halcon/permits/:id/payment-status', authenticateToken, async (req, res) => {
        try {
            const [permits] = await pool.execute('SELECT * FROM halcon_permits WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
            if (permits.length === 0) return res.status(404).json({ message: 'Permit not found.' });
            const permit = permits[0];
            if (!permit.checkout_session_id || permit.payment_status === 'paid') return res.json({ paymentStatus: permit.payment_status, paymentReference: permit.payment_reference });

            try {
                const pmRes = await fetch(`https://pg-sandbox.paymongo.com/v1/checkout_sessions/${permit.checkout_session_id}`, { headers: { 'Authorization': 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64') } });
                const pmData = await pmRes.json();
                const paymentIntent = pmData.data?.attributes?.payments?.[0];
                const pmStatus = paymentIntent?.attributes?.status;
                let newStatus = permit.payment_status; let ref = permit.payment_reference;

                if (pmStatus === 'paid') {
                    newStatus = 'paid'; ref = paymentIntent.id;
                    await pool.execute('UPDATE halcon_permits SET payment_status = ?, payment_reference = ? WHERE id = ?', ['paid', ref, permit.id]);
                    await pool.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [permit.id, `GCash payment confirmed (Ref: ${ref})`, 'System']);
                } else if (pmStatus === 'failed') {
                    newStatus = 'failed';
                    await pool.execute('UPDATE halcon_permits SET payment_status = ? WHERE id = ?', ['failed', permit.id]);
                }
                res.json({ paymentStatus: newStatus, paymentReference: ref });
            } catch (pmErr) {
                console.error('PayMongo check error:', pmErr.message);
                res.json({ paymentStatus: permit.payment_status, paymentReference: permit.payment_reference });
            }
        } catch (err) { res.status(500).json({ message: 'Failed to check payment status.' }); }
    });

    // PayMongo webhook
    // ⚠️ For production, verify the Paymongo-Signature header (HMAC-SHA256)
    //    against your webhook secret. Requires express.raw() for this route
    //    in server.js before the JSON body parser — left as-is to preserve
    //    sandbox behavior.
    router.post('/halcon/payment-webhook', async (req, res) => {
        try {
            const event = req.body;
            if (event.type === 'checkout.session.payment.paid') {
                const sessionId = event.data?.attributes?.checkout_session_id;
                const paymentId = event.data?.id;
                if (sessionId) {
                    await pool.execute('UPDATE halcon_permits SET payment_status = ?, payment_reference = ? WHERE checkout_session_id = ?', ['paid', paymentId, sessionId]);
                    const [rows] = await pool.execute('SELECT id FROM halcon_permits WHERE checkout_session_id = ?', [sessionId]);
                    if (rows.length) await pool.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [rows[0].id, `GCash payment confirmed (Ref: ${paymentId})`, 'System']);
                }
            }
            res.status(200).send('OK');
        } catch (err) { res.status(500).send('Error'); }
    });

    // ================= ADMIN HALCON ROUTES =================
    // SECURITY: these require an admin token
    router.get('/halcon/admin/permits', authenticateAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute(`SELECT hp.*, COALESCE(CONCAT(tu.first_name, ' ', tu.last_name), tu.email) as applicant_name FROM halcon_permits hp LEFT JOIN tourism_users tu ON hp.user_id = tu.id ORDER BY hp.created_at DESC`);
            res.json(rows);
        } catch (err) { res.status(500).json({ message: 'Failed to fetch permits.' }); }
    });

    router.get('/halcon/admin/permits/:id/full', authenticateAdmin, async (req, res) => {
        try {
            const id = req.params.id;
            const [permits] = await pool.execute('SELECT * FROM halcon_permits WHERE id = ?', [id]);
            if (permits.length === 0) return res.status(404).json({ message: 'Permit not found.' });
            const permit = permits[0];
            const [members] = await pool.execute('SELECT * FROM halcon_members WHERE permit_id = ? ORDER BY member_index ASC', [id]);
            const [documents] = await pool.execute('SELECT * FROM halcon_documents WHERE permit_id = ?', [id]);
            const [history] = await pool.execute('SELECT * FROM halcon_history WHERE permit_id = ? ORDER BY created_at ASC', [id]);
            const [applicant] = await pool.execute('SELECT id, COALESCE(CONCAT(first_name, " ", last_name), email) as applicant_name, phone FROM tourism_users WHERE id = ?', [permit.user_id]);

            res.json({
                ...permit,
                applicant: applicant[0] || { applicant_name: 'Unknown' },
                members: members.map(m => ({ ...m, age: Number(m.age) })),
                documents: documents.map(d => ({ ...d, url: `${BASE_URL}/halcon_documents/${d.file_path}` })),
                history: history.map(h => ({ ...h, date: new Date(h.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }), action: h.action, performed_by: h.performed_by }))
            });
        } catch (err) { res.status(500).json({ message: 'Failed to fetch permit details.' }); }
    });

    router.put('/halcon/admin/permits/:id/status', authenticateAdmin, async (req, res) => {
        try {
            const id = req.params.id; const { status, remarks } = req.body;
            const validStatuses = ['Pending', 'Under Review', 'Approved', 'Rejected', 'Cancelled'];
            if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status.' });
            const [existing] = await pool.execute('SELECT * FROM halcon_permits WHERE id = ?', [id]);
            if (existing.length === 0) return res.status(404).json({ message: 'Permit not found.' });
            const finalRemarks = status === 'Rejected' ? (remarks || '') : '';
            await pool.execute('UPDATE halcon_permits SET status = ?, remarks = ?, updated_at = NOW() WHERE id = ?', [status, finalRemarks, id]);
            let actionText = `Status changed to ${status}`;
            if (status === 'Rejected' && finalRemarks) actionText += ` — ${finalRemarks}`;
            await pool.execute('INSERT INTO halcon_history (permit_id, action, performed_by) VALUES (?, ?, ?)', [id, actionText, 'Admin']);
            res.json({ message: 'Status updated successfully.' });
        } catch (err) { res.status(500).json({ message: 'Failed to update status.' }); }
    });

    // ── Admin: system-wide availability toggle (moved from admin block) ──
    router.put('/halcon/admin/availability', authenticateAdmin, async (req, res) => {
        try {
            const enabled = !!req.body.enabled;
            const settingsJson = JSON.stringify({ booking_enabled: enabled });
            const [rows] = await pool.execute("SELECT id FROM page_settings WHERE page_key = 'halcon'");
            if (rows.length === 0) {
                await pool.execute("INSERT INTO page_settings (page_key, title, settings) VALUES ('halcon', 'Mt. Halcon Permit System', ?)", [settingsJson]);
            } else {
                await pool.execute("UPDATE page_settings SET settings = ? WHERE page_key = 'halcon'", [settingsJson]);
            }
            // Audit trail (uses the table's real column names: changed_by / changed_by_name)
            try {
                await pool.execute(
                    'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, NULL, ?, ?, ?, ?, ?)',
                    ['halcon', 'Mt. Halcon Permit System', 'update', JSON.stringify({ booking_enabled: { old: !enabled, new: enabled } }), req.admin.id, req.admin.email || 'Admin']
                );
            } catch (e) { /* best-effort */ }
            res.json({ message: enabled ? 'Mt. Halcon booking is now AVAILABLE to the public.' : 'Mt. Halcon booking is now DISABLED.', bookingEnabled: enabled });
        } catch (e) {
            console.error('Halcon availability toggle error:', e.message);
            res.status(500).json({ message: 'Failed to update booking availability.' });
        }
    });

    console.log('✅ Halcon routes registered');
} else {
    console.log('⚠️ Halcon routes skipped (missing bcrypt/jsonwebtoken)');
}

module.exports = router;