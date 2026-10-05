const express = require('express');
const router = express.Router();
const { pool, bcrypt, jwt, googleClient, emailTransporter, generateOTP, sendOtpEmail, validatePasswordPolicy, authenticateToken, GOOGLE_CLIENT_ID, JWT_SECRET } = require('./_shared');

// OTP store now holds { code, expiresAt } — 5-minute expiry
const otpStore = {};

if (bcrypt && jwt) {

    // 1. Send OTP
    router.post('/auth/send-otp', async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) return res.status(400).json({ message: 'Email is required.' });

            const [existing] = await pool.execute(
                'SELECT id, password FROM tourism_users WHERE email = ?', [email]
            );
            if (existing.length > 0 && existing[0].password) {
                return res.status(400).json({
                    message: 'An account with this email already exists. Please log in instead.'
                });
            }

            const otp = generateOTP();

            // OTPs expire after 5 minutes + stale entries cleaned up
            for (const k of Object.keys(otpStore)) {
                if (!otpStore[k] || otpStore[k].expiresAt < Date.now()) delete otpStore[k];
            }
            otpStore[email] = { code: otp, expiresAt: Date.now() + 5 * 60 * 1000 };

            try {
                await sendOtpEmail(email, otp);
                res.json({ message: 'OTP sent successfully' });
            } catch (error) {
                console.error('Email Error:', error);
                if (!emailTransporter) {
                    res.json({ message: 'OTP generated (check server console in dev mode)' });
                } else {
                    res.status(500).json({ message: 'Failed to send OTP. Try again.' });
                }
            }
        } catch (err) {
            console.error('Send OTP error:', err);
            res.status(500).json({ message: 'Failed to send OTP.' });
        }
    });

    // 2. Register
    router.post('/auth/register', async (req, res) => {
        try {
            const { firstName, middleName, lastName, email, password, phone, otp } = req.body;

            if (!firstName || !lastName || !email || !password) {
                return res.status(400).json({ message: 'Name, Email, and Password are required.' });
            }

            // Password policy enforced on registration
            const pwMissing = validatePasswordPolicy(password);
            if (pwMissing.length > 0) {
                return res.status(400).json({
                    message: 'Password requirements not met: ' + pwMissing.join(', ') + '.'
                });
            }

            // Duplicate check runs BEFORE consuming the OTP,
            // so a failed attempt doesn't waste the user's verification code.
            const [existing] = await pool.execute(
                'SELECT id, password, google_id FROM tourism_users WHERE email = ?', [email]
            );
            if (existing.length > 0 && existing[0].password) {
                return res.status(400).json({ message: 'An account with this email already exists. Please log in instead.' });
            }

            // OTP expiry check
            const rec = otpStore[email];
            if (!otp || !rec || rec.code !== otp || Date.now() > rec.expiresAt) {
                return res.status(400).json({ message: 'Invalid or expired verification code.' });
            }
            delete otpStore[email];

            const hashedPassword = await bcrypt.hash(password, 10);
            const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

            if (existing.length > 0) {
                const user = existing[0];
                await pool.execute(
                    'UPDATE tourism_users SET first_name=?, middle_name=?, last_name=?, username=?, phone=?, password=?, is_verified=1 WHERE id=?',
                    [firstName, middleName || null, lastName, username, phone || null, hashedPassword, user.id]
                );
                const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '1d' });
                return res.status(200).json({ token, userId: user.id });
            }

            const [result] = await pool.execute(
                'INSERT INTO tourism_users (username, first_name, middle_name, last_name, email, phone, password, is_verified) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
                [username, firstName, middleName || null, lastName, email, phone || null, hashedPassword]
            );
            const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET, { expiresIn: '1d' });
            res.status(201).json({ token, userId: result.insertId });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).json({ message: 'Registration failed.' });
        }
    });

    // 3. Login
    router.post('/auth/login', async (req, res) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

            const [users] = await pool.execute('SELECT * FROM tourism_users WHERE email = ?', [email]);
            if (users.length === 0) return res.status(400).json({ message: 'Invalid credentials.' });

            const user = users[0];
            if (!user.password) {
                return res.status(400).json({
                    message: 'No password set for this account. Please sign in with Google first, or register with this email to set a password.'
                });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

            const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
            res.json({ token });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ message: 'Login failed.' });
        }
    });

    // 4. Google Sign-In
    router.post('/auth/google', async (req, res) => {
        try {
            if (!googleClient) return res.status(500).json({ message: 'Google auth not configured.' });

            const { idToken } = req.body;
            if (!idToken) {
                return res.status(400).json({ message: 'No ID token provided.' });
            }

            const ticket = await googleClient.verifyIdToken({
                idToken: idToken,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            const { email, name, sub } = payload;

            const [rows] = await pool.execute(
                'SELECT * FROM tourism_users WHERE google_id = ? OR email = ?', [sub, email]
            );

            if (rows.length > 0) {
                const user = rows[0];
                if (!user.google_id) {
                    await pool.execute('UPDATE tourism_users SET google_id = ? WHERE id = ?', [sub, user.id]);
                }
                if (!user.first_name && name) {
                    const parts = name.split(' ');
                    await pool.execute('UPDATE tourism_users SET first_name = ?, last_name = ? WHERE id = ?', [parts[0], parts.slice(1).join(' ') || '', user.id]);
                }
                const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '1d' });
                return res.json({ token, needsPassword: !user.password });
            }

            const nameParts = name.split(' ');
            const fName = nameParts[0];
            const lName = nameParts.slice(1).join(' ') || '';
            const username = email.split('@')[0] + Math.floor(Math.random() * 1000);

            const [result] = await pool.execute(
                'INSERT INTO tourism_users (username, first_name, last_name, email, google_id, is_verified) VALUES (?, ?, ?, ?, ?, 1)',
                [username, fName, lName, email, sub]
            );

            const token = jwt.sign({ id: result.insertId, email }, JWT_SECRET, { expiresIn: '1d' });
            res.json({ token, needsPassword: true });
        } catch (err) {
            console.error('GOOGLE AUTH ERROR:', err.message);
            res.status(500).json({ message: 'Google authentication failed.' });
        }
    });

    // 5. Set Password for Google Users
    // Password policy enforced + existing passwords require the
    // current password before they can be overwritten.
    router.post('/auth/set-password', authenticateToken, async (req, res) => {
        try {
            const { password, currentPassword } = req.body;
            if (!password) return res.status(400).json({ message: 'Password is required.' });

            const missing = validatePasswordPolicy(password);
            if (missing.length > 0) {
                return res.status(400).json({
                    message: 'Password requirements not met: ' + missing.join(', ') + '.'
                });
            }

            const [users] = await pool.execute('SELECT id, password FROM tourism_users WHERE id = ?', [req.user.id]);
            if (users.length === 0) return res.status(404).json({ message: 'User not found.' });

            const existingHash = users[0].password;
            if (existingHash) {
                if (!currentPassword) {
                    return res.status(400).json({
                        message: 'This account already has a password. Enter your current password to change it.'
                    });
                }
                const isMatch = await bcrypt.compare(currentPassword, existingHash);
                if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.execute('UPDATE tourism_users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
            res.json({ message: 'Password set successfully.' });
        } catch (err) {
            console.error('Set password error:', err);
            res.status(500).json({ message: 'Failed to set password.' });
        }
    });

    // 6. Get Current User
    router.get('/auth/me', authenticateToken, async (req, res) => {
        try {
            const [users] = await pool.execute(
                'SELECT id, username, first_name, middle_name, last_name, email, phone, google_id, password, is_verified, created_at FROM tourism_users WHERE id = ?',
                [req.user.id]
            );
            if (users.length === 0) return res.status(404).json({ message: 'User not found.' });

            const u = users[0];
            const fullName = [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(' ');
            res.json({
                id: u.id,
                username: u.username,
                firstName: u.first_name,
                middleName: u.middle_name,
                lastName: u.last_name,
                fullName: fullName || u.username,
                email: u.email,
                phone: u.phone,
                isGoogleUser: !!u.google_id,
                hasPassword: !!u.password,
                isVerified: !!u.is_verified,
                createdAt: u.created_at,
            });
        } catch (err) {
            console.error('Auth me error:', err);
            res.status(500).json({ message: 'Failed to fetch user data.' });
        }
    });

    console.log('✅ Auth routes registered');
} else {
    console.log('⚠️ Auth routes skipped (missing bcrypt/jsonwebtoken)');
}

module.exports = router;