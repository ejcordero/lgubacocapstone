const express = require('express');
const router = express.Router();
const { pool, fs, path, bcrypt, jwt, BASE_URL, FRONTEND_URL, JWT_SECRET, generateOTP, sendOtpEmail, emailTransporter, validatePasswordPolicy, authenticateAdmin, saveBase64Image, ARRIVALS_BG_KEY, getArrivalsBackgrounds } = require('./_shared');
const multer = require('multer');

// --- Utility: time ago ---
function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) return `${diffDay}d ago`;
    const diffMonth = Math.floor(diffDay / 30);
    if (diffMonth < 12) return `${diffMonth}mo ago`;
    return `${Math.floor(diffMonth / 12)}y ago`;
}

// ==========================================================
// ADMIN MANAGEMENT SYSTEM
// ==========================================================
if (bcrypt && jwt) {
    const adminIdDir = path.join(__dirname, '../admin_uploads');
    if (!fs.existsSync(adminIdDir)) fs.mkdirSync(adminIdDir, { recursive: true });
    const uploadAdminId = multer({
        storage: multer.diskStorage({ destination: (req, file, cb) => cb(null, adminIdDir), filename: (req, file, cb) => { cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)); } }),
        fileFilter: (req, file, cb) => { if (['.jpg', '.jpeg', '.png'].includes(path.extname(file.originalname).toLowerCase())) cb(null, true); else cb(new Error('Only JPG, JPEG, and PNG files are allowed.'), false); },
        limits: { fileSize: 5 * 1024 * 1024 }
    });

    const ADMIN_ROLES = { 'main_controller': 'Super Admin', 'mho_admin': 'MHO Officer', 'tourism_admin': 'Tourism Officer', 'bplo_admin': 'BPLO Officer', 'mdrrmo_admin': 'MDRRMO Officer' };

    // ══════════════════════════════════════════════════════════
    // ADMIN AUTH — DB-backed email verification (survives restarts)
    // ══════════════════════════════════════════════════════════

    // 1. Send OTP
    router.post('/admin/auth/send-otp', async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ message: 'Email is required.' });

            const [existing] = await pool.execute('SELECT id FROM admin_users WHERE email = ?', [email]);
            if (existing.length > 0) return res.status(400).json({ message: 'An admin account with this email already exists.' });

            const [pending] = await pool.execute('SELECT id FROM admin_registrations WHERE email = ? AND status = ?', [email, 'pending']);
            if (pending.length > 0) return res.status(400).json({ message: 'You already have a pending registration.' });

            const otp = generateOTP();
            // Only delete UNVERIFIED rows — preserves a prior successful
            // verification so re-sending a code doesn't invalidate it
            await pool.execute('DELETE FROM admin_otp_store WHERE email = ? AND verified_at IS NULL', [email]);
            await pool.execute(
                'INSERT INTO admin_otp_store (email, otp, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))',
                [email, otp]
            );

            try {
                await sendOtpEmail(email, otp);
                res.json({ message: 'OTP sent successfully' });
            } catch (error) {
                console.error('Admin OTP email error:', error.message);
                if (!emailTransporter) res.json({ message: 'OTP generated (check server console in dev mode)' });
                else res.status(500).json({ message: 'Failed to send OTP.' });
            }
        } catch (err) {
            console.error('Admin send-otp error:', err);
            res.status(500).json({ message: 'Failed.' });
        }
    });

    // 2. Verify OTP — marks the row verified instead of deleting it,
    //    so the record persists even if the server restarts
    router.post('/admin/auth/verify-otp', async (req, res) => {
        try {
            const { email, otp } = req.body;
            if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required.' });

            const [rows] = await pool.execute(
                'SELECT * FROM admin_otp_store WHERE email = ? AND otp = ? AND expires_at > NOW()',
                [email, otp]
            );
            if (rows.length === 0) {
                return res.status(400).json({ message: 'Invalid or expired OTP.', verified: false });
            }

            // SECURITY: persist verification server-side. The register route
            // checks this record later (valid for 15 minutes after verifying).
            await pool.execute('UPDATE admin_otp_store SET verified_at = NOW() WHERE id = ?', [rows[0].id]);

            res.json({ message: 'OTP verified', verified: true });
        } catch (err) {
            console.error('Admin verify-otp error:', err);
            res.status(500).json({ message: 'Failed.' });
        }
    });

    // 3. Register — multer wrapped so file errors return JSON, not HTML
    router.post('/admin/auth/register', (req, res) => {
        uploadAdminId.single('validId')(req, res, function (err) {
            if (err) {
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                    return res.status(400).json({ message: 'File is too large. Maximum size is 5MB.' });
                }
                return res.status(400).json({ message: err.message });
            }
            handleAdminRegister(req, res);
        });
    });

    async function handleAdminRegister(req, res) {
        const cleanupFile = () => {
            if (req.file) { try { fs.unlinkSync(req.file.path); } catch (e) {} }
        };
        try {
            const { firstName, middleName, lastName, email, password, department, position, employeeId, contactNumber, role } = req.body;

            if (!firstName || !lastName || !email || !password || !role) {
                cleanupFile();
                return res.status(400).json({ message: 'First name, last name, email, password, and role are required.' });
            }

            // SECURITY: check the DB-persisted verification record instead of
            // trusting the client-sent otpVerified flag or in-memory state.
            // Verification stays valid for 15 minutes after OTP confirmation.
            const [verified] = await pool.execute(
                `SELECT id FROM admin_otp_store
                 WHERE email = ? AND verified_at IS NOT NULL
                   AND verified_at > NOW() - INTERVAL 15 MINUTE
                 LIMIT 1`,
                [email]
            );
            if (verified.length === 0) {
                cleanupFile();
                return res.status(400).json({ message: 'Please verify your email first.' });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'Valid ID is required.' });
            }

            const [existingAdmin] = await pool.execute('SELECT id FROM admin_users WHERE email = ?', [email]);
            if (existingAdmin.length > 0) {
                cleanupFile();
                return res.status(400).json({ message: 'Email already in use.' });
            }

            const [pendingReg] = await pool.execute('SELECT id FROM admin_registrations WHERE email = ? AND status = ?', [email, 'pending']);
            if (pendingReg.length > 0) {
                cleanupFile();
                return res.status(400).json({ message: 'Pending registration already exists.' });
            }

            // Admin registration passwords also follow the policy
            const pwMissing = validatePasswordPolicy(password);
            if (pwMissing.length > 0) {
                cleanupFile();
                return res.status(400).json({ message: 'Password requirements not met: ' + pwMissing.join(', ') + '.' });
            }

            // Allow re-application: clear previous rejected registrations for
            // this email (the reject route already deletes the old ID file).
            // Without this, a rejected applicant hits ER_DUP_ENTRY forever.
            await pool.execute("DELETE FROM admin_registrations WHERE email = ? AND status = 'rejected'", [email]);

            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.execute(
                `INSERT INTO admin_registrations (first_name, middle_name, last_name, email, password, department, position, employee_id, contact_number, requested_role, valid_id_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [firstName, middleName || null, lastName, email, hashedPassword, department || null, position || null, employeeId || null, contactNumber || null, role, req.file.filename]
            );

            // Consume the verification record — it can't be reused
            await pool.execute('DELETE FROM admin_otp_store WHERE email = ?', [email]);

            res.status(201).json({ message: 'Registration submitted. Awaiting Super Admin approval.' });
        } catch (err) {
            cleanupFile();
            console.error('Admin register error:', err);
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'This email is already registered or has a previous registration.' });
            res.status(500).json({ message: 'Registration failed.' });
        }
    }

    router.post('/admin/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body; if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });
            const [admins] = await pool.execute('SELECT * FROM admin_users WHERE email = ? AND status = ?', [email, 'active']); if (admins.length === 0) return res.status(400).json({ message: 'Invalid credentials or inactive account.' });
            const admin = admins[0]; const isMatch = await bcrypt.compare(password, admin.password); if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });
            const token = jwt.sign({ id: admin.id, email: admin.email, role: admin.role }, JWT_SECRET, { expiresIn: '1d' });
            res.json({ token, admin: { id: admin.id, firstName: admin.first_name, middleName: admin.middle_name, lastName: admin.last_name, email: admin.email, department: admin.department, position: admin.position, employeeId: admin.employee_id, contactNumber: admin.contact_number, role: admin.role } });
        } catch (err) { res.status(500).json({ message: 'Login failed.' }); }
    });

    router.get('/admin/auth/me', authenticateAdmin, async (req, res) => {
        try {
            const [admins] = await pool.execute('SELECT * FROM admin_users WHERE id = ?', [req.admin.id]); if (admins.length === 0) return res.status(404).json({ message: 'Not found.' });
            const a = admins[0]; res.json({ id: a.id, firstName: a.first_name, middleName: a.middle_name, lastName: a.last_name, fullName: [a.first_name, a.middle_name, a.last_name].filter(Boolean).join(' '), email: a.email, department: a.department, position: a.position, employeeId: a.employee_id, contactNumber: a.contact_number, role: a.role, roleLabel: ADMIN_ROLES[a.role] || a.role, status: a.status, createdAt: a.created_at });
        } catch (err) { res.status(500).json({ message: 'Failed.' }); }
    });

    router.get('/admin/staff', authenticateAdmin, async (req, res) => {
        try {
            const [staff] = await pool.execute('SELECT * FROM admin_users ORDER BY created_at DESC');
            res.json(staff.map(s => ({ id: s.id, firstName: s.first_name, middleName: s.middle_name, lastName: s.last_name, fullName: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '), email: s.email, department: s.department, position: s.position, employeeId: s.employee_id, contactNumber: s.contact_number, role: s.role, roleLabel: ADMIN_ROLES[s.role] || s.role, status: s.status, createdAt: s.created_at })));
        } catch (err) { res.status(500).json({ message: 'Failed.' }); }
    });

    router.post('/admin/staff', authenticateAdmin, uploadAdminId.single('validId'), async (req, res) => {
        try {
            if (req.admin.role !== 'main_controller') { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(403).json({ message: 'Only Super Admin can add staff.' }); }
            const { firstName, middleName, lastName, email, password, department, position, employeeId, contactNumber, role } = req.body;
            if (!firstName || !lastName || !email || !password || !role) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(400).json({ message: 'Required fields missing.' }); }
            const [existing] = await pool.execute('SELECT id FROM admin_users WHERE email = ?', [email]); if (existing.length > 0) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(400).json({ message: 'Email already in use.' }); }
            // Staff passwords also follow the policy
            const pwMissing = validatePasswordPolicy(password);
            if (pwMissing.length > 0) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(400).json({ message: 'Password requirements not met: ' + pwMissing.join(', ') + '.' }); }
            const hashed = await bcrypt.hash(password, 10);
            await pool.execute(`INSERT INTO admin_users (first_name, middle_name, last_name, email, password, department, position, employee_id, contact_number, role, valid_id_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`, [firstName, middleName || null, lastName, email, hashed, department || null, position || null, employeeId || null, contactNumber || null, role, req.file ? req.file.filename : null]);
            res.status(201).json({ message: 'Staff added successfully.' });
        } catch (err) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} res.status(500).json({ message: 'Failed to add staff.' }); }
    });

    router.put('/admin/staff/:id', authenticateAdmin, uploadAdminId.single('validId'), async (req, res) => {
        try {
            // SECURITY: only Super Admin can edit staff (was missing this guard)
            if (req.admin.role !== 'main_controller') { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(403).json({ message: 'Only Super Admin can edit staff.' }); }
            const { id } = req.params; const { firstName, middleName, lastName, email, department, position, employeeId, contactNumber, role, status } = req.body;
            const [existing] = await pool.execute('SELECT * FROM admin_users WHERE id = ?', [id]);
            if (existing.length === 0) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(404).json({ message: 'Not found.' }); }
            const validIdPath = req.file ? req.file.filename : existing[0].valid_id_path;
            await pool.execute(`UPDATE admin_users SET first_name=?, middle_name=?, last_name=?, email=?, department=?, position=?, employee_id=?, contact_number=?, role=?, status=?, valid_id_path=?, updated_at=NOW() WHERE id=?`, [firstName || existing[0].first_name, middleName || existing[0].middle_name, lastName || existing[0].last_name, email || existing[0].email, department !== undefined ? department : existing[0].department, position !== undefined ? position : existing[0].position, employeeId !== undefined ? employeeId : existing[0].employee_id, contactNumber !== undefined ? contactNumber : existing[0].contact_number, role || existing[0].role, status || existing[0].status, validIdPath, id]);
            res.json({ message: 'Staff updated.' });
        } catch (err) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} res.status(500).json({ message: 'Failed.' }); }
    });

    router.delete('/admin/staff/:id', authenticateAdmin, async (req, res) => {
        try {
            if (parseInt(req.params.id) === req.admin.id) return res.status(400).json({ message: 'Cannot delete yourself.' });
            if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Only Super Admin can delete.' });
            const [existing] = await pool.execute('SELECT valid_id_path FROM admin_users WHERE id = ?', [req.params.id]);
            if (existing.length === 0) return res.status(404).json({ message: 'Not found.' });
            if (existing[0].valid_id_path) try { fs.unlinkSync(path.join(adminIdDir, existing[0].valid_id_path)); } catch (e) {}
            await pool.execute('DELETE FROM admin_users WHERE id = ?', [req.params.id]); res.json({ message: 'Staff deleted.' });
        } catch (err) { res.status(500).json({ message: 'Failed.' }); }
    });

    router.get('/admin/registrations', authenticateAdmin, async (req, res) => {
        try {
            if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Access denied.' });
            const [rows] = await pool.execute('SELECT * FROM admin_registrations ORDER BY created_at DESC');
            res.json(rows.map(r => ({ id: r.id, firstName: r.first_name, middleName: r.middle_name, lastName: r.last_name, fullName: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '), email: r.email, department: r.department, position: r.position, employeeId: r.employee_id, contactNumber: r.contact_number, requestedRole: r.requested_role, roleLabel: ADMIN_ROLES[r.requested_role] || r.requested_role, validIdPath: r.valid_id_path, validIdUrl: r.valid_id_path ? `${BASE_URL}/admin_uploads/${r.valid_id_path}` : null, status: r.status, rejectionReason: r.rejection_reason, reviewedBy: r.reviewed_by, reviewedAt: r.reviewed_at, createdAt: r.created_at })));
        } catch (err) { res.status(500).json({ message: 'Failed.' }); }
    });

    router.put('/admin/registrations/:id/approve', authenticateAdmin, async (req, res) => {
        const conn = await pool.getConnection();
        try {
            if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Access denied.' });
            await conn.beginTransaction();
            const [reg] = await conn.execute('SELECT * FROM admin_registrations WHERE id = ? AND status = ?', [req.params.id, 'pending']);
            if (reg.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Not found or already processed.' }); }
            const r = reg[0];
            const [dup] = await conn.execute('SELECT id FROM admin_users WHERE email = ?', [r.email]); if (dup.length > 0) { await conn.rollback(); return res.status(400).json({ message: 'Email already exists.' }); }
            await conn.execute(`INSERT INTO admin_users (first_name, middle_name, last_name, email, password, department, position, employee_id, contact_number, role, valid_id_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`, [r.first_name, r.middle_name, r.last_name, r.email, r.password, r.department, r.position, r.employee_id, r.contact_number, r.requested_role, r.valid_id_path]);
            await conn.execute('UPDATE admin_registrations SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', ['approved', req.admin.id, req.params.id]);
            await conn.commit();
            try {
                if (emailTransporter) {
                    await emailTransporter.sendMail({ from: `"Baco LGU" <${process.env.EMAIL_USER}>`, to: r.email, subject: 'Baco LGU — Admin Registration Approved',
                        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#000C7B;">Registration Approved!</h2><p>Dear ${r.first_name},</p><p>Your admin registration has been approved.</p><p><strong>Role:</strong> ${ADMIN_ROLES[r.requested_role]}</p><a href="${FRONTEND_URL}/admin/login" style="display:inline-block;padding:12px 24px;background:#000C7B;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">Go to Admin Portal</a><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/><p style="color:#9CA3AF;font-size:12px;">Municipality of Baco, Oriental Mindoro</p></div>` });
                    }
            } catch (e) { console.error('Approval email error:', e.message); }
            res.json({ message: 'Registration approved.' });
        } catch (err) { await conn.rollback(); res.status(500).json({ message: 'Failed.' }); } finally { conn.release(); }
    });

    router.put('/admin/registrations/:id/reject', authenticateAdmin, async (req, res) => {
        try {
            if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Access denied.' });
            const { reason } = req.body;
            const [reg] = await pool.execute('SELECT * FROM admin_registrations WHERE id = ? AND status = ?', [req.params.id, 'pending']);
            if (reg.length === 0) return res.status(404).json({ message: 'Not found or already processed.' });
            await pool.execute('UPDATE admin_registrations SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', ['rejected', reason || 'Does not meet requirements.', req.admin.id, req.params.id]);
            if (reg[0].valid_id_path) try { fs.unlinkSync(path.join(adminIdDir, reg[0].valid_id_path)); } catch (e) {}
            try {
                if (emailTransporter) {
                    await emailTransporter.sendMail({ from: `"Baco LGU" <${process.env.EMAIL_USER}>`, to: reg[0].email, subject: 'Baco LGU — Registration Update',
                        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#c0392b;">Registration Update</h2><p>Dear ${reg[0].first_name},</p><p>Your registration has not been approved at this time.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/><p style="color:#9CA3AF;font-size:12px;">Municipality of Baco, Oriental Mindoro</p></div>` });
                    }
            } catch (e) { console.error('Rejection email error:', e.message); }
            res.json({ message: 'Registration rejected.' });
        } catch (err) { res.status(500).json({ message: 'Failed.' }); }
    });

    router.get('/admin/citizens', authenticateAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT id, first_name, middle_name, last_name, username, email, phone, is_verified, created_at FROM tourism_users ORDER BY created_at DESC');
            res.json(rows.map(c => ({ id: c.id, firstName: c.first_name, middleName: c.middle_name, lastName: c.last_name, fullName: [c.first_name, c.middle_name, c.last_name].filter(Boolean).join(' '), username: c.username, email: c.email, phone: c.phone, isVerified: !!c.is_verified, createdAt: c.created_at })));
        } catch (err) { res.status(500).json({ message: 'Failed.' }); }
    });

    router.get('/dashboard/stats', authenticateAdmin, async (req, res) => {
        try {
            const [citizens] = await pool.execute('SELECT COUNT(*) as cnt FROM tourism_users');
            const [destinations] = await pool.execute("SELECT COUNT(*) as cnt FROM tourist_destinations WHERE status != 'Closed'");
            const [news] = await pool.execute('SELECT COUNT(*) as cnt FROM news');
            const [projects] = await pool.execute('SELECT COUNT(*) as cnt FROM projects');
            const [bookings] = await pool.execute('SELECT COUNT(*) as cnt FROM hotel_bookings');
            const [permits] = await pool.execute('SELECT COUNT(*) as cnt FROM halcon_permits');
            const [barangays] = await pool.execute('SELECT COUNT(*) as cnt FROM barangays');
            const [health] = await pool.execute('SELECT COUNT(*) as cnt FROM health_services');
            res.json({ citizens: citizens[0].cnt, destinations: destinations[0].cnt, news: news[0].cnt, projects: projects[0].cnt, bookings: bookings[0].cnt, permits: permits[0].cnt, barangays: barangays[0].cnt, healthServices: health[0].cnt });
        } catch (err) { res.status(500).json({ error: 'Failed' }); }
    });

    router.get('/reports/summary', authenticateAdmin, async (req, res) => {
        try {
            const [hotelRev] = await pool.execute(`SELECT COALESCE(SUM(CASE WHEN status = 'confirmed' THEN total_amount ELSE 0 END), 0) as confirmed_revenue, COALESCE(SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed_count, COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) as completed_count, COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_count FROM hotel_bookings`);
            const [halconRev] = await pool.execute(`SELECT COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_fee ELSE 0 END), 0) as paid_revenue, COALESCE(SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END), 0) as approved_count, COALESCE(SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END), 0) as pending_count, COALESCE(SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END), 0) as rejected_count, COALESCE(SUM(group_size), 0) as total_climbers FROM halcon_permits`);
            const [monthlyHotels] = await pool.execute(`SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count, SUM(total_amount) as revenue FROM hotel_bookings WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`);
            const [monthlyPermits] = await pool.execute(`SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count, SUM(total_fee) as revenue FROM halcon_permits WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH) GROUP BY month ORDER BY month`);
            const [trailStats] = await pool.execute(`SELECT trail, COUNT(*) as count, SUM(group_size) as climbers, SUM(total_fee) as revenue FROM halcon_permits GROUP BY trail ORDER BY count DESC`);
            const [roomPopularity] = await pool.execute(`SELECT hr.room_type, h.name as hotel_name, COUNT(*) as bookings, SUM(hb.total_amount) as revenue, AVG(hb.nights) as avg_stay FROM hotel_bookings hb JOIN hotel_rooms hr ON hb.room_id = hr.id JOIN hotels h ON hb.hotel_id = h.id WHERE hb.status = 'confirmed' OR hb.status = 'completed' GROUP BY hr.id ORDER BY bookings DESC LIMIT 10`);
            res.json({ hotelRevenue: hotelRev[0], halconRevenue: halconRev[0], monthlyHotels, monthlyPermits, trailStats, roomPopularity });
        } catch (err) { res.status(500).json({ error: 'Failed' }); }
    });

    // ── Seal upload multer ──
    const sealUploadDir = path.join(__dirname, '../public/BACO- 27 BARANGAYS_ SEALS');
    if (!fs.existsSync(sealUploadDir)) fs.mkdirSync(sealUploadDir, { recursive: true });
    const sealStorage = multer.diskStorage({ destination: (req, file, cb) => cb(null, sealUploadDir), filename: (req, file, cb) => { const n = req.body.name || 'seal'; cb(null, n.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim() + path.extname(file.originalname)); } });
    const uploadSeal = multer({ storage: sealStorage, fileFilter: (req, file, cb) => { if (['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype)) cb(null, true); else cb(new Error('Only PNG/JPG'), false); }, limits: { fileSize: 5 * 1024 * 1024 } });

    // ── ADMIN BARANGAYS ──
    router.get('/admin/barangays', authenticateAdmin, async (req, res) => {
        try { const [rows] = await pool.execute('SELECT * FROM barangays ORDER BY name ASC'); res.json(rows); } catch (err) { res.status(500).json({ error: 'Failed to fetch barangays' }); }
    });

    router.post('/admin/barangays', authenticateAdmin, uploadSeal.single('sealImage'), async (req, res) => {
        try {
            const { name, lat, lng, population, elevation, area_type, overview } = req.body;
            if (!name) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(400).json({ error: 'Name is required' }); }
            let sealImagePath = null; if (req.file) sealImagePath = req.file.filename;
            const [result] = await pool.execute('INSERT INTO barangays (name, lat, lng, population, elevation, area_type, overview, seal_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [name, lat || 0, lng || 0, population || 0, elevation || 0, area_type || 'Lowland', overview || null, sealImagePath]);
            const [newRows] = await pool.execute('SELECT * FROM barangays WHERE id = ?', [result.insertId]); res.status(201).json(newRows[0]);
        } catch (err) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} res.status(500).json({ error: 'Failed to create barangay' }); }
    });

    router.put('/admin/barangays/:id', authenticateAdmin, uploadSeal.single('sealImage'), async (req, res) => {
        try {
            const { id } = req.params; const { name, lat, lng, population, elevation, area_type, overview } = req.body;
            const [current] = await pool.execute('SELECT * FROM barangays WHERE id = ?', [id]);
            if (current.length === 0) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(404).json({ error: 'Not found' }); }
            let sealImagePath = current[0].seal_image; if (req.file) sealImagePath = req.file.filename;
            await pool.execute('UPDATE barangays SET name=?, lat=?, lng=?, population=?, elevation=?, area_type=?, overview=?, seal_image=? WHERE id=?', [name || current[0].name, lat !== undefined && lat !== '' ? lat : current[0].lat, lng !== undefined && lng !== '' ? lng : current[0].lng, population !== undefined && population !== '' ? population : current[0].population, elevation !== undefined && elevation !== '' ? elevation : current[0].elevation, area_type || current[0].area_type, overview !== undefined ? overview : current[0].overview, sealImagePath, id]);
            const [updated] = await pool.execute('SELECT * FROM barangays WHERE id = ?', [id]); res.json(updated[0]);
        } catch (err) { if (req.file) try { fs.unlinkSync(req.file.path); } catch (e) {} res.status(500).json({ error: 'Failed to update barangay' }); }
    });

    router.delete('/admin/barangays/:id', authenticateAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const [result] = await pool.execute('DELETE FROM barangays WHERE id = ?', [id]);
            if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
            res.json({ message: 'Deleted' });
        } catch (err) { res.status(500).json({ error: 'Failed to delete barangay' }); }
    });

    // ── CITIZENS CHARTER ──
    const charterDir = path.join(__dirname, '../charters');
    if (!fs.existsSync(charterDir)) fs.mkdirSync(charterDir, { recursive: true });
    const charterStorage = multer.diskStorage({ destination: (req, file, cb) => cb(null, charterDir), filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname)) });
    const uploadCharter = multer({ storage: charterStorage, fileFilter: (req, file, cb) => { if (file.mimetype === 'application/pdf' && path.extname(file.originalname).toLowerCase() === '.pdf') cb(null, true); else cb(new Error('Only PDF'), false); }, limits: { fileSize: 50 * 1024 * 1024 } });

    // SECURITY: the browser-reported mimetype is guessed from the file
    // extension, so a saved HTML page renamed to ".pdf" passes it as
    // "application/pdf" and reaches the disk. Verify the actual bytes —
    // every valid PDF begins with "%PDF-" within its first 1024 bytes.
    const looksLikePdf = (filePath) => {
        try {
            const fd = fs.openSync(filePath, 'r');
            const buf = Buffer.alloc(1024);
            const bytes = fs.readSync(fd, buf, 0, 1024, 0);
            fs.closeSync(fd);
            return bytes > 0 && buf.slice(0, bytes).toString('latin1').includes('%PDF-');
        } catch (e) { return false; }
    };

    // Public: metadata for the latest charter
    router.get('/citizens-charter', async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT * FROM citizens_charter ORDER BY uploaded_at DESC LIMIT 1');
            if (rows.length === 0) return res.json({ exists: false });
            const c = rows[0];
            res.json({ exists: true, id: c.id, pdfUrl: `${BASE_URL}/api/citizens-charter/file`, originalName: c.original_name, fileSize: c.file_size, uploadedAt: c.uploaded_at, updatedAt: c.updated_at });
        } catch (err) { res.status(500).json({ error: 'Failed' }); }
    });

    // Public: streams the actual PDF with guaranteed correct headers,
    // no matter how static file serving is configured
    router.get('/citizens-charter/file', async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT * FROM citizens_charter ORDER BY uploaded_at DESC LIMIT 1');
            if (rows.length === 0) return res.status(404).json({ error: 'Charter not found' });

            const c = rows[0];
            const absPath = path.join(charterDir, path.basename(c.file_path));
            if (!fs.existsSync(absPath)) return res.status(404).json({ error: 'Charter file missing on server' });

            const safeName = String(c.original_name || 'Citizens_Charter.pdf').replace(/["\\\r\n]/g, '') || 'Citizens_Charter.pdf';
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
            fs.createReadStream(absPath).pipe(res);
        } catch (err) {
            console.error('Charter file stream error:', err);
            res.status(500).json({ error: 'Failed' });
        }
    });

    // Admin: upload / replace the charter
    router.post('/admin/citizens-charter', authenticateAdmin, uploadCharter.single('charterPdf'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No file' });

            // Reject files that are not really PDFs BEFORE touching the
            // existing charter — a bad upload must never delete the good one.
            if (!looksLikePdf(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
                return res.status(400).json({ error: 'The uploaded file is not a valid PDF. It may be a renamed or saved HTML page. Please re-export it as a real PDF and try again.' });
            }

            const [old] = await pool.execute('SELECT * FROM citizens_charter ORDER BY uploaded_at DESC LIMIT 1');
            if (old.length > 0) {
                const oldPath = path.join(charterDir, path.basename(old[0].file_path));
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
                await pool.execute('DELETE FROM citizens_charter');
            }
            const filePath = `/charters/${req.file.filename}`;
            const [result] = await pool.execute('INSERT INTO citizens_charter (file_path, original_name, file_size) VALUES (?, ?, ?)', [filePath, req.file.originalname, req.file.size]);
            res.status(201).json({ message: 'Uploaded', id: result.insertId, pdfUrl: `${BASE_URL}/api/citizens-charter/file`, originalName: req.file.originalname, fileSize: req.file.size });
        } catch (err) {
            if (req.file && req.file.path) try { fs.unlinkSync(req.file.path); } catch (e) {}
            res.status(500).json({ error: 'Failed' });
        }
    });

    // Admin: metadata for the latest charter
    router.get('/admin/citizens-charter', authenticateAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute('SELECT * FROM citizens_charter ORDER BY uploaded_at DESC LIMIT 1');
            if (rows.length === 0) return res.json({ exists: false });
            const c = rows[0];
            res.json({ exists: true, id: c.id, pdfUrl: `${BASE_URL}/api/citizens-charter/file`, originalName: c.original_name, fileSize: c.file_size, uploadedAt: c.uploaded_at, updatedAt: c.updated_at });
        } catch (err) { res.status(500).json({ error: 'Failed' }); }
    });

    // ── CONTENT CHANGE HISTORY ──
    router.get('/admin/content-history', authenticateAdmin, async (req, res) => {
        try {
            const { section } = req.query;
            let query = 'SELECT * FROM content_history';
            const params = [];
            if (section && section !== 'all') {
                query += ' WHERE section = ?';
                params.push(section);
            }
            query += ' ORDER BY created_at DESC LIMIT 500';
            const [rows] = await pool.execute(query, params);
            const results = rows.map(r => {
                let parsedChanges = null;
                try { parsedChanges = r.changes ? JSON.parse(r.changes) : null; } catch (e) {}
                return {
                    ...r,
                    changes: parsedChanges,
                    timeAgo: getTimeAgo(r.created_at)
                };
            });
            res.json(results);
        } catch (err) { res.status(500).json({ error: 'Failed' }); }
    });

    router.post('/admin/content-history', authenticateAdmin, async (req, res) => {
        try {
            const { section, entityId, entityTitle, action, changes } = req.body;
            if (!section || !action) return res.status(400).json({ error: 'Section and action required' });
            const [admin] = await pool.execute('SELECT first_name, last_name, email FROM admin_users WHERE id = ?', [req.admin.id]);
            const adminName = admin.length > 0
                ? `${admin[0].first_name || ''} ${admin[0].last_name || ''}`.trim() || admin[0].email
                : req.admin.email || 'Unknown';
            // FIXED: column names — the table has changed_by / changed_by_name
            await pool.execute(
                'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [section, entityId || null, entityTitle || null, action, JSON.stringify(changes || {}), req.admin.id, adminName]
            );
            res.json({ message: 'History recorded' });
        } catch (err) { res.status(500).json({ error: 'Failed' }); }
    });

    // ══════════════════════════════════════════════════════════
    // TOURISM — ARRIVALS ADMIN (quarterly stats + section backgrounds)
    // ══════════════════════════════════════════════════════════

    router.get('/admin/tourism/arrivals', authenticateAdmin, async (req, res) => {
        try {
            const year = parseInt(req.query.year) || new Date().getFullYear();
            const quarter = parseInt(req.query.quarter) || (Math.floor(new Date().getMonth() / 3) + 1);
            if (quarter < 1 || quarter > 4) return res.status(400).json({ message: 'Quarter must be between 1 and 4.' });

            const [summaryRows] = await pool.execute(
                'SELECT total_arrivals, domestic_pct, peak_label FROM arrivals_summary WHERE quarter_year = ? AND quarter_num = ?',
                [year, quarter]
            );
            const [attrRows] = await pool.execute(
                'SELECT attraction_name, visitors FROM tourist_arrivals WHERE quarter_year = ? AND quarter_num = ? ORDER BY visitors DESC',
                [year, quarter]
            );
            const backgrounds = await getArrivalsBackgrounds();

            res.json({
                period: { year, quarter },
                summary: summaryRows.length > 0 ? {
                    totalArrivals: Number(summaryRows[0].total_arrivals) || 0,
                    domesticPct: Number(summaryRows[0].domestic_pct) || 0,
                    peakLabel: summaryRows[0].peak_label || ''
                } : null,
                attractions: attrRows.map(a => ({ name: a.attraction_name, visitors: Number(a.visitors) || 0 })),
                backgrounds
            });
        } catch (e) {
            console.error('Admin arrivals fetch error:', e.message);
            res.status(500).json({ message: 'Failed to load arrivals data.' });
        }
    });

    router.post('/admin/tourism/arrivals', authenticateAdmin, async (req, res) => {
        const conn = await pool.getConnection();
        try {
            const { quarterYear, quarterNum, totalArrivals, domesticPct, peakLabel, attractions } = req.body;
            const year = parseInt(quarterYear);
            const q = parseInt(quarterNum);
            if (!year || year < 2000 || year > 2100) { conn.release(); return res.status(400).json({ message: 'Enter a valid year (2000–2100).' }); }
            if (!q || q < 1 || q > 4) { conn.release(); return res.status(400).json({ message: 'Quarter must be between 1 and 4.' }); }
            if (!Array.isArray(attractions)) { conn.release(); return res.status(400).json({ message: 'Invalid attractions payload.' }); }
    
            const clean = attractions
                .map(a => ({ name: String(a?.name || '').trim().slice(0, 255), visitors: Math.max(0, parseInt(a?.visitors) || 0) }))
                .filter(a => a.name.length > 0);
    
            const total = Math.max(0, parseInt(totalArrivals) || 0);
            const domestic = Math.min(100, Math.max(0, parseInt(domesticPct) || 0));
            const peak = String(peakLabel || '').trim().slice(0, 30) || null;
            // Empty save (no total, no attractions) = UNPUBLISH the quarter,
            // so the public section hides instead of showing a "0" counter.
            const isEmpty = clean.length === 0 && total <= 0;
    
            await conn.beginTransaction();
            await conn.execute('DELETE FROM tourist_arrivals WHERE quarter_year = ? AND quarter_num = ?', [year, q]);
    
            let message;
            if (isEmpty) {
                await conn.execute('DELETE FROM arrivals_summary WHERE quarter_year = ? AND quarter_num = ?', [year, q]);
                message = `Q${q} ${year} cleared — it is no longer shown on the public Tourism page.`;
            } else {
                await conn.execute(
                    `INSERT INTO arrivals_summary (quarter_year, quarter_num, total_arrivals, domestic_pct, peak_label)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE total_arrivals = VALUES(total_arrivals), domestic_pct = VALUES(domestic_pct), peak_label = VALUES(peak_label)`,
                    [year, q, total, domestic, peak]
                );
                message = `Arrivals data saved for Q${q} ${year}.`;
            }
            await conn.commit();
    
            try {
                await pool.execute(
                    'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, NULL, ?, ?, ?, ?, ?)',
                    ['tourism', `Tourist Arrivals — Q${q} ${year}`, isEmpty ? 'delete' : 'update',
                     JSON.stringify(isEmpty
                        ? { cleared: { new: 'Quarter unpublished (no data)' } }
                        : { totalArrivals: { new: total }, attractions: { new: `${clean.length} attraction(s)` } }),
                     req.admin.id, req.admin.email || 'Admin']
                );
            } catch (e) { /* best-effort */ }
    
            res.json({ message, hasData: !isEmpty });
        } catch (e) {
            try { await conn.rollback(); } catch (e2) {}
            console.error('Admin arrivals save error:', e);
            res.status(500).json({ message: 'Failed to save arrivals data.' });
        } finally { conn.release(); }
    });

    // ── Arrivals section backgrounds (replace hero / top5 photos) ──
    // Payload semantics per field: omitted = keep current · '' = reset to default · base64 = replace
    router.put('/admin/tourism/arrivals/backgrounds', authenticateAdmin, async (req, res) => {
        try {
            const { heroBg, top5Bg } = req.body || {};
            const [rows] = await pool.execute('SELECT settings FROM page_settings WHERE page_key = ?', [ARRIVALS_BG_KEY]);
            let current = {};
            if (rows.length > 0) {
                try { current = typeof rows[0].settings === 'string' ? JSON.parse(rows[0].settings) : (rows[0].settings || {}); } catch (e) { current = {}; }
            }

            const resolveImage = (input, currentFile, label) => {
                if (input === undefined) return Promise.resolve(currentFile || null);
                if (input === null || input === '') {
                    if (currentFile) { try { fs.unlinkSync(path.join(__dirname, '../uploads', currentFile)); } catch (e) {} }
                    return Promise.resolve(null);
                }
                if (typeof input === 'string' && input.startsWith('data:image')) {
                    const fn = saveBase64Image(input);
                    if (!fn) return Promise.reject(new Error(`${label}: invalid image data.`));
                    if (currentFile) { try { fs.unlinkSync(path.join(__dirname, '../uploads', currentFile)); } catch (e) {} }
                    return Promise.resolve(fn);
                }
                return Promise.resolve(currentFile || null);
            };

            const newHero = await resolveImage(heroBg, current.heroBg || null, 'Hero background');
            const newTop5 = await resolveImage(top5Bg, current.top5Bg || null, 'Top 5 background');

            const settingsJson = JSON.stringify({ heroBg: newHero, top5Bg: newTop5 });
            if (rows.length > 0) {
                await pool.execute('UPDATE page_settings SET settings = ? WHERE page_key = ?', [settingsJson, ARRIVALS_BG_KEY]);
            } else {
                await pool.execute("INSERT INTO page_settings (page_key, title, settings) VALUES (?, 'Tourism Arrivals Backgrounds', ?)", [ARRIVALS_BG_KEY, settingsJson]);
            }

            try {
                const changes = {};
                if ((current.heroBg || null) !== newHero) changes.heroBackground = { new: newHero ? 'Custom image' : 'Default' };
                if ((current.top5Bg || null) !== newTop5) changes.top5Background = { new: newTop5 ? 'Custom image' : 'Default' };
                if (Object.keys(changes).length > 0) {
                    await pool.execute(
                        'INSERT INTO content_history (section, entity_id, entity_title, action, changes, changed_by, changed_by_name) VALUES (?, NULL, ?, ?, ?, ?, ?)',
                        ['tourism', 'Arrivals Section Backgrounds', 'update', JSON.stringify(changes), req.admin.id, req.admin.email || 'Admin']
                    );
                }
            } catch (e) { /* best-effort */ }

            res.json({
                message: 'Section backgrounds updated.',
                backgrounds: {
                    heroBg: newHero ? `${BASE_URL}/uploads/${newHero}` : null,
                    top5Bg: newTop5 ? `${BASE_URL}/uploads/${newTop5}` : null
                }
            });
        } catch (e) {
            console.error('Arrivals backgrounds save error:', e.message);
            res.status(500).json({ message: e.message || 'Failed to save backgrounds.' });
        }
    });

    console.log('✅ Admin routes registered');
} else {
    console.log('⚠️ Admin routes skipped (missing bcrypt/jsonwebtoken)');
}

module.exports = router;