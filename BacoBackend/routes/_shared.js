// Shared middleware, constants & helpers used across the modular route files.
// Internal module — does NOT register any routes.
const pool = require('../db');
const fs = require('fs');
const path = require('path');

let bcrypt, jwt, OAuth2Client, nodemailer;

try {
    bcrypt = require('bcrypt');
    jwt = require('jsonwebtoken');
    const googleAuth = require('google-auth-library');
    OAuth2Client = googleAuth.OAuth2Client;
    nodemailer = require('nodemailer');
    console.log('✅ Auth dependencies loaded');
} catch (err) {
    console.error('⚠️ Auth dependencies missing:', err.message);
    console.error('⚠️ Run: npm install bcrypt jsonwebtoken google-auth-library nodemailer');
}

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const JWT_SECRET = process.env.JWT_SECRET || 'baco_super_secret_key_2024';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '576649425113-1l4pc8nap6cb3v4a76sbelhl1te59sio.apps.googleusercontent.com';

let googleClient = null;
let emailTransporter = null;

if (OAuth2Client) {
    googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
}

if (nodemailer && process.env.EMAIL_USER) {
    emailTransporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
}

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const PASSWORD_MIN_LENGTH = 8;
const validatePasswordPolicy = (password) => {
    const missing = [];
    const pw = password || '';
    if (pw.length < PASSWORD_MIN_LENGTH) missing.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
    if (!/[A-Z]/.test(pw)) missing.push('One uppercase letter (A-Z)');
    if (!/[a-z]/.test(pw)) missing.push('One lowercase letter (a-z)');
    if (!/[0-9]/.test(pw)) missing.push('One number (0-9)');
    if (!/[^A-Za-z0-9\s]/.test(pw)) missing.push('One special character (!@#$%...)');
    if (/\s/.test(pw)) missing.push('No spaces allowed');
    return missing;
};

const PASSWORD_CHANGE_COOLDOWN_DAYS = 7;

const sendOtpEmail = async (email, otp) => {
    if (emailTransporter) {
        await emailTransporter.sendMail({
            from: `"Baco LGU" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Baco LGU — Email Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #000C7B;">Email Verification</h2>
                    <p>Your verification code is:</p>
                    <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #000C7B; padding: 16px 0;">
                        ${otp}
                    </div>
                    <p style="color: #6B7280; font-size: 14px;">This code expires in 5 minutes. Do not share this code with anyone.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
                    <p style="color: #9CA3AF; font-size: 12px;">Municipality of Baco, Oriental Mindoro</p>
                </div>
            `,
        });
    } else {
        console.log(`\n📧 [DEV MODE] OTP for ${email}: ${otp}\n`);
    }
};

const saveBase64Image = (base64String) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    const type = matches[1];
    const data = Buffer.from(matches[2], 'base64');
    const filename = Date.now() + '.' + type.split('/')[1];
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, data);
    return filename;
};

const authenticateToken = (req, res, next) => {
    if (!jwt) return res.status(500).json({ message: 'Auth not configured.' });
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

const authenticateAdmin = (req, res, next) => {
    if (!jwt) return res.status(500).json({ message: 'Auth not configured.' });
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

const authenticateOwner = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'owner') return res.status(403).json({ message: 'Invalid token type' });
        req.owner = decoded;
        next();
    } catch (err) { return res.status(403).json({ message: 'Invalid or expired token' }); }
};

// ── TOURISM — ARRIVALS + ANALYTICS (public) ──
const ARRIVALS_BG_KEY = 'arrivals_backgrounds';

function getArrivalsBackgrounds() {
    return pool.execute('SELECT settings FROM page_settings WHERE page_key = ?', [ARRIVALS_BG_KEY])
        .then(([rows]) => {
            if (rows.length === 0) return { heroBg: null, top5Bg: null };
            let parsed = {};
            try {
                parsed = typeof rows[0].settings === 'string' ? JSON.parse(rows[0].settings) : (rows[0].settings || {});
            } catch (e) { parsed = {}; }
            return {
                heroBg: parsed.heroBg ? `${BASE_URL}/uploads/${parsed.heroBg}` : null,
                top5Bg: parsed.top5Bg ? `${BASE_URL}/uploads/${parsed.top5Bg}` : null
            };
        })
        .catch(() => ({ heroBg: null, top5Bg: null }));
}

