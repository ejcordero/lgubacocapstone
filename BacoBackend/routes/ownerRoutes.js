const express = require('express');
const router = express.Router();
const multer = require('multer');
const { pool, fs, path, bcrypt, jwt, BASE_URL, FRONTEND_URL, IMG_BASE, saveBase64Image, formatHotel, validatePasswordPolicy, PASSWORD_CHANGE_COOLDOWN_DAYS, generateOTP, sendOtpEmail, emailTransporter, authenticateAdmin, authenticateOwner, JWT_SECRET } = require('./_shared');
// ==========================================================
// STAYHUB — HOTEL OWNER SYSTEM
// ==========================================================
if (bcrypt && jwt) {
    const ownerUploadDir = path.join(__dirname, '../owner_uploads');
    if (!fs.existsSync(ownerUploadDir)) fs.mkdirSync(ownerUploadDir, { recursive: true });

    const uploadOwnerDoc = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, ownerUploadDir),
            filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
        }),
        fileFilter: (req, file, cb) => {
            if (['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
            else cb(new Error('Only PDF, JPG, and PNG files are allowed.'), false);
        },
        limits: { fileSize: 5 * 1024 * 1024 }
    });

    // Multer for owner valid-ID replacement (profile page)
    const uploadOwnerId = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => cb(null, ownerUploadDir),
            filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
        }),
        fileFilter: (req, file, cb) => {
            if (['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimetype)) cb(null, true);
            else cb(new Error('Only PDF, JPG, and PNG files are allowed.'), false);
        },
        limits: { fileSize: 5 * 1024 * 1024 }
    });

    // ── 1. Owner: Send OTP ──
    router.post('/owner/auth/send-otp', async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ message: 'Email is required.' });

            const [approved] = await pool.execute('SELECT id FROM hotel_owners WHERE email = ?', [email]);
            if (approved.length > 0) return res.status(400).json({ message: 'An owner account with this email already exists. Please log in.' });

            const [pending] = await pool.execute("SELECT id FROM owner_registrations WHERE email = ? AND status = 'pending'", [email]);
            if (pending.length > 0) return res.status(400).json({ message: 'You already have a pending registration awaiting LGU review.' });

            const otp = generateOTP();
            await pool.execute('DELETE FROM owner_otp_store WHERE email = ?', [email]);
            await pool.execute('INSERT INTO owner_otp_store (email, otp, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))', [email, otp]);

            try {
                await sendOtpEmail(email, otp);
                res.json({ message: 'Verification code sent to your email.' });
            } catch (error) {
                console.error('Owner OTP email error:', error.message);
                if (!emailTransporter) res.json({ message: 'OTP generated (check server console in dev mode)' });
                else res.status(500).json({ message: 'Failed to send verification code. Try again.' });
            }
        } catch (err) {
            console.error('Owner send-otp error:', err);
            res.status(500).json({ message: 'Failed to send OTP.' });
        }
    });

    // ── 2. Owner: Register (multipart: validId, businessPermit, ownershipProof) ──
    async function handleOwnerRegister(req, res) {
        const files = req.files || {};
        const cleanup = () => Object.values(files).flat().forEach(f => { try { fs.unlinkSync(f.path); } catch (e) {} });
        try {
            const {
                firstName, middleName, lastName, email, contactNumber, password, otp,
                businessName, barangay, businessAddress, businessType,
                businessPermitNo, businessContact, businessEmail
            } = req.body;

            if (!firstName || !lastName || !email || !contactNumber || !password || !otp) { cleanup(); return res.status(400).json({ message: 'Missing required fields.' }); }
            if (!files.validId) { cleanup(); return res.status(400).json({ message: 'Valid ID is required.' }); }
            if (!businessName || !files.businessPermit) { cleanup(); return res.status(400).json({ message: 'Resort name and Business Permit are required.' }); }
            // Password policy replaces the old min-6 check
            const pwMissing = validatePasswordPolicy(password);
            if (pwMissing.length > 0) { cleanup(); return res.status(400).json({ message: 'Password requirements not met: ' + pwMissing.join(', ') + '.' }); }

            // OTP check (DB-backed, expires in 5 minutes)
            const [otpRows] = await pool.execute('SELECT id FROM owner_otp_store WHERE email = ? AND otp = ? AND expires_at > NOW()', [email, otp]);
            if (otpRows.length === 0) { cleanup(); return res.status(400).json({ message: 'Invalid or expired verification code.' }); }

            // Duplicate checks
            const [approved] = await pool.execute('SELECT id FROM hotel_owners WHERE email = ?', [email]);
            if (approved.length > 0) { cleanup(); return res.status(400).json({ message: 'An owner account with this email already exists.' }); }
            const [pending] = await pool.execute("SELECT id FROM owner_registrations WHERE email = ? AND status = 'pending'", [email]);
            if (pending.length > 0) { cleanup(); return res.status(400).json({ message: 'You already have a pending registration.' }); }

            const hashedPassword = await bcrypt.hash(password, 10);

            // Allow re-application: clear previous rejected rows for this email
            await pool.execute("DELETE FROM owner_registrations WHERE email = ? AND status = 'rejected'", [email]);
            await pool.execute(
                `INSERT INTO owner_registrations
                (first_name, middle_name, last_name, email, contact_number, valid_id_path,
                 business_name, barangay, address, business_type, business_permit_no, business_contact, business_email,
                 business_permit_path, ownership_proof_path, password, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [firstName, middleName || null, lastName, email, contactNumber,
                 files.validId[0].filename,
                 businessName, barangay || null, businessAddress || null, businessType || null,
                 businessPermitNo || null, businessContact || null, businessEmail || null,
                 files.businessPermit[0].filename,
                 files.ownershipProof ? files.ownershipProof[0].filename : null,
                 hashedPassword]
            );

            await pool.execute('DELETE FROM owner_otp_store WHERE email = ?', [email]);
            res.status(201).json({ message: 'Registration submitted. Awaiting LGU Baco Tourism Office review.' });
        } catch (err) {
            cleanup();
            console.error('Owner register error:', err);
            res.status(500).json({ message: 'Registration failed.' });
        }
    }

    router.post('/owner/auth/register', (req, res) => {
        uploadOwnerDoc.fields([
            { name: 'validId', maxCount: 1 },
            { name: 'businessPermit', maxCount: 1 },
            { name: 'ownershipProof', maxCount: 1 }
        ])(req, res, function (err) {
            if (err) {
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File is too large. Maximum size is 5MB.' });
                return res.status(400).json({ message: err.message });
            }
            handleOwnerRegister(req, res);
        });
    });

    // ── 3. Owner: Login ──
    router.post('/owner/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

            const [reg] = await pool.execute('SELECT status, rejection_reason FROM owner_registrations WHERE email = ?', [email]);
            if (reg.length > 0 && reg[0].status === 'pending') {
                return res.status(403).json({ message: 'Your registration is still awaiting review by the LGU Baco Tourism Office.', status: 'pending' });
            }
            if (reg.length > 0 && reg[0].status === 'rejected') {
                return res.status(403).json({ message: `Your registration was rejected. Reason: ${reg[0].rejection_reason || 'Not specified.'}`, status: 'rejected' });
            }

            const [owners] = await pool.execute('SELECT * FROM hotel_owners WHERE email = ?', [email]);
            if (owners.length === 0) return res.status(400).json({ message: 'Invalid credentials.' });
            const owner = owners[0];
            if (owner.status !== 'active') return res.status(400).json({ message: 'Account is inactive.' });

            const isMatch = await bcrypt.compare(password, owner.password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

            const token = jwt.sign({ id: owner.id, email: owner.email, role: 'owner' }, JWT_SECRET, { expiresIn: '1d' });
            res.json({ token, owner: { id: owner.id, firstName: owner.first_name, lastName: owner.last_name, email: owner.email, businessName: owner.business_name } });
        } catch (err) {
            console.error('Owner login error:', err);
            res.status(500).json({ message: 'Login failed.' });
        }
    });

    // ── 4. Owner: Profile ──
    // Includes businessPermitNo, validIdUrl, status, createdAt,
    // passwordChangedAt & passwordChangeAvailableAt (for the 7-day cooldown UI)
    router.get('/owner/auth/me', authenticateOwner, async (req, res) => {
        try {
            const [owners] = await pool.execute('SELECT * FROM hotel_owners WHERE id = ?', [req.owner.id]);
            if (owners.length === 0) return res.status(404).json({ message: 'Not found.' });
            const o = owners[0];
            const [myHotels] = await pool.execute('SELECT id, name, available FROM hotels WHERE owner_id = ?', [o.id]);
            res.json({
                id: o.id,
                firstName: o.first_name,
                middleName: o.middle_name,
                lastName: o.last_name,
                fullName: [o.first_name, o.middle_name, o.last_name].filter(Boolean).join(' '),
                email: o.email,
                contactNumber: o.contact_number,
                businessName: o.business_name,
                businessPermitNo: o.business_permit_no || '',
                validIdUrl: o.valid_id_path ? `${BASE_URL}/owner_uploads/${o.valid_id_path}` : null,
                status: o.status,
                createdAt: o.created_at,
                passwordChangedAt: o.password_changed_at || null,
                passwordChangeAvailableAt: o.password_changed_at
                    ? new Date(new Date(o.password_changed_at).getTime() + PASSWORD_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString()
                    : null,
                hotels: myHotels
            });
        } catch (err) { res.status(500).json({ message: 'Failed.' }); }
    });

    // ── 5. Owner: Update profile (partial updates — only sent fields change) ──
    router.put('/owner/auth/profile', authenticateOwner, async (req, res) => {
        try {
            const { firstName, middleName, lastName, contactNumber, businessName, businessPermitNo } = req.body;
            const sets = [], vals = [];

            if (firstName !== undefined) {
                if (!firstName.trim()) return res.status(400).json({ message: 'First name cannot be empty.' });
                sets.push('first_name = ?'); vals.push(firstName.trim());
            }
            if (middleName !== undefined) { sets.push('middle_name = ?'); vals.push(middleName.trim() || null); }
            if (lastName !== undefined) {
                if (!lastName.trim()) return res.status(400).json({ message: 'Last name cannot be empty.' });
                sets.push('last_name = ?'); vals.push(lastName.trim());
            }
            if (contactNumber !== undefined) {
                if (!contactNumber.trim()) return res.status(400).json({ message: 'Contact number cannot be empty.' });
                sets.push('contact_number = ?'); vals.push(contactNumber.trim());
            }
            if (businessName !== undefined) {
                if (!businessName.trim()) return res.status(400).json({ message: 'Business name cannot be empty.' });
                sets.push('business_name = ?'); vals.push(businessName.trim());
            }
            if (businessPermitNo !== undefined) { sets.push('business_permit_no = ?'); vals.push(businessPermitNo.trim() || null); }

            if (sets.length === 0) return res.status(400).json({ message: 'No changes provided.' });

            vals.push(req.owner.id);
            await pool.execute(`UPDATE hotel_owners SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
            res.json({ message: 'Profile updated successfully.' });
        } catch (err) {
            console.error('Owner profile update error:', err.message);
            res.status(500).json({ message: 'Failed to update profile.' });
        }
    });

    // ── 6. Owner: Replace valid government ID (PDF/JPG/PNG, max 5MB) ──
    router.put('/owner/auth/valid-id', authenticateOwner, (req, res) => {
        uploadOwnerId.single('validId')(req, res, async function (err) {
            if (err) {
                if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File is too large. Maximum size is 5MB.' });
                return res.status(400).json({ message: err.message });
            }
            if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
            try {
                const [owners] = await pool.execute('SELECT valid_id_path FROM hotel_owners WHERE id = ?', [req.owner.id]);
                if (owners.length === 0) { try { fs.unlinkSync(req.file.path); } catch (e) {} return res.status(404).json({ message: 'Owner not found.' }); }
                // Remove old file
                if (owners[0].valid_id_path) { try { fs.unlinkSync(path.join(ownerUploadDir, owners[0].valid_id_path)); } catch (e) {} }
                await pool.execute('UPDATE hotel_owners SET valid_id_path = ? WHERE id = ?', [req.file.filename, req.owner.id]);
                res.json({ message: 'Valid ID updated successfully.', validIdUrl: `${BASE_URL}/owner_uploads/${req.file.filename}` });
            } catch (e) {
                try { fs.unlinkSync(req.file.path); } catch (e2) {}
                res.status(500).json({ message: 'Failed to update ID.' });
            }
        });
    });

    // ── 7. Owner: Change password (policy + 7-day cooldown) ──
    router.put('/owner/auth/password', authenticateOwner, async (req, res) => {
        try {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Current and new password are required.' });
            if (currentPassword === newPassword) return res.status(400).json({ message: 'New password must be different from the current password.' });

            const missing = validatePasswordPolicy(newPassword);
            if (missing.length > 0) {
                return res.status(400).json({ message: 'Password does not meet security requirements: ' + missing.join(', ') + '.' });
            }

            const [owners] = await pool.execute('SELECT password, password_changed_at FROM hotel_owners WHERE id = ?', [req.owner.id]);
            if (owners.length === 0) return res.status(404).json({ message: 'Owner not found.' });

            // ── 7-day cooldown enforcement ──
            const changedAt = owners[0].password_changed_at;
            if (changedAt) {
                const nextAllowed = new Date(changedAt).getTime() + PASSWORD_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
                if (Date.now() < nextAllowed) {
                    const availDate = new Date(nextAllowed).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
                    return res.status(429).json({
                        message: `For security, passwords can only be changed once every ${PASSWORD_CHANGE_COOLDOWN_DAYS} days. You can change yours again on ${availDate}.`,
                        nextAllowedAt: new Date(nextAllowed).toISOString()
                    });
                }
            }

            const isMatch = await bcrypt.compare(currentPassword, owners[0].password);
            if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });

            const hashed = await bcrypt.hash(newPassword, 10);
            await pool.execute('UPDATE hotel_owners SET password = ?, password_changed_at = NOW() WHERE id = ?', [hashed, req.owner.id]);
            res.json({ message: 'Password changed successfully.' });
        } catch (err) {
            console.error('Owner password change error:', err.message);
            res.status(500).json({ message: 'Failed to change password.' });
        }
    });

    // ══════════ ADMIN: REVIEW OWNER REGISTRATIONS ══════════

    router.get('/admin/owner-registrations', authenticateAdmin, async (req, res) => {
        try {
            if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Access denied.' });
            const [rows] = await pool.execute('SELECT * FROM owner_registrations ORDER BY created_at DESC');
            res.json(rows.map(r => ({
                id: r.id,
                firstName: r.first_name, middleName: r.middle_name, lastName: r.last_name,
                fullName: [r.first_name, r.middle_name, r.last_name].filter(Boolean).join(' '),
                email: r.email, contactNumber: r.contact_number,
                validIdUrl: r.valid_id_path ? `${BASE_URL}/owner_uploads/${r.valid_id_path}` : null,
                businessName: r.business_name, barangay: r.barangay, address: r.address,
                businessType: r.business_type, businessPermitNo: r.business_permit_no,
                businessContact: r.business_contact, businessEmail: r.business_email,
                businessPermitUrl: r.business_permit_path ? `${BASE_URL}/owner_uploads/${r.business_permit_path}` : null,
                ownershipProofUrl: r.ownership_proof_path ? `${BASE_URL}/owner_uploads/${r.ownership_proof_path}` : null,
                status: r.status, rejectionReason: r.rejection_reason,
                reviewedAt: r.reviewed_at, createdAt: r.created_at
            })));
        } catch (err) { console.error('Fetch owner registrations error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    router.put('/admin/owner-registrations/:id/approve', authenticateAdmin, async (req, res) => {
        if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Access denied.' });
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            const [regRows] = await conn.execute("SELECT * FROM owner_registrations WHERE id = ? AND status = 'pending'", [req.params.id]);
            if (regRows.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Not found or already processed.' }); }
            const r = regRows[0];

            const [dup] = await conn.execute('SELECT id FROM hotel_owners WHERE email = ?', [r.email]);
            if (dup.length > 0) { await conn.rollback(); return res.status(400).json({ message: 'Owner account already exists.' }); }

            const [ownerIns] = await conn.execute(
                `INSERT INTO hotel_owners (registration_id, first_name, middle_name, last_name, email, contact_number, valid_id_path, business_name, business_permit_no, password, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [r.id, r.first_name, r.middle_name, r.last_name, r.email, r.contact_number, r.valid_id_path, r.business_name, r.business_permit_no, r.password]
            );

            // Pre-create the resort record — unpublished (available=0) until verified
            // and PUBLISHED via /admin/owner-resorts/:id/publish (ResortsManager.vue)
            const location = [r.barangay, 'Baco, Oriental Mindoro'].filter(Boolean).join(', ');
            await conn.execute(
                'INSERT INTO hotels (owner_id, name, location, type, contact, email, available, description) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
                [ownerIns.insertId, r.business_name, location, r.business_type, r.business_contact || r.contact_number, r.business_email || r.email, 'Listed via STAYHUB owner registration. Pending details verification.']
            );

            await conn.execute('UPDATE owner_registrations SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', ['approved', req.admin.id, r.id]);
            await conn.commit();

            try {
                if (emailTransporter) {
                    await emailTransporter.sendMail({
                        from: `"Baco LGU" <${process.env.EMAIL_USER}>`,
                        to: r.email,
                        subject: 'STAYHUB — Owner Registration Approved',
                        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#FF3D00;">Registration Approved! 🎉</h2><p>Dear ${r.first_name},</p><p>Your owner registration for <strong>${r.business_name}</strong> has been approved by the LGU Baco Tourism Office.</p><p>You may now log in to the STAYHUB owner portal to manage your property. Once the LGU publishes your listing, tourists will be able to book it.</p><a href="${FRONTEND_URL}/owner/login" style="display:inline-block;padding:12px 24px;background:#FF3D00;color:white;text-decoration:none;border-radius:8px;margin-top:16px;">Go to Owner Portal</a><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/><p style="color:#9CA3AF;font-size:12px;">Municipality of Baco, Oriental Mindoro</p></div>`
                    });
                }
            } catch (e) { console.error('Owner approval email error:', e.message); }

            res.json({ message: 'Owner approved. Account and resort record created (unpublished).' });
        } catch (err) {
            await conn.rollback();
            console.error('Owner approve error:', err);
            res.status(500).json({ message: 'Failed.' });
        } finally { conn.release(); }
    });

    router.put('/admin/owner-registrations/:id/reject', authenticateAdmin, async (req, res) => {
        if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Access denied.' });
        try {
            const { reason } = req.body;
            const [reg] = await pool.execute("SELECT * FROM owner_registrations WHERE id = ? AND status = 'pending'", [req.params.id]);
            if (reg.length === 0) return res.status(404).json({ message: 'Not found or already processed.' });
            const r = reg[0];

            await pool.execute('UPDATE owner_registrations SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?', ['rejected', reason || 'Does not meet requirements.', req.admin.id, r.id]);

            // Delete submitted documents for privacy
            [r.valid_id_path, r.business_permit_path, r.ownership_proof_path].forEach(p => {
                if (p) try { fs.unlinkSync(path.join(ownerUploadDir, p)); } catch (e) {}
            });

            try {
                if (emailTransporter) {
                    await emailTransporter.sendMail({
                        from: `"Baco LGU" <${process.env.EMAIL_USER}>`,
                        to: r.email,
                        subject: 'STAYHUB — Registration Update',
                        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;"><h2 style="color:#c0392b;">Registration Update</h2><p>Dear ${r.first_name},</p><p>Your owner registration has not been approved at this time.</p>${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}<p>You may submit a new registration at any time.</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/><p style="color:#9CA3AF;font-size:12px;">Municipality of Baco, Oriental Mindoro</p></div>`
                    });
                }
            } catch (e) { console.error('Owner rejection email error:', e.message); }

            res.json({ message: 'Owner registration rejected.' });
        } catch (err) {
            console.error('Owner reject error:', err);
            res.status(500).json({ message: 'Failed.' });
        }
    });

    // ══════════ ADMIN: OWNER ACCOUNTS DIRECTORY (Owners tab) ══════════

    router.get('/admin/owners', authenticateAdmin, async (req, res) => {
        try {
            const [owners] = await pool.execute('SELECT * FROM hotel_owners ORDER BY created_at DESC');
            const [hotels] = await pool.execute('SELECT id, owner_id, name, location, available FROM hotels WHERE owner_id IS NOT NULL');
            res.json(owners.map(o => ({
                id: o.id,
                firstName: o.first_name, middleName: o.middle_name, lastName: o.last_name,
                fullName: [o.first_name, o.middle_name, o.last_name].filter(Boolean).join(' '),
                email: o.email,
                contactNumber: o.contact_number,
                businessName: o.business_name,
                businessPermitNo: o.business_permit_no,
                validIdUrl: o.valid_id_path ? `${BASE_URL}/owner_uploads/${o.valid_id_path}` : null,
                status: o.status,
                createdAt: o.created_at,
                hotels: hotels.filter(h => h.owner_id === o.id)
                    .map(h => ({ id: h.id, name: h.name, location: h.location, published: !!h.available }))
            })));
        } catch (err) { console.error('Fetch owners error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    router.put('/admin/owners/:id/status', authenticateAdmin, async (req, res) => {
        try {
            const { status } = req.body;
            if (!['active', 'inactive'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
            const [result] = await pool.execute('UPDATE hotel_owners SET status = ? WHERE id = ?', [status, req.params.id]);
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Owner not found.' });
            res.json({ message: `Owner account ${status === 'active' ? 'activated' : 'deactivated'}.` });
        } catch (err) { console.error('Owner status error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    router.delete('/admin/owners/:id', authenticateAdmin, async (req, res) => {
        try {
            if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Only Super Admin can delete owners.' });
            const [existing] = await pool.execute('SELECT * FROM hotel_owners WHERE id = ?', [req.params.id]);
            if (existing.length === 0) return res.status(404).json({ message: 'Owner not found.' });
            await pool.execute('DELETE FROM hotel_owners WHERE id = ?', [req.params.id]);
            // FK (hotels_owner_fk, ON DELETE SET NULL) automatically unlinks their resort listings
            res.json({ message: 'Owner deleted. Their resort listings remain but are unlinked.' });
        } catch (err) { console.error('Owner delete error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    // ══════════ ADMIN: OWNER-POSTED RESORTS (review & publish management) ══════════
    // ⚠️ VIEW / PUBLISH / UNPUBLISH / REMOVE only — admins can NEVER edit
    // owner resorts or their rooms. Editing is the owner's responsibility.

    router.get('/admin/owner-resorts', authenticateAdmin, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                `SELECT h.*, ho.first_name, ho.middle_name, ho.last_name, ho.email as owner_email,
                        ho.contact_number as owner_contact, ho.business_name, ho.business_permit_no
                 FROM hotels h
                 LEFT JOIN hotel_owners ho ON h.owner_id = ho.id
                 WHERE h.owner_id IS NOT NULL
                 ORDER BY h.created_at DESC`
            );
            const [fees] = await pool.execute('SELECT * FROM entrance_fees');
            const [rooms] = await pool.execute('SELECT * FROM hotel_rooms');
            const [stats] = await pool.execute(
                `SELECT hotel_id, COUNT(*) as bookings,
                        COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END),0) as revenue
                 FROM hotel_bookings GROUP BY hotel_id`
            );
            res.json(rows.map(h => {
                const hRooms = rooms.filter(r => r.hotel_id === h.id);
                const hFees = fees.filter(f => f.hotel_id === h.id);
                const hStats = stats.find(s => s.hotel_id === h.id) || { bookings: 0, revenue: 0 };
                let am = []; try { am = h.amenities ? JSON.parse(h.amenities) : []; } catch (e) {}
                return {
                    id: h.id,
                    name: h.name, location: h.location, type: h.type,
                    contact: h.contact, email: h.email,
                    basePrice: Number(h.base_price || 0),
                    dailyCapacity: h.daily_capacity,
                    image: h.image ? `${IMG_BASE}/${h.image}` : null,
                    description: h.description || '',
                    amenities: am,
                    published: !!h.available,
                    createdAt: h.created_at,
                    owner: {
                        id: h.owner_id,
                        fullName: [h.first_name, h.middle_name, h.last_name].filter(Boolean).join(' ') || 'Unknown',
                        email: h.owner_email || '—',
                        contact: h.owner_contact || '—',
                        businessName: h.business_name || '—',
                        businessPermitNo: h.business_permit_no || '—'
                    },
                    entranceFees: hFees.map(f => ({ id: f.id, name: f.name, price: Number(f.price), status: f.status })),
                    rooms: hRooms.map(r => {
                        let ram = []; try { ram = r.amenities ? JSON.parse(r.amenities) : []; } catch (e) {}
                        return { id: r.id, name: r.room_type, capacity: r.capacity, price: Number(r.price_per_night), totalCount: r.total_count, status: r.status, amenities: ram };
                    }),
                    bookings: hStats.bookings,
                    revenue: Number(hStats.revenue)
                };
            }));
        } catch (err) { console.error('Admin owner-resorts error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    router.put('/admin/owner-resorts/:id/publish', authenticateAdmin, async (req, res) => {
        try {
            const [result] = await pool.execute('UPDATE hotels SET available = 1 WHERE id = ? AND owner_id IS NOT NULL', [req.params.id]);
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Owner resort not found.' });
            res.json({ message: 'Resort published — now visible and bookable to tourists.' });
        } catch (err) { console.error('Owner resort publish error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    router.put('/admin/owner-resorts/:id/unpublish', authenticateAdmin, async (req, res) => {
        try {
            const [result] = await pool.execute('UPDATE hotels SET available = 0 WHERE id = ? AND owner_id IS NOT NULL', [req.params.id]);
            if (result.affectedRows === 0) return res.status(404).json({ message: 'Owner resort not found.' });
            res.json({ message: 'Resort unpublished — hidden from tourists.' });
        } catch (err) { console.error('Owner resort unpublish error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    router.delete('/admin/owner-resorts/:id', authenticateAdmin, async (req, res) => {
        try {
            if (req.admin.role !== 'main_controller') return res.status(403).json({ message: 'Only Super Admin can remove owner resorts.' });
            const [existing] = await pool.execute('SELECT * FROM hotels WHERE id = ? AND owner_id IS NOT NULL', [req.params.id]);
            if (existing.length === 0) return res.status(404).json({ message: 'Owner resort not found.' });
            // FIXED: the FK on hotel_bookings.hotel_id blocks deletion when ANY
            // booking exists (not just confirmed) — check all of them to avoid a raw 500
            const [bookings] = await pool.execute('SELECT COUNT(*) as cnt FROM hotel_bookings WHERE hotel_id = ?', [req.params.id]);
            if (bookings[0].cnt > 0) return res.status(400).json({ message: `Cannot remove — ${bookings[0].cnt} booking record(s) exist. Unpublish instead.` });
            await pool.execute('DELETE FROM hotels WHERE id = ?', [req.params.id]);
            // FK cascades: rooms + entrance fees + inquiries removed automatically
            res.json({ message: 'Owner resort removed.' });
        } catch (err) { console.error('Owner resort delete error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    // ══════════════════════════════════════════════════════════
    // OWNER: MY ACCOMMODATION (one listing per owner)
    // ══════════════════════════════════════════════════════════

    const mapOwnerRoom = (r) => {
        let am = []; try { am = r.amenities ? JSON.parse(r.amenities) : []; } catch (e) {}
        let gal = []; try { gal = r.gallery ? r.gallery.split(',').filter(Boolean).map(g => `${IMG_BASE}/${g.trim()}`) : []; } catch (e) {}
        return {
            id: r.id, name: r.room_name || r.room_type, type: r.room_type || 'Standard',
            capacity: r.capacity, price: Number(r.price_per_night), totalCount: r.total_count,
            image: r.image ? `${IMG_BASE}/${r.image}` : (gal[0] || null), gallery: gal,
            description: r.description || '', amenities: am,
            status: r.status, createdAt: r.created_at
        };
    };

    // ── Get owner's accommodation (or null if not created yet) ──
    router.get('/owner/hotel', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT * FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.json({ hotel: null });
            const h = hotels[0];
            const [rooms] = await pool.execute('SELECT * FROM hotel_rooms WHERE hotel_id = ? ORDER BY price_per_night ASC', [h.id]);
            const [fees] = await pool.execute('SELECT * FROM entrance_fees WHERE hotel_id = ? ORDER BY price ASC', [h.id]);
            const [stats] = await pool.execute(
                `SELECT COUNT(*) as bookings, COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END), 0) as revenue FROM hotel_bookings WHERE hotel_id = ?`,
                [h.id]
            );
            // ✅ Review aggregate so the owner dashboard shows the live destination rating
            const [hratings] = await pool.execute('SELECT ROUND(AVG(rating),1) as avg_rating, COUNT(*) as review_count FROM hotel_reviews WHERE hotel_id = ?', [h.id]);
            const f = formatHotel(h, rooms);
            f.bookings = stats[0].bookings;
            f.revenue = Number(stats[0].revenue);
            f.avgRating = hratings[0]?.avg_rating != null ? Number(hratings[0].avg_rating) : null;
            f.reviewCount = hratings[0]?.review_count || 0;
            f.published = !!h.available;
            f.entranceFees = fees.map(x => ({ id: x.id, name: x.name, price: Number(x.price), description: x.description || '', status: x.status }));
            f.dailyCapacity = h.daily_capacity;
            res.json({ hotel: f });
        } catch (err) { console.error('Owner hotel fetch error:', err.message); res.status(500).json({ message: 'Failed to fetch accommodation.' }); }
    });

    // ── Create accommodation (ONE per owner — enforced) ──
    router.post('/owner/hotel', authenticateOwner, async (req, res) => {
        try {
            const [existing] = await pool.execute('SELECT id FROM hotels WHERE owner_id = ? LIMIT 1', [req.owner.id]);
            if (existing.length > 0) return res.status(409).json({ message: 'You already have a registered accommodation. Each owner can list only one — you can edit it instead.' });

            const { name, type, location, contact, email, basePrice, dailyCapacity, description, amenities, mainImage, galleryImages, houseRules } = req.body;
            if (!name || !name.trim()) return res.status(400).json({ message: 'Accommodation name is required.' });

            let mainImageFilename = '';
            if (mainImage && mainImage.startsWith('data:image')) mainImageFilename = saveBase64Image(mainImage);

            const galleryFilenames = [];
            if (Array.isArray(galleryImages)) {
                for (const img of galleryImages) {
                    if (img && img.startsWith('data:image')) galleryFilenames.push(saveBase64Image(img));
                    else if (img && img.includes(IMG_BASE)) galleryFilenames.push(img.split('/').pop());
                }
            }

            const [result] = await pool.execute(
                'INSERT INTO hotels (owner_id, name, location, type, contact, email, base_price, daily_capacity, available, image, description, amenities, gallery, house_rules) VALUES (?,?,?,?,?,?,?,?,0,?,?,?,?,?)',
                [req.owner.id, name.trim(), location || '', type || '', contact || '', email || '', basePrice || 0, dailyCapacity ? Number(dailyCapacity) : null, mainImageFilename, description || '', JSON.stringify(amenities || []), galleryFilenames.join(','), houseRules || null]
            );
            const [rows] = await pool.execute('SELECT * FROM hotels WHERE id = ?', [result.insertId]);
            const f = formatHotel(rows[0], []);
            f.bookings = 0; f.revenue = 0; f.published = false;
            f.entranceFees = [];
            f.dailyCapacity = rows[0].daily_capacity;
            res.status(201).json({ message: 'Accommodation created! It will be visible to tourists once verified and published by the LGU Tourism Office.', hotel: f });
        } catch (err) { console.error('Owner hotel create error:', err.message); res.status(500).json({ message: 'Failed to create accommodation.' }); }
    });

    // ── Update accommodation (owner's own only; cannot change published state) ──
    router.put('/owner/hotel', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT * FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.status(404).json({ message: 'No accommodation found. Create one first.' });
            const c = hotels[0];

            const { name, type, location, contact, email, basePrice, dailyCapacity, description, amenities, mainImage, galleryImages, houseRules } = req.body;

            let mainImageFilename = c.image || '';
            if (mainImage === '') mainImageFilename = '';
            else if (mainImage && mainImage.startsWith('data:image')) mainImageFilename = saveBase64Image(mainImage);
            else if (mainImage && mainImage.includes(IMG_BASE)) mainImageFilename = mainImage.split('/').pop();

            let galleryString = c.gallery || '';
            if (Array.isArray(galleryImages)) {
                const galleryFilenames = [];
                for (const img of galleryImages) {
                    if (img && img.startsWith('data:image')) galleryFilenames.push(saveBase64Image(img));
                    else if (img && img.includes(IMG_BASE)) galleryFilenames.push(img.split('/').pop());
                }
                galleryString = galleryFilenames.join(',');
            }

            await pool.execute(
                'UPDATE hotels SET name=?, location=?, type=?, contact=?, email=?, base_price=?, daily_capacity=?, image=?, description=?, amenities=?, gallery=?, house_rules=? WHERE id=?',
                [
                    (name && name.trim()) || c.name,
                    location !== undefined ? location : c.location,
                    type || c.type,
                    contact !== undefined ? contact : c.contact,
                    email !== undefined ? email : c.email,
                    basePrice !== undefined ? basePrice : c.base_price,
                    dailyCapacity !== undefined ? (dailyCapacity ? Number(dailyCapacity) : null) : c.daily_capacity,
                    mainImageFilename,
                    description !== undefined ? description : c.description,
                    amenities !== undefined ? JSON.stringify(amenities) : c.amenities,
                    galleryString,
                    houseRules !== undefined ? (houseRules || null) : c.house_rules,
                    c.id
                ]
            );

            const [updated] = await pool.execute('SELECT * FROM hotels WHERE id = ?', [c.id]);
            const [rooms] = await pool.execute('SELECT * FROM hotel_rooms WHERE hotel_id = ? ORDER BY price_per_night ASC', [c.id]);
            const [fees] = await pool.execute('SELECT * FROM entrance_fees WHERE hotel_id = ? ORDER BY price ASC', [c.id]);
            const [stats] = await pool.execute(
                `SELECT COUNT(*) as bookings, COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END), 0) as revenue FROM hotel_bookings WHERE hotel_id = ?`,
                [c.id]
            );
            const f = formatHotel(updated[0], rooms);
            f.bookings = stats[0].bookings;
            f.revenue = Number(stats[0].revenue);
            f.published = !!updated[0].available;
            f.entranceFees = fees.map(x => ({ id: x.id, name: x.name, price: Number(x.price), description: x.description || '', status: x.status }));
            f.dailyCapacity = updated[0].daily_capacity;
            res.json({ message: 'Accommodation updated successfully.', hotel: f });
        } catch (err) { console.error('Owner hotel update error:', err.message); res.status(500).json({ message: 'Failed to update accommodation.' }); }
    });

    // ── Delete accommodation (owner's own; blocked if any booking history exists) ──
    router.delete('/owner/hotel', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT * FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.status(404).json({ message: 'No accommodation found.' });
            const h = hotels[0];

            const [bookings] = await pool.execute('SELECT COUNT(*) as cnt FROM hotel_bookings WHERE hotel_id = ?', [h.id]);
            if (bookings[0].cnt > 0) return res.status(400).json({ message: 'Cannot delete — this listing has booking history. Contact the LGU Tourism Office to have it taken offline instead.' });

            const conn = await pool.getConnection();
            try {
                await conn.beginTransaction();
                await conn.execute('DELETE FROM resort_inquiries WHERE hotel_id = ?', [h.id]);
                await conn.execute('DELETE FROM entrance_fees WHERE hotel_id = ?', [h.id]);
                await conn.execute('DELETE FROM hotel_rooms WHERE hotel_id = ?', [h.id]);
                await conn.execute('DELETE FROM hotels WHERE id = ?', [h.id]);
                await conn.commit();
            } catch (e) { await conn.rollback(); throw e; }
            finally { conn.release(); }

            res.json({ message: 'Accommodation deleted.' });
        } catch (err) { console.error('Owner hotel delete error:', err.message); res.status(500).json({ message: 'Failed to delete accommodation.' }); }
    });

    // ══════════ OWNER: ENTRANCE FEES (primary bookable product) ══════════

    // ── Add entrance fee type ──
    router.post('/owner/hotel/fees', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT id FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.status(404).json({ message: 'Create your accommodation first.' });
            const { name, price, description, status } = req.body;
            if (!name || !name.trim()) return res.status(400).json({ message: 'Fee name is required.' });
            if (!price || Number(price) <= 0) return res.status(400).json({ message: 'Price must be greater than 0.' });
            const [result] = await pool.execute(
                'INSERT INTO entrance_fees (hotel_id, name, price, description, status) VALUES (?,?,?,?,?)',
                [hotels[0].id, name.trim(), price, description || null, status === 'inactive' ? 'inactive' : 'active']
            );
            const [rows] = await pool.execute('SELECT * FROM entrance_fees WHERE id = ?', [result.insertId]);
            const f = rows[0];
            res.status(201).json({ message: 'Entrance fee added.', fee: { id: f.id, name: f.name, price: Number(f.price), description: f.description || '', status: f.status } });
        } catch (err) { console.error('Owner fee create error:', err.message); res.status(500).json({ message: 'Failed to add entrance fee.' }); }
    });

    // ── Update entrance fee (verified: fee must belong to owner's hotel) ──
    router.put('/owner/hotel/fees/:feeId', authenticateOwner, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                'SELECT ef.id FROM entrance_fees ef JOIN hotels h ON ef.hotel_id = h.id WHERE ef.id = ? AND h.owner_id = ?',
                [req.params.feeId, req.owner.id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Fee not found.' });
            const c = rows[0];

            const { name, price, description, status } = req.body;
            const [updated] = await pool.execute(
                'UPDATE entrance_fees SET name=?, price=?, description=?, status=? WHERE id=?',
                [
                    (name && name.trim()) || c.name,
                    price !== undefined ? price : c.price,
                    description !== undefined ? description : c.description,
                    status || c.status,
                    c.id
                ]
            );
            const [rows2] = await pool.execute('SELECT * FROM entrance_fees WHERE id = ?', [c.id]);
            const f = rows2[0];
            res.json({ message: 'Fee updated.', fee: { id: f.id, name: f.name, price: Number(f.price), description: f.description || '', status: f.status } });
        } catch (err) { console.error('Owner fee update error:', err.message); res.status(500).json({ message: 'Failed to update fee.' }); }
    });

    // ── Delete entrance fee ──
    router.delete('/owner/hotel/fees/:feeId', authenticateOwner, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                'SELECT ef.id FROM entrance_fees ef JOIN hotels h ON ef.hotel_id = h.id WHERE ef.id = ? AND h.owner_id = ?',
                [req.params.feeId, req.owner.id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Fee not found.' });
            await pool.execute('DELETE FROM entrance_fees WHERE id = ?', [req.params.feeId]);
            res.json({ message: 'Fee deleted.' });
        } catch (err) { console.error('Owner fee delete error:', err.message); res.status(500).json({ message: 'Failed to delete fee.' }); }
    });

    // ══════════ OWNER: INQUIRIES (visitors asking questions — no booking) ══════════

    router.get('/owner/inquiries', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT id FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.json([]);
            const [rows] = await pool.execute('SELECT * FROM resort_inquiries WHERE hotel_id = ? ORDER BY created_at DESC LIMIT 200', [hotels[0].id]);
            res.json(rows);
        } catch (err) { console.error('Owner inquiries fetch error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    router.put('/owner/inquiries/:id/status', authenticateOwner, async (req, res) => {
        try {
            const { status } = req.body;
            if (!['new', 'read', 'answered'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
            const [rows] = await pool.execute(
                'SELECT ri.id FROM resort_inquiries ri JOIN hotels h ON ri.hotel_id = h.id WHERE ri.id = ? AND h.owner_id = ?',
                [req.params.id, req.owner.id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Not found.' });
            await pool.execute('UPDATE resort_inquiries SET status = ? WHERE id = ?', [status, req.params.id]);
            res.json({ message: 'Inquiry marked as ' + status + '.' });
        } catch (err) { console.error('Owner inquiry status error:', err.message); res.status(500).json({ message: 'Failed.' }); }
    });

    // Normalizes mysql2 DATE values (Date object or string) to 'YYYY-MM-DD'
    const toDateStr = (v) => {
        if (!v) return null;
        if (typeof v === 'string') return v.slice(0, 10);
        const d = new Date(v);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // ══════════ OWNER: BOOKINGS + DASHBOARD STATS ══════════
    router.get('/owner/bookings', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT id, name FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) {
                return res.json({
                    hotel: null,
                    bookings: [],
                    stats: { total: 0, entrance: 0, accommodation: 0, revenue: 0, todayVisitors: 0, pending: 0, confirmed: 0, completed: 0, todayArrivals: 0, todayDepartures: 0, inHouse: 0 }
                });
            }
            const hotelId = hotels[0].id;

            const [rows] = await pool.execute(
                `SELECT hb.*, COALESCE(hr.room_name, hr.room_type) as room_type, ef.name as fee_name
                 FROM hotel_bookings hb
                 LEFT JOIN hotel_rooms hr ON hb.room_id = hr.id
                 LEFT JOIN entrance_fees ef ON hb.entrance_fee_id = ef.id
                 WHERE hb.hotel_id = ?
                 ORDER BY hb.created_at DESC
                 LIMIT 500`,
                [hotelId]
            );

            const [stats] = await pool.execute(
                `SELECT COUNT(*) as total,
                        COALESCE(SUM(booking_type = 'entrance'),0) as entrance,
                        COALESCE(SUM(booking_type = 'accommodation'),0) as accommodation,
                        COALESCE(SUM(CASE WHEN status IN ('confirmed','completed') THEN total_amount ELSE 0 END),0) as revenue,
                        COALESCE(SUM(CASE WHEN status = 'confirmed' AND check_in = CURDATE() THEN pax ELSE 0 END),0) as todayVisitors,
                        COALESCE(SUM(status = 'pending'),0) as pending,
                        COALESCE(SUM(status = 'confirmed'),0) as confirmed,
                        COALESCE(SUM(status = 'completed'),0) as completed,
                        COALESCE(SUM(status = 'confirmed' AND check_in = CURDATE()),0) as todayArrivals,
                        COALESCE(SUM(status = 'confirmed' AND booking_type = 'accommodation' AND check_out = CURDATE()),0) as todayDepartures,
                        COALESCE(SUM(status = 'confirmed' AND check_in <= CURDATE() AND check_out > CURDATE()),0) as inHouse
                 FROM hotel_bookings WHERE hotel_id = ?`,
                [hotelId]
            );
            res.json({
                hotel: { id: hotels[0].id, name: hotels[0].name },
                bookings: rows.map(b => ({
                    id: b.booking_ref,
                    dbId: b.id,
                    bookingType: b.booking_type,
                    guestName: b.guest_name,
                    guestEmail: b.guest_email,
                    guestContact: b.guest_contact,
                    guestIdType: b.guest_id_type || null,
                    specialRequests: b.special_requests || '',
                    pax: b.pax,
                    adults: b.adults,
                    children: b.children,
                    roomName: b.room_type || null,
                    feeName: b.fee_name || null,
                    checkIn: toDateStr(b.check_in),
                    checkOut: toDateStr(b.check_out),
                    nights: b.nights,
                    totalAmount: Number(b.total_amount),
                    status: b.status,
                    paymentStatus: b.payment_status,
                    paymentMethod: b.payment_method,
                    createdAt: b.created_at
                })),
                stats: {
                    total: Number(stats[0].total),
                    entrance: Number(stats[0].entrance),
                    accommodation: Number(stats[0].accommodation),
                    revenue: Number(stats[0].revenue),
                    todayVisitors: Number(stats[0].todayVisitors),
                    pending: Number(stats[0].pending),
                    confirmed: Number(stats[0].confirmed),
                    completed: Number(stats[0].completed),
                    todayArrivals: Number(stats[0].todayArrivals),
                    todayDepartures: Number(stats[0].todayDepartures),
                    inHouse: Number(stats[0].inHouse)
                }
            });
        } catch (err) {
            console.error('Owner bookings error:', err.message);
            res.status(500).json({ message: 'Failed.' });
        }
    });

        // ── OWNER: Guest reviews for my accommodation ──
        router.get('/owner/reviews', authenticateOwner, async (req, res) => {
            try {
                const [hotels] = await pool.execute(
                    'SELECT id, name FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1',
                    [req.owner.id]
                );
                if (hotels.length === 0) {
                    return res.json({
                        hotel: null,
                        stats: { avg: null, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } },
                        reviews: []
                    });
                }
                const hotelId = hotels[0].id;
    
                const [rows] = await pool.execute(
                    `SELECT rv.id, rv.rating, rv.title, rv.content, rv.created_at, rv.edited_at,
                            TRIM(CONCAT(tu.first_name, ' ', tu.last_name)) as reviewer_name,
                            hb.booking_ref, hb.booking_type, hb.check_in, hb.check_out, hb.nights, hb.pax,
                            COALESCE(hr.room_name, hr.room_type) as room_name,
                            ef.name as fee_name
                     FROM hotel_reviews rv
                     JOIN hotel_bookings hb ON rv.booking_id = hb.id
                     LEFT JOIN hotel_rooms hr ON hb.room_id = hr.id
                     LEFT JOIN entrance_fees ef ON hb.entrance_fee_id = ef.id
                     LEFT JOIN tourism_users tu ON rv.user_id = tu.id
                     WHERE rv.hotel_id = ?
                     ORDER BY rv.created_at DESC
                     LIMIT 500`,
                    [hotelId]
                );
    
                const [statsRows] = await pool.execute(
                    `SELECT ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as total,
                            COALESCE(SUM(rating = 5), 0) as s5, COALESCE(SUM(rating = 4), 0) as s4,
                            COALESCE(SUM(rating = 3), 0) as s3, COALESCE(SUM(rating = 2), 0) as s2,
                            COALESCE(SUM(rating = 1), 0) as s1
                     FROM hotel_reviews WHERE hotel_id = ?`,
                    [hotelId]
                );
                const s = statsRows[0];
    
                res.json({
                    hotel: { id: hotelId, name: hotels[0].name },
                    stats: {
                        avg: s.avg_rating != null ? Number(s.avg_rating) : null,
                        count: Number(s.total),
                        distribution: {
                            5: Number(s.s5), 4: Number(s.s4), 3: Number(s.s3),
                            2: Number(s.s2), 1: Number(s.s1)
                        }
                    },
                    reviews: rows.map(r => ({
                        id: r.id,
                        rating: r.rating,
                        title: r.title,
                        content: r.content,
                        reviewerName: r.reviewer_name || 'Anonymous Guest',
                        bookingRef: r.booking_ref,
                        bookingType: r.booking_type,
                        stayDescription: r.booking_type === 'entrance'
                            ? (r.fee_name || 'Day visit')
                            : (r.room_name || 'Stay'),
                        checkIn: toDateStr(r.check_in),
                        checkOut: toDateStr(r.check_out),
                        nights: r.nights,
                        pax: r.pax,
                        createdAt: r.created_at,
                        edited: !!r.edited_at
                    }))
                });
            } catch (err) {
                console.error('Owner reviews error:', err.message);
                res.status(500).json({ message: 'Failed to fetch reviews.' });
            }
        });

// ══════════ OWNER: MESSAGES (guest ↔ owner, via their resort) ══════════

const OWNER_MSG_MAX = 2000;

const mapOwnerMsg = (m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderType: m.sender_type,
    text: m.body,
    reaction: m.reaction || null,
    // Owner view: owner messages = 'sent', guest messages = 'received'
    type: m.sender_type === 'owner' ? 'sent' : 'received',
    createdAt: m.created_at
});

// ── List guest conversations for the owner's resort ──
router.get('/owner/messages/conversations', authenticateOwner, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT c.id, c.hotel_id, c.counterpart_read_at, c.created_at,
                    h.name AS hotel_name, h.image AS hotel_image,
                    COALESCE(NULLIF(TRIM(CONCAT(tu.first_name, ' ', tu.last_name)), ''), tu.email, 'Guest') AS guest_name,
                    (SELECT COUNT(*) FROM messages m
                      WHERE m.conversation_id = c.id AND m.sender_type = 'user'
                        AND (c.counterpart_read_at IS NULL OR m.created_at > c.counterpart_read_at)) AS unread,
                    (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
                    COALESCE((SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1), c.created_at) AS last_at
             FROM conversations c
             JOIN hotels h ON c.hotel_id = h.id
             LEFT JOIN tourism_users tu ON c.user_id = tu.id
             WHERE h.owner_id = ?
             ORDER BY last_at DESC, c.id DESC`,
            [req.owner.id]
        );
        res.json(rows.map(r => ({
            id: r.id,
            hotelId: r.hotel_id,
            name: r.guest_name,
            hotelName: r.hotel_name,
            image: r.hotel_image ? `${BASE_URL}/uploads/${r.hotel_image}` : null,
            unread: Number(r.unread) || 0,
            lastMessage: r.last_body || '',
            lastAt: r.last_at
        })));
    } catch (e) {
        console.error('Owner conversations error:', e.message);
        res.status(500).json({ message: 'Failed to load conversations.' });
    }
});

// ── Thread (fetching marks it read on the owner side) ──
router.get('/owner/messages/conversations/:id/messages', authenticateOwner, async (req, res) => {
    try {
        const [convs] = await pool.execute(
            `SELECT c.* FROM conversations c JOIN hotels h ON c.hotel_id = h.id
             WHERE c.id = ? AND h.owner_id = ?`, [req.params.id, req.owner.id]
        );
        if (convs.length === 0) return res.status(404).json({ message: 'Conversation not found.' });
        const conv = convs[0];
        const [msgs] = await pool.execute(
            'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500', [conv.id]
        );
        await pool.execute('UPDATE conversations SET counterpart_read_at = NOW() WHERE id = ?', [conv.id]);
        res.json({ conversationId: conv.id, messages: msgs.map(mapOwnerMsg) });
    } catch (e) {
        console.error('Owner thread error:', e.message);
        res.status(500).json({ message: 'Failed to load messages.' });
    }
});

// ── Reply in a thread ──
router.post('/owner/messages/conversations/:id/messages', authenticateOwner, async (req, res) => {
    try {
        const body = String(req.body.body || '').trim();
        if (!body) return res.status(400).json({ message: 'Message cannot be empty.' });
        if (body.length > OWNER_MSG_MAX) return res.status(400).json({ message: `Message is too long (max ${OWNER_MSG_MAX} characters).` });

        const [convs] = await pool.execute(
            `SELECT c.id FROM conversations c JOIN hotels h ON c.hotel_id = h.id
             WHERE c.id = ? AND h.owner_id = ?`, [req.params.id, req.owner.id]
        );
        if (convs.length === 0) return res.status(404).json({ message: 'Conversation not found.' });

        await pool.execute(
            "INSERT INTO messages (conversation_id, sender_type, sender_id, body) VALUES (?, 'owner', ?, ?)",
            [convs[0].id, req.owner.id, body]
        );
        await pool.execute('UPDATE conversations SET counterpart_read_at = NOW() WHERE id = ?', [convs[0].id]);

        const [msgs] = await pool.execute(
            'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500', [convs[0].id]
        );
        res.status(201).json({ conversationId: convs[0].id, messages: msgs.map(mapOwnerMsg) });
    } catch (e) {
        console.error('Owner send error:', e.message);
        res.status(500).json({ message: 'Failed to send message.' });
    }
});

// ── Owner: toggle ❤️ on a message in a guest thread ──
router.put('/owner/messages/conversations/:id/messages/:msgId/reaction', authenticateOwner, async (req, res) => {
    try {
        const [convs] = await pool.execute(
            `SELECT c.id FROM conversations c JOIN hotels h ON c.hotel_id = h.id
             WHERE c.id = ? AND h.owner_id = ?`, [req.params.id, req.owner.id]
        );
        if (convs.length === 0) return res.status(404).json({ message: 'Conversation not found.' });

        const reaction = req.body.reaction ? String(req.body.reaction).slice(0, 32) : null;
        const [result] = await pool.execute(
            'UPDATE messages SET reaction = ? WHERE id = ? AND conversation_id = ?',
            [reaction, req.params.msgId, convs[0].id]
        );
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Message not found.' });
        res.json({ id: Number(req.params.msgId), reaction });
    } catch (e) {
        console.error('Owner reaction error:', e.message);
        res.status(500).json({ message: 'Failed to update reaction.' });
    }
});

// ── Unread count (available for badges whenever you want to wire them) ──
router.get('/owner/messages/unread-count', authenticateOwner, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT COUNT(*) AS total
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             JOIN hotels h ON c.hotel_id = h.id
             WHERE h.owner_id = ? AND m.sender_type = 'user'
               AND (c.counterpart_read_at IS NULL OR m.created_at > c.counterpart_read_at)`,
            [req.owner.id]
        );
        res.json({ unread: Number(rows[0].total) || 0 });
    } catch (e) { res.status(500).json({ unread: 0 }); }
});

    // ── OWNER: Approve / Reject / Complete / Cancel / No-show a booking ──
    router.put('/owner/bookings/:ref/status', authenticateOwner, async (req, res) => {
        try {
            const { status } = req.body;
            const allowed = ['confirmed', 'rejected', 'completed', 'cancelled', 'no_show'];
            if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status.' });

            const [hotels] = await pool.execute('SELECT id FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.status(404).json({ message: 'No accommodation found.' });

            const [rows] = await pool.execute(
                'SELECT * FROM hotel_bookings WHERE booking_ref = ? AND hotel_id = ?',
                [req.params.ref, hotels[0].id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
            const booking = rows[0];

            // Allowed transitions
            const transitions = {
                confirmed: ['pending'],
                rejected:  ['pending'],
                completed: ['confirmed'],
                cancelled: ['pending', 'confirmed'],
                no_show:   ['confirmed'],
            };
            if (!transitions[status].includes(booking.status)) {
                return res.status(400).json({ message: `Cannot move a "${booking.status}" booking to "${status}".` });
            }

            await pool.execute('UPDATE hotel_bookings SET status = ? WHERE id = ?', [status, booking.id]);
            res.json({ message: `Booking ${booking.booking_ref} marked as ${status}.`, status });
        } catch (err) {
            console.error('Owner booking status error:', err.message);
            res.status(500).json({ message: 'Failed to update booking status.' });
        }
    });

    // ── OWNER: Guest directory (aggregated from real bookings) ──
    router.get('/owner/guests', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT id FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.json({ guests: [] });
            const hotelId = hotels[0].id;

            const [rows] = await pool.execute(
                `SELECT hb.*, COALESCE(hr.room_name, hr.room_type) as room_type, ef.name as fee_name
                 FROM hotel_bookings hb
                 LEFT JOIN hotel_rooms hr ON hb.room_id = hr.id
                 LEFT JOIN entrance_fees ef ON hb.entrance_fee_id = ef.id
                 WHERE hb.hotel_id = ?
                 ORDER BY hb.created_at DESC
                 LIMIT 500`,
                [hotelId]
            );

            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            const map = {};
            for (const b of rows) {
                const key = (b.guest_email || 'unknown').toLowerCase();
                if (!map[key]) {
                    map[key] = {
                        email: b.guest_email,
                        name: b.guest_name,
                        contact: b.guest_contact,
                        idType: b.guest_id_type || null,
                        totalBookings: 0,
                        totalSpent: 0,
                        pendingCount: 0,
                        upcomingCount: 0,
                        lastVisit: null,
                        bookings: []
                    };
                }
                const g = map[key];
                g.totalBookings += 1;
                if (['confirmed', 'completed'].includes(b.status)) g.totalSpent += Number(b.total_amount);
                if (b.status === 'pending') g.pendingCount += 1;
                const ci = toDateStr(b.check_in);
                if (b.status === 'confirmed' && ci && ci >= todayStr) g.upcomingCount += 1;
                if (ci && (!g.lastVisit || ci > g.lastVisit)) g.lastVisit = ci;
                g.bookings.push({
                    id: b.booking_ref,
                    bookingType: b.booking_type,
                    roomName: b.room_type || null,
                    feeName: b.fee_name || null,
                    checkIn: ci,
                    checkOut: toDateStr(b.check_out),
                    nights: b.nights,
                    pax: b.pax,
                    totalAmount: Number(b.total_amount),
                    status: b.status,
                    paymentStatus: b.payment_status,
                    createdAt: b.created_at
                });
            }

            // rows are already newest-first, so insertion order = most recent guest first
            res.json({ guests: Object.values(map) });
        } catch (err) {
            console.error('Owner guests error:', err.message);
            res.status(500).json({ message: 'Failed to fetch guests.' });
        }
    });

    router.post('/owner/hotel/rooms', authenticateOwner, async (req, res) => {
        try {
            const [hotels] = await pool.execute('SELECT id FROM hotels WHERE owner_id = ? ORDER BY id ASC LIMIT 1', [req.owner.id]);
            if (hotels.length === 0) return res.status(404).json({ message: 'Create your accommodation first before adding rooms.' });
            const hotelId = hotels[0].id;

            const { roomName, roomType, capacity, pricePerNight, totalCount, description, amenities, status, image, galleryImages } = req.body;
            const type = (roomType || 'Standard').trim();
            const name = (roomName && roomName.trim()) || type;
            if (!name) return res.status(400).json({ message: 'Room name is required.' });
            if (!pricePerNight || Number(pricePerNight) <= 0) return res.status(400).json({ message: 'Price per night must be greater than 0.' });

            let imageFilename = '';
            if (image && image.startsWith('data:image')) imageFilename = saveBase64Image(image);
            else if (image && image.includes(IMG_BASE)) imageFilename = image.split('/').pop();

            const galleryFilenames = [];
            if (Array.isArray(galleryImages)) {
                for (const img of galleryImages) {
                    if (img && img.startsWith('data:image')) galleryFilenames.push(saveBase64Image(img));
                    else if (img && img.includes(IMG_BASE)) galleryFilenames.push(img.split('/').pop());
                }
            }
            if (!imageFilename && galleryFilenames.length) imageFilename = galleryFilenames[0];

            const [result] = await pool.execute(
                'INSERT INTO hotel_rooms (hotel_id, room_name, room_type, capacity, price_per_night, total_count, image, gallery, description, amenities, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
                [hotelId, name, type, capacity || 2, pricePerNight, totalCount || 1, imageFilename, galleryFilenames.join(','), description || '', JSON.stringify(amenities || []), status === 'inactive' ? 'inactive' : 'active']
            );
            const [rows] = await pool.execute('SELECT * FROM hotel_rooms WHERE id = ?', [result.insertId]);
            res.status(201).json({ message: 'Room type added.', room: mapOwnerRoom(rows[0]) });
        } catch (err) { console.error('Owner room create error:', err.message); res.status(500).json({ message: 'Failed to add room.' }); }
    });

    // ── Update room type (verified: room must belong to owner's hotel) ──
    router.put('/owner/hotel/rooms/:roomId', authenticateOwner, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                'SELECT hr.* FROM hotel_rooms hr JOIN hotels h ON hr.hotel_id = h.id WHERE hr.id = ? AND h.owner_id = ?',
                [req.params.roomId, req.owner.id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Room not found.' });
            const c = rows[0];

            const { roomName, roomType, capacity, pricePerNight, totalCount, description, amenities, status, image, galleryImages } = req.body;

            let imageFilename = c.image || '';
            if (image === '') imageFilename = '';
            else if (image && image.startsWith('data:image')) imageFilename = saveBase64Image(image);
            else if (image && image.includes(IMG_BASE)) imageFilename = image.split('/').pop();

            let galleryString = c.gallery || '';
            if (Array.isArray(galleryImages)) {
                const galleryFilenames = [];
                for (const img of galleryImages) {
                    if (img && img.startsWith('data:image')) galleryFilenames.push(saveBase64Image(img));
                    else if (img && img.includes(IMG_BASE)) galleryFilenames.push(img.split('/').pop());
                }
                galleryString = galleryFilenames.join(',');
                if (!imageFilename && galleryFilenames.length) imageFilename = galleryFilenames[0];
            }

            await pool.execute(
                'UPDATE hotel_rooms SET room_name=?, room_type=?, capacity=?, price_per_night=?, total_count=?, image=?, gallery=?, description=?, amenities=?, status=? WHERE id=?',
                [
                    (roomName && roomName.trim()) || c.room_name || c.room_type,
                    (roomType && roomType.trim()) || c.room_type,
                    capacity !== undefined ? capacity : c.capacity,
                    pricePerNight !== undefined ? pricePerNight : c.price_per_night,
                    totalCount !== undefined ? totalCount : c.total_count,
                    imageFilename,
                    galleryString,
                    description !== undefined ? description : c.description,
                    amenities !== undefined ? JSON.stringify(amenities) : c.amenities,
                    status || c.status,
                    c.id
                ]
            );
            const [updated] = await pool.execute('SELECT * FROM hotel_rooms WHERE id = ?', [c.id]);
            res.json({ message: 'Room updated.', room: mapOwnerRoom(updated[0]) });
        } catch (err) { console.error('Owner room update error:', err.message); res.status(500).json({ message: 'Failed to update room.' }); }
    });

    // ── Delete room type (blocked if active bookings exist) ──
    router.delete('/owner/hotel/rooms/:roomId', authenticateOwner, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                'SELECT hr.* FROM hotel_rooms hr JOIN hotels h ON hr.hotel_id = h.id WHERE hr.id = ? AND h.owner_id = ?',
                [req.params.roomId, req.owner.id]
            );
            if (rows.length === 0) return res.status(404).json({ message: 'Room not found.' });

            const [bookings] = await pool.execute('SELECT COUNT(*) as cnt FROM hotel_bookings WHERE room_id = ? AND status IN ("confirmed")', [req.params.roomId]);
            if (bookings[0].cnt > 0) return res.status(400).json({ message: `Cannot delete — ${bookings[0].cnt} active booking(s) exist for this room. Set it to Inactive instead.` });

            await pool.execute('DELETE FROM hotel_rooms WHERE id = ?', [req.params.roomId]);
            res.json({ message: 'Room deleted.' });
        } catch (err) { console.error('Owner room delete error:', err.message); res.status(500).json({ message: 'Failed to delete room.' }); }
    });

    // ══════════ PUBLIC: RESORT INQUIRY (no login required) ══════════

    router.post('/hotels/:id/inquire', async (req, res) => {
        try {
            const { name, email, contact, message } = req.body;
            if (!name || !name.trim() || !message || !message.trim()) return res.status(400).json({ message: 'Name and message are required.' });
            const [hotels] = await pool.execute('SELECT id FROM hotels WHERE id = ? AND available = 1', [req.params.id]);
            if (hotels.length === 0) return res.status(404).json({ message: 'Resort not found.' });

            // Attribute logged-in citizens by reading the JWT header manually
            let userId = null;
            const authHeader = req.headers['authorization'];
            if (authHeader) {
                try { userId = jwt.verify(authHeader.split(' ')[1], JWT_SECRET).id; } catch (e) { /* anonymous */ }
            }
            await pool.execute(
                'INSERT INTO resort_inquiries (hotel_id, user_id, name, email, contact, message) VALUES (?,?,?,?,?,?)',
                [req.params.id, userId, name.trim(), email || null, contact || null, message.trim()]
            );
            res.status(201).json({ message: 'Inquiry sent! The resort will get back to you soon.' });
        } catch (err) { console.error('Inquiry error:', err.message); res.status(500).json({ message: 'Failed to send inquiry.' }); }
    });

    console.log('✅ Owner accommodation routes registered');
    console.log('✅ Owner entrance fees & inquiries routes registered');
    console.log('✅ STAYHUB Owner routes registered');

} else {
    console.log('⚠️ Admin routes skipped (missing bcrypt/jsonwebtoken)');
}

module.exports = router;