// ── HOTEL MANAGEMENT SYSTEM helpers ──
const IMG_BASE = `${BASE_URL}/uploads`;

const parseGalleryField = (str) =>
    str ? String(str).split(',').map(s => s.trim()).filter(Boolean).map(f => `${IMG_BASE}/${f}`) : [];

function mapRoomRow(r) {
    let amenities = []; try { amenities = r.amenities ? JSON.parse(r.amenities) : []; } catch (e) {}
    const gallery = parseGalleryField(r.gallery);
    return {
        id: r.id,
        name: r.room_name || r.room_type,
        type: r.room_type || 'Standard',
        capacity: r.capacity,
        price: Number(r.price_per_night),
        totalCount: r.total_count,
        image: r.image ? `${IMG_BASE}/${r.image}` : (gallery[0] || null),
        gallery,
        description: r.description || '',
        amenities,
        status: r.status,
        createdAt: r.created_at
    };
}

function formatHotel(h, rooms = []) {
    const gallery = parseGalleryField(h.gallery);
    let amenities = []; try { amenities = h.amenities ? JSON.parse(h.amenities) : []; } catch (e) {}
    return {
        id: h.id, name: h.name, location: h.location, type: h.type || '', contact: h.contact || '', email: h.email || '',
        basePrice: Number(h.base_price), rating: Number(h.rating), available: !!h.available,
        image: h.image ? `${IMG_BASE}/${h.image}` : (gallery[0] || null),
        gallery, description: h.description || '', amenities,
        houseRules: h.house_rules || '',
        rooms: rooms.map(mapRoomRow),
        createdAt: h.created_at
    };
}

function processGalleryImages(images) {
    if (!Array.isArray(images)) return { provided: false, filenames: [] };
    const filenames = [];
    for (const img of images) {
        if (!img) continue;
        if (img.startsWith('data:image')) { const fn = saveBase64Image(img); if (fn) filenames.push(fn); }
        else if (img.includes(IMG_BASE)) filenames.push(img.split('/').pop());
    }
    return { provided: true, filenames };
}

function resolveMainImage(input, currentFilename) {
    if (input === undefined) return currentFilename || '';
    if (input === '') return '';
    if (typeof input === 'string' && input.startsWith('data:image')) {
        const fn = saveBase64Image(input);
        return fn || (currentFilename || '');
    }
    if (typeof input === 'string' && input.includes(IMG_BASE)) return input.split('/').pop();
    return currentFilename || '';
}

// ── MESSAGING — citizen ↔ resort owner helpers ──
const MSG_MAX_LEN = 2000;

const mapMessageRow = (m, viewer) => ({
  id: m.id,
  conversationId: m.conversation_id,
  senderType: m.sender_type,
  text: m.body,
  reaction: m.reaction || null,
  type: viewer === 'owner'
    ? (m.sender_type === 'owner' ? 'sent' : 'received')
    : (m.sender_type === 'user' ? 'sent' : 'received'),
  createdAt: m.created_at
});

module.exports = {
    pool,
    fs,
    path,
    bcrypt,
    jwt,
    googleClient,
    emailTransporter,
    BASE_URL,
    FRONTEND_URL,
    JWT_SECRET,
    GOOGLE_CLIENT_ID,
    generateOTP,
    validatePasswordPolicy,
    PASSWORD_MIN_LENGTH,
    PASSWORD_CHANGE_COOLDOWN_DAYS,
    sendOtpEmail,
    saveBase64Image,
    authenticateToken,
    authenticateAdmin,
    authenticateOwner,
    ARRIVALS_BG_KEY,
    getArrivalsBackgrounds,
    IMG_BASE,
    parseGalleryField,
    mapRoomRow,
    formatHotel,
    processGalleryImages,
    resolveMainImage,
    MSG_MAX_LEN,
    mapMessageRow,
};