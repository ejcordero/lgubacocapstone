const express = require('express');
const router = express.Router();
const { pool, BASE_URL, IMG_BASE, saveBase64Image, parseGalleryField, mapRoomRow, formatHotel, processGalleryImages, resolveMainImage, MSG_MAX_LEN, mapMessageRow, authenticateToken, authenticateAdmin } = require('./_shared');

// ==========================================================
// HOTEL MANAGEMENT SYSTEM — SPLIT STORAGE
//   admin_hotels / admin_hotel_rooms  → LGU-managed listings (AdminHotel.vue)
//   hotels / hotel_rooms              → STAYHUB owner listings only
//
// ID NAMESPACE: admin ids start at ADMIN_ID_MIN, so a single hotel_bookings /
// hotel_reviews row can point at either source with one id column. Any id
// >= ADMIN_ID_MIN resolves to the admin_* tables.
// ⚠ NEVER lower admin_hotels' AUTO_INCREMENT below ADMIN_ID_MIN.
// ==========================================================

const ADMIN_ID_MIN = 100000;
const isAdminId = (v) => Number(v) >= ADMIN_ID_MIN;
// Table pickers — only ever called with parseInt()-validated ids (injection-safe)
const hotelTable = (id) => (isAdminId(id) ? 'admin_hotels' : 'hotels');
const roomTable = (id) => (isAdminId(id) ? 'admin_hotel_rooms' : 'hotel_rooms');

// ── ADMIN: LGU-owned hotels (admin_hotels / admin_hotel_rooms) ──

router.get('/hotels/admin', authenticateAdmin, async (req, res, next) => {
    try {
        const [hotels] = await pool.execute('SELECT * FROM admin_hotels ORDER BY created_at DESC');
        const [rooms] = await pool.execute('SELECT * FROM admin_hotel_rooms ORDER BY price_per_night ASC');
        const roomsByHotel = {}; rooms.forEach(r => { if (!roomsByHotel[r.hotel_id]) roomsByHotel[r.hotel_id] = []; roomsByHotel[r.hotel_id].push(r); });
        res.json(hotels.map(h => formatHotel(h, roomsByHotel[h.id] || [])));
    } catch (err) { next(err); }
});

// LGU oversight: bookings for LGU hotels only (owner bookings live in the owner portal)
router.get('/hotels/admin/bookings', authenticateAdmin, async (req, res, next) => {
    try {
        const [bookings] = await pool.execute(`
            SELECT hb.*,
                   COALESCE(hr.room_name, hr.room_type, ahr.room_name, ahr.room_type) as room_type,
                   COALESCE(h.name, ah.name) as hotel_name,
                   COALESCE(h.image, ah.image) as hotel_image,
                   CONCAT(tu.first_name, ' ', tu.last_name) as registered_name, tu.email as user_email
            FROM hotel_bookings hb
            LEFT JOIN hotel_rooms hr ON hb.room_id = hr.id
            LEFT JOIN admin_hotel_rooms ahr ON hb.room_id = ahr.id
            LEFT JOIN hotels h ON hb.hotel_id = h.id
            LEFT JOIN admin_hotels ah ON hb.hotel_id = ah.id
            LEFT JOIN tourism_users tu ON hb.user_id = tu.id
            WHERE hb.hotel_id >= ?
            ORDER BY hb.created_at DESC`, [ADMIN_ID_MIN]);
        res.json(bookings.map(b => ({ ...b, total_amount: Number(b.total_amount), price_per_night: Number(b.price_per_night), hotelImage: b.hotel_image ? `${IMG_BASE}/${b.hotel_image}` : null })));
    } catch (err) { next(err); }
});

router.put('/hotels/admin/bookings/:id/status', authenticateAdmin, async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show'].includes(status)) return res.status(400).json({ message: 'Invalid status.' });
        const [existing] = await pool.execute('SELECT * FROM hotel_bookings WHERE id = ?', [req.params.id]);
        if (existing.length === 0) return res.status(404).json({ message: 'Booking not found.' });
        await pool.execute('UPDATE hotel_bookings SET status = ? WHERE id = ?', [status, req.params.id]);
        res.json({ message: 'Booking status updated.' });
    } catch (err) { next(err); }
});

router.get('/hotels/admin/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const [hotels] = await pool.execute('SELECT * FROM admin_hotels WHERE id = ?', [req.params.id]);
        if (hotels.length === 0) return res.status(404).json({ message: 'Hotel not found' });
        const [rooms] = await pool.execute('SELECT * FROM admin_hotel_rooms WHERE hotel_id = ? ORDER BY price_per_night ASC', [req.params.id]);
        res.json(formatHotel(hotels[0], rooms));
    } catch (err) { next(err); }
});

router.post('/hotels/admin', authenticateAdmin, async (req, res, next) => {
    try {
        const { name, location, type, contact, email, description, amenities, basePrice, mainImage, galleryImages, houseRules, available } = req.body;
        let imageFilename = resolveMainImage(mainImage, '');
        const gal = processGalleryImages(galleryImages);
        if (!imageFilename && gal.filenames.length) imageFilename = gal.filenames[0];
        const [result] = await pool.execute(
            'INSERT INTO admin_hotels (name, location, type, contact, email, base_price, available, image, description, amenities, gallery, house_rules) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [name, location || '', type || '', contact || '', email || '', basePrice || 0, available !== false ? 1 : 0, imageFilename, description || '', JSON.stringify(amenities || []), gal.filenames.join(','), houseRules || null]
        );
        const [newHotel] = await pool.execute('SELECT * FROM admin_hotels WHERE id = ?', [result.insertId]);
        res.status(201).json(formatHotel(newHotel[0], []));
    } catch (err) { next(err); }
});

router.put('/hotels/admin/:id', authenticateAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        const [current] = await pool.execute('SELECT * FROM admin_hotels WHERE id = ?', [id]);
        if (current.length === 0) return res.status(404).json({ message: 'Hotel not found.' });
        const c = current[0];
        const { name, location, type, contact, email, description, amenities, basePrice, mainImage, galleryImages, houseRules, available } = req.body;

        const imageFilename = resolveMainImage(mainImage, c.image);
        const gal = processGalleryImages(galleryImages);
        const galleryString = gal.provided ? gal.filenames.join(',') : (c.gallery || '');

        await pool.execute(
            'UPDATE admin_hotels SET name=?, location=?, type=?, contact=?, email=?, base_price=?, available=?, image=?, description=?, amenities=?, gallery=?, house_rules=? WHERE id=?',
            [
                name || c.name,
                location !== undefined ? location : c.location,
                type || c.type,
                contact !== undefined ? contact : c.contact,
                email !== undefined ? email : c.email,
                basePrice !== undefined ? basePrice : c.base_price,
                available !== undefined ? (available ? 1 : 0) : c.available,
                imageFilename,
                description !== undefined ? description : c.description,
                amenities !== undefined ? JSON.stringify(amenities) : c.amenities,
                galleryString,
                houseRules !== undefined ? (houseRules || null) : c.house_rules,
                id
            ]
        );
        res.json({ message: 'Hotel updated successfully' });
    } catch (err) { next(err); }
});

router.delete('/hotels/admin/:id', authenticateAdmin, async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
        const [current] = await conn.execute('SELECT id FROM admin_hotels WHERE id = ?', [req.params.id]);
        if (current.length === 0) return res.status(404).json({ message: 'Hotel not found.' });
        const [bookings] = await conn.execute('SELECT COUNT(*) as cnt FROM hotel_bookings WHERE hotel_id = ? AND status = "confirmed"', [req.params.id]);
        if (bookings[0].cnt > 0) return res.status(400).json({ message: `Cannot delete — ${bookings[0].cnt} active booking(s) exist.` });
        await conn.beginTransaction();
        await conn.execute('DELETE FROM hotel_bookings WHERE hotel_id = ?', [req.params.id]);
        await conn.execute('DELETE FROM admin_hotel_rooms WHERE hotel_id = ?', [req.params.id]);
        await conn.execute('DELETE FROM admin_hotels WHERE id = ?', [req.params.id]);
        await conn.commit();
        res.json({ message: 'Hotel deleted successfully' });
    } catch (err) {
        try { await conn.rollback(); } catch (e) {}
        next(err);
    } finally { conn.release(); }
});

router.post('/hotels/admin/:hotelId/rooms', authenticateAdmin, async (req, res, next) => {
    try {
        const [hotel] = await pool.execute('SELECT id FROM admin_hotels WHERE id = ?', [req.params.hotelId]);
        if (hotel.length === 0) return res.status(404).json({ message: 'Hotel not found.' });

        const { roomName, roomType, capacity, pricePerNight, totalCount, image, galleryImages, description, amenities, status } = req.body;
        const type = (roomType || 'Standard').trim();
        const name = (roomName && roomName.trim()) || type;

        let imageFilename = resolveMainImage(image, '');
        const gal = processGalleryImages(galleryImages);
        if (!imageFilename && gal.filenames.length) imageFilename = gal.filenames[0];

        const [result] = await pool.execute(
            'INSERT INTO admin_hotel_rooms (hotel_id, room_name, room_type, capacity, price_per_night, total_count, image, gallery, description, amenities, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [req.params.hotelId, name, type, capacity || 2, pricePerNight, totalCount || 1, imageFilename, gal.filenames.join(','), description || '', JSON.stringify(amenities || []), status || 'active']
        );
        const [newRoom] = await pool.execute('SELECT * FROM admin_hotel_rooms WHERE id = ?', [result.insertId]);
        res.status(201).json(mapRoomRow(newRoom[0]));
    } catch (err) { next(err); }
});

router.put('/hotels/admin/rooms/:roomId', authenticateAdmin, async (req, res, next) => {
    try {
        const [current] = await pool.execute('SELECT * FROM admin_hotel_rooms WHERE id = ?', [req.params.roomId]);
        if (current.length === 0) return res.status(404).json({ message: 'Room not found.' });
        const c = current[0];
        const { roomName, roomType, capacity, pricePerNight, totalCount, image, galleryImages, description, amenities, status } = req.body;

        let imageFilename = resolveMainImage(image, c.image);
        const gal = processGalleryImages(galleryImages);
        let galleryString;
        if (gal.provided) {
            galleryString = gal.filenames.join(',');
            if (!imageFilename && gal.filenames.length) imageFilename = gal.filenames[0];
        } else {
            galleryString = c.gallery || '';
        }

        await pool.execute(
            'UPDATE admin_hotel_rooms SET room_name=?, room_type=?, capacity=?, price_per_night=?, total_count=?, image=?, gallery=?, description=?, amenities=?, status=? WHERE id=?',
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
                req.params.roomId
            ]
        );
        const [updated] = await pool.execute('SELECT * FROM admin_hotel_rooms WHERE id = ?', [req.params.roomId]);
        res.json({ message: 'Room updated successfully', room: mapRoomRow(updated[0]) });
    } catch (err) { next(err); }
});

router.delete('/hotels/admin/rooms/:roomId', authenticateAdmin, async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
        const [current] = await conn.execute('SELECT id FROM admin_hotel_rooms WHERE id = ?', [req.params.roomId]);
        if (current.length === 0) return res.status(404).json({ message: 'Room not found.' });
        const [bookings] = await conn.execute('SELECT COUNT(*) as cnt FROM hotel_bookings WHERE room_id = ? AND status = "confirmed"', [req.params.roomId]);
        if (bookings[0].cnt > 0) return res.status(400).json({ message: `Cannot delete — ${bookings[0].cnt} active booking(s) exist. Set the room to Inactive instead.` });
        await conn.beginTransaction();
        await conn.execute('DELETE FROM hotel_bookings WHERE room_id = ?', [req.params.roomId]);
        await conn.execute('DELETE FROM admin_hotel_rooms WHERE id = ?', [req.params.roomId]);
        await conn.commit();
        res.json({ message: 'Room deleted successfully' });
    } catch (err) {
        try { await conn.rollback(); } catch (e) {}
        next(err);
    } finally { conn.release(); }
});

// ── PUBLIC: HOTELS (merged — LGU admin hotels + owner resorts) ──
// Same response shape as before, so the public pages need no changes.
// Owner hotels carry ids < 100000; LGU hotels carry ids >= 100000.

router.get('/hotels/public', async (req, res, next) => {
    try {
        const [ownerHotels] = await pool.execute('SELECT * FROM hotels WHERE available = 1 ORDER BY created_at DESC');
        const [adminHotels] = await pool.execute('SELECT * FROM admin_hotels WHERE available = 1 ORDER BY created_at DESC');
        const [ownerRooms] = await pool.execute('SELECT * FROM hotel_rooms WHERE status = "active" ORDER BY price_per_night ASC');
        const [adminRooms] = await pool.execute('SELECT * FROM admin_hotel_rooms WHERE status = "active" ORDER BY price_per_night ASC');
        const [fees] = await pool.execute('SELECT * FROM entrance_fees WHERE status = "active" ORDER BY price ASC');
        // Review aggregates — one grouped query; admin ids (100000+) never collide with owner ids
        const [ratings] = await pool.execute('SELECT hotel_id, ROUND(AVG(rating),1) as avg_rating, COUNT(*) as review_count FROM hotel_reviews GROUP BY hotel_id');

        const roomsByHotel = {};
        ownerRooms.forEach(r => { if (!roomsByHotel[r.hotel_id]) roomsByHotel[r.hotel_id] = []; roomsByHotel[r.hotel_id].push(r); });
        adminRooms.forEach(r => { if (!roomsByHotel[r.hotel_id]) roomsByHotel[r.hotel_id] = []; roomsByHotel[r.hotel_id].push(r); });
        const feesByHotel = {}; fees.forEach(f => { if (!feesByHotel[f.hotel_id]) feesByHotel[f.hotel_id] = []; feesByHotel[f.hotel_id].push(f); });

        const all = [...ownerHotels, ...adminHotels].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json(all.map(h => {
            const f = formatHotel(h, roomsByHotel[h.id] || []);
            if (f.gallery.length === 0 && f.image) f.gallery = [f.image];
            const hf = feesByHotel[h.id] || [];
            f.entranceFees = hf.map(x => ({ id: x.id, name: x.name, price: Number(x.price), description: x.description || '' }));
            f.hasRooms = f.rooms.length > 0;
            f.minEntrancePrice = hf.length ? Math.min(...hf.map(x => Number(x.price))) : null;
            f.dailyCapacity = h.daily_capacity;
            f.isLGUListing = isAdminId(h.id);
            const rt = ratings.find(x => x.hotel_id === h.id);
            f.avgRating = rt ? Number(rt.avg_rating) : null;
            f.reviewCount = rt ? rt.review_count : 0;
            return f;
        }));
    } catch (err) { next(err); }
});

router.get('/hotels/public/:id', async (req, res, next) => {
    try {
        const id = parseInt(req.params.id);
        if (!Number.isFinite(id)) return res.status(404).json({ message: 'Hotel not found' });
        const t = hotelTable(id);
        const [hotels] = await pool.execute(`SELECT * FROM ${t} WHERE id = ? AND available = 1`, [id]);
        if (hotels.length === 0) return res.status(404).json({ message: 'Hotel not found' });
        const [rooms] = await pool.execute(`SELECT * FROM ${roomTable(id)} WHERE hotel_id = ? AND status = "active" ORDER BY price_per_night ASC`, [id]);
        const [fees] = await pool.execute('SELECT * FROM entrance_fees WHERE hotel_id = ? AND status = "active" ORDER BY price ASC', [id]);
        const [ratings] = await pool.execute('SELECT ROUND(AVG(rating),1) as avg_rating, COUNT(*) as review_count FROM hotel_reviews WHERE hotel_id = ?', [id]);
        const f = formatHotel(hotels[0], rooms);
        if (f.gallery.length === 0 && f.image) f.gallery = [f.image];
        f.entranceFees = fees.map(x => ({ id: x.id, name: x.name, price: Number(x.price), description: x.description || '' }));
        f.minEntrancePrice = fees.length ? Math.min(...fees.map(x => Number(x.price))) : null;
        f.hasRooms = f.rooms.length > 0;
        f.dailyCapacity = hotels[0].daily_capacity;
        f.isLGUListing = isAdminId(id);
        f.avgRating = ratings[0]?.avg_rating != null ? Number(ratings[0].avg_rating) : null;
        f.reviewCount = ratings[0]?.review_count || 0;
        res.json(f);
    } catch (err) { next(err); }
});

router.post('/hotels/check-availability', async (req, res, next) => {
    try {
        const { roomId, checkIn, checkOut } = req.body;
        const rid = parseInt(roomId);
        if (!rid || !checkIn || !checkOut) return res.status(400).json({ message: 'Missing parameters.' });
        const [room] = await pool.execute(`SELECT total_count FROM ${roomTable(rid)} WHERE id = ?`, [rid]);
        if (room.length === 0) return res.status(404).json({ message: 'Room not found.' });
        const [bookings] = await pool.execute('SELECT COUNT(*) as booked FROM hotel_bookings WHERE room_id = ? AND status IN ("confirmed") AND check_in < ? AND check_out > ?', [rid, checkOut, checkIn]);
        const available = room[0].total_count - bookings[0].booked;
        res.json({ available: Math.max(0, available), total: room[0].total_count, booked: bookings[0].booked });
    } catch (err) { next(err); }
});

// ── Unified booking: 'entrance' (Entrance Only) or 'accommodation' (Entrance + Accommodation) ──
router.post('/hotels/book', authenticateToken, async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
        const {
            hotelId, bookingType, entranceFeeId, roomId,
            guestName, guestEmail, guestContact, guestIdType,
            visitDate, checkIn, checkOut,
            adults, children, specialRequests, paymentMethod
        } = req.body;

        const hid = parseInt(hotelId);
        if (!hid || !guestName || !guestEmail || !guestContact) {
            return res.status(400).json({ message: 'All required fields must be provided.' });
        }
        if (!['entrance', 'accommodation'].includes(bookingType)) {
            return res.status(400).json({ message: 'Invalid booking type.' });
        }

        const pax = Math.max(1, (parseInt(adults) || 1) + (parseInt(children) || 0));
        const hTable = hotelTable(hid);

        await conn.beginTransaction();

        // Hotel must exist and be published — resolved from either source table
        const [hotels] = await conn.execute(`SELECT * FROM ${hTable} WHERE id = ? AND available = 1`, [hid]);
        if (hotels.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: 'Resort not found or not available.' });
        }
        const hotel = hotels[0];

        // ════ ENTRANCE component ════
        let fee = null;
        if (entranceFeeId) {
            const [fees] = await conn.execute(
                'SELECT * FROM entrance_fees WHERE id = ? AND hotel_id = ? AND status = "active"',
                [entranceFeeId, hid]
            );
            if (fees.length === 0) {
                await conn.rollback();
                return res.status(400).json({ message: 'Selected entrance fee is not available.' });
            }
            fee = fees[0];
        } else if (bookingType === 'entrance') {
            await conn.rollback();
            return res.status(400).json({ message: 'Please select an entrance fee type.' });
        }

        // Visit day: entrance-only → visitDate; combined → check-in day
        const visitDay = bookingType === 'entrance' ? visitDate : checkIn;
        if (!visitDay) {
            await conn.rollback();
            return res.status(400).json({
                message: bookingType === 'entrance' ? 'Please select your visit date.' : 'Please select check-in and check-out dates.'
            });
        }

        // Date validation (local-time safe)
        const todayLocal = new Date();
        todayLocal.setHours(0, 0, 0, 0);
        if (new Date(visitDay + 'T00:00:00') < todayLocal) {
            await conn.rollback();
            return res.status(400).json({ message: 'Visit date cannot be in the past.' });
        }

        // Daily visitor capacity (enforced only if daily_capacity is set)
        if (hotel.daily_capacity) {
            const [dayTotal] = await conn.execute(
                `SELECT COALESCE(SUM(pax), 0) as cnt FROM hotel_bookings
                 WHERE hotel_id = ? AND status IN ('confirmed') AND check_in = ?`,
                [hid, visitDay]
            );
            if (dayTotal[0].cnt + pax > hotel.daily_capacity) {
                await conn.rollback();
                return res.status(400).json({ message: `Daily visitor capacity reached for ${visitDay}. Please choose another date.` });
            }
        }

        let nights = 0;
        let roomDbId = null;
        let roomName = null;
        let roomCapacity = null;
        let roomPrice = 0;
        let totalAmount = fee ? Number(fee.price) * pax : 0;   // entrance portion

        // ════ ACCOMMODATION component ════
        if (bookingType === 'accommodation') {
            const rid = parseInt(roomId);
            if (!rid) {
                await conn.rollback();
                return res.status(400).json({ message: 'Please choose a room type.' });
            }
            if (!checkOut) {
                await conn.rollback();
                return res.status(400).json({ message: 'Please select check-out date.' });
            }
            if (new Date(checkOut) <= new Date(checkIn)) {
                await conn.rollback();
                return res.status(400).json({ message: 'Check-out must be after check-in.' });
            }
            nights = Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);

            const rTable = roomTable(rid);
            const [room] = await conn.execute(
                `SELECT * FROM ${rTable} WHERE id = ? AND hotel_id = ? AND status = "active" FOR UPDATE`,
                [rid, hid]
            );
            if (room.length === 0) {
                await conn.rollback();
                return res.status(400).json({ message: 'Room not found or unavailable.' });
            }

            const [booked] = await conn.execute(
                `SELECT COUNT(*) as cnt FROM hotel_bookings
                 WHERE room_id = ? AND status IN ('confirmed') AND check_in < ? AND check_out > ?`,
                [rid, checkOut, checkIn]
            );
            if (booked[0].cnt >= room[0].total_count) {
                await conn.rollback();
                return res.status(400).json({ message: 'This room is fully booked for the selected dates.' });
            }

            roomDbId = room[0].id;
            roomName = room[0].room_name || room[0].room_type;
            roomCapacity = room[0].capacity;
            roomPrice = Number(room[0].price_per_night);
            totalAmount += roomPrice * nights;
        }
        const pricePerNight = bookingType === 'accommodation' ? roomPrice : (fee ? Number(fee.price) : 0);
        const checkOutFinal = bookingType === 'accommodation' ? checkOut : visitDay;

        // Collision-resistant booking reference
        const bookingRef = 'BCO-' + Date.now().toString(36).toUpperCase() + '-' +
                           Math.random().toString(36).slice(2, 6).toUpperCase();

        const [result] = await conn.execute(
            `INSERT INTO hotel_bookings
             (booking_ref, booking_type, hotel_id, room_id, entrance_fee_id, user_id,
              guest_name, guest_email, guest_contact, guest_id_type,
              check_in, check_out, adults, children, nights, pax,
              price_per_night, total_amount, special_requests, payment_method, payment_status)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'unpaid')`,
            [bookingRef, bookingType, hid, roomDbId, fee ? fee.id : null, req.user.id,
             guestName, guestEmail, guestContact, guestIdType || null,
             visitDay, checkOutFinal, parseInt(adults) || 1, parseInt(children) || 0, nights, pax,
             pricePerNight, totalAmount, specialRequests || null, paymentMethod || 'on_arrival']
        );
        await conn.commit();

        res.status(201).json({
            id: bookingRef, dbId: result.insertId,
            bookingType, pax,
            hotel: { id: hotel.id, name: hotel.name, image: hotel.image ? `${IMG_BASE}/${hotel.image}` : null },
            room: roomDbId ? { id: roomDbId, name: roomName, capacity: roomCapacity, price: roomPrice } : null,
            entranceFee: fee ? { id: fee.id, name: fee.name, pricePerHead: Number(fee.price) } : null,
            details: { fullName: guestName, email: guestEmail, contact: guestContact, checkIn: visitDay, checkOut: checkOutFinal, adults: parseInt(adults) || 1, children: parseInt(children) || 0 },
            totalPrice: totalAmount, nights, status: 'pending', paymentStatus: 'unpaid', createdAt: new Date()
        });
    } catch (err) {
        try { await conn.rollback(); } catch (e) {}
        next(err);
    } finally { conn.release(); }
});

router.get('/hotels/my-bookings', authenticateToken, async (req, res, next) => {
    try {
        const [bookings] = await pool.execute(
            `SELECT hb.*,
                    COALESCE(hr.room_name, hr.room_type) as room_type, hr.capacity,
                    COALESCE(ahr.room_name, ahr.room_type) as admin_room_type, ahr.capacity as admin_room_capacity,
                    ef.name as entrance_fee_name, ef.price as entrance_fee_price,
                    COALESCE(h.name, ah.name) as hotel_name,
                    COALESCE(h.image, ah.image) as hotel_image,
                    rv.id as review_id
             FROM hotel_bookings hb
             LEFT JOIN hotel_rooms hr ON hb.room_id = hr.id
             LEFT JOIN admin_hotel_rooms ahr ON hb.room_id = ahr.id
             LEFT JOIN hotels h ON hb.hotel_id = h.id
             LEFT JOIN admin_hotels ah ON hb.hotel_id = ah.id
             LEFT JOIN entrance_fees ef ON hb.entrance_fee_id = ef.id
             LEFT JOIN hotel_reviews rv ON rv.booking_id = hb.id
             WHERE hb.user_id = ? ORDER BY hb.created_at DESC`,
            [req.user.id]
        );
        res.json(bookings.map(b => ({
            id: b.booking_ref, dbId: b.id,
            bookingType: b.booking_type || 'accommodation',
            pax: b.pax || b.adults || 1,
            hotel: { id: b.hotel_id, name: b.hotel_name, image: b.hotel_image ? `${IMG_BASE}/${b.hotel_image}` : null },
            room: b.room_id ? { id: b.room_id, name: b.room_type || b.admin_room_type, capacity: b.capacity ?? b.admin_room_capacity, price: Number(b.price_per_night) } : null,
            entranceFee: b.entrance_fee_id ? { id: b.entrance_fee_id, name: b.entrance_fee_name, pricePerHead: Number(b.entrance_fee_price) } : null,
            details: { fullName: b.guest_name, email: b.guest_email, contact: b.guest_contact, checkIn: b.check_in, checkOut: b.check_out, adults: b.adults, children: b.children },
            totalPrice: Number(b.total_amount), nights: b.nights,
            status: b.status, paymentStatus: b.payment_status, createdAt: b.created_at,
            hasReview: !!b.review_id
        })));
    } catch (err) { next(err); }
});

// ── Citizen: cancel own booking (pending or confirmed only) ──
router.put('/hotels/bookings/:ref/cancel', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM hotel_bookings WHERE booking_ref = ? AND user_id = ?',
            [req.params.ref, req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
        const b = rows[0];
        if (!['pending', 'confirmed'].includes(b.status)) {
            return res.status(400).json({ message: `A "${b.status}" booking can no longer be cancelled. Contact the resort for assistance.` });
        }
        await pool.execute("UPDATE hotel_bookings SET status = 'cancelled' WHERE id = ?", [b.id]);
        res.json({ message: `Booking ${b.booking_ref} has been cancelled.` });
    } catch (e) { res.status(500).json({ message: 'Failed to cancel booking.' }); }
});

// ── Citizen: post a review for a COMPLETED booking ──
router.post('/hotels/bookings/:ref/review', authenticateToken, async (req, res) => {
    try {
        const { rating, title, content } = req.body;
        const r = parseInt(rating);
        if (!r || r < 1 || r > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
        const body = (content || '').trim();
        if (body.length < 10) return res.status(400).json({ message: 'Please write at least 10 characters about your stay.' });
        if (body.length > 2000) return res.status(400).json({ message: 'Review is too long (max 2000 characters).' });
        const t = (title || '').trim();
        if (t.length > 150) return res.status(400).json({ message: 'Title is too long (max 150 characters).' });

        const [rows] = await pool.execute(
            'SELECT * FROM hotel_bookings WHERE booking_ref = ? AND user_id = ?',
            [req.params.ref, req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Booking not found.' });
        const b = rows[0];
        if (b.status !== 'completed') return res.status(400).json({ message: 'You can only review stays that have been completed.' });

        const [dup] = await pool.execute('SELECT id FROM hotel_reviews WHERE booking_id = ?', [b.id]);
        if (dup.length > 0) return res.status(409).json({ message: 'You have already reviewed this booking.' });

        // hotel_id carries the namespaced id — works for LGU (>=100000) and owner (<100000) listings
        const [result] = await pool.execute(
            'INSERT INTO hotel_reviews (booking_id, hotel_id, user_id, rating, title, content) VALUES (?, ?, ?, ?, ?, ?)',
            [b.id, b.hotel_id, req.user.id, r, t || null, body]
        );
        res.status(201).json({ message: 'Thank you! Your review has been posted.', reviewId: result.insertId });
    } catch (e) { res.status(500).json({ message: 'Failed to post review.' }); }
});

// ── Citizen: my written reviews ──
router.get('/hotels/my-reviews', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT rv.id, rv.booking_id, rv.rating, rv.title, rv.content, rv.created_at, rv.updated_at, rv.edited_at,
                    hb.booking_ref, COALESCE(h.name, ah.name) as hotel_name,
                    COALESCE(h.image, ah.image) as hotel_image
             FROM hotel_reviews rv
             LEFT JOIN hotels h ON rv.hotel_id = h.id
             LEFT JOIN admin_hotels ah ON rv.hotel_id = ah.id
             JOIN hotel_bookings hb ON rv.booking_id = hb.id
             WHERE rv.user_id = ?
             ORDER BY rv.created_at DESC`,
            [req.user.id]
        );
        res.json(rows.map(r => ({ ...r, hotelImage: r.hotel_image ? `${IMG_BASE}/${r.hotel_image}` : null })));
    } catch (e) { res.status(500).json({ message: 'Failed to fetch reviews.' }); }
});

// ── Citizen: edit own review (ONCE only) ──
router.put('/hotels/reviews/:id', authenticateToken, async (req, res) => {
    try {
        const { rating, title, content } = req.body;
        const r = parseInt(rating);
        if (!r || r < 1 || r > 5) return res.status(400).json({ message: 'Rating must be between 1 and 5.' });
        const body = (content || '').trim();
        if (body.length < 10) return res.status(400).json({ message: 'Please write at least 10 characters about your stay.' });
        if (body.length > 2000) return res.status(400).json({ message: 'Review is too long (max 2000 characters).' });
        const t = (title || '').trim();
        if (t.length > 150) return res.status(400).json({ message: 'Title is too long (max 150 characters).' });

        const [rows] = await pool.execute(
            'SELECT id, edited_at FROM hotel_reviews WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        if (rows.length === 0) return res.status(404).json({ message: 'Review not found.' });

        // ⛔ One-time edit rule — server is authoritative
        if (rows[0].edited_at) {
            return res.status(403).json({ message: 'Each review can only be edited once.' });
        }

        await pool.execute(
            'UPDATE hotel_reviews SET rating = ?, title = ?, content = ?, edited_at = NOW() WHERE id = ?',
            [r, t || null, body, req.params.id]
        );
        res.json({ message: 'Review updated. Note: reviews can only be edited once.' });
    } catch (e) { res.status(500).json({ message: 'Failed to update review.' }); }
});

// ── Citizen: delete own review ──
router.delete('/hotels/reviews/:id', authenticateToken, async (req, res) => {
    try {
        const [result] = await pool.execute('DELETE FROM hotel_reviews WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (result.affectedRows === 0) return res.status(404).json({ message: 'Review not found.' });
        res.json({ message: 'Review deleted.' });
    } catch (e) { res.status(500).json({ message: 'Failed to delete review.' }); }
});

// ── Public: reviews for a hotel (works for both sources via the shared hotel_id) ──
router.get('/hotels/:id/reviews', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            `SELECT rv.id, rv.rating, rv.title, rv.content, rv.created_at,
                    TRIM(CONCAT(tu.first_name, ' ', tu.last_name)) as reviewer_name
             FROM hotel_reviews rv
             LEFT JOIN tourism_users tu ON rv.user_id = tu.id
             WHERE rv.hotel_id = ?
             ORDER BY rv.created_at DESC LIMIT 100`,
            [req.params.id]
        );
        res.json(rows);
    } catch (e) { res.status(500).json({ message: 'Failed to fetch reviews.' }); }
});

// ── Citizen ↔ Resort chat — owner resorts only (unchanged; admin hotels 404 here) ──
router.get('/hotels/:id/messages', authenticateToken, async (req, res) => {
  try {
    const [hotels] = await pool.execute('SELECT id, name FROM hotels WHERE id = ?', [req.params.id]);
    if (hotels.length === 0) return res.status(404).json({ message: 'Resort not found.' });

    const [convs] = await pool.execute(
      'SELECT * FROM conversations WHERE hotel_id = ? AND user_id = ? LIMIT 1', [req.params.id, req.user.id]
    );
    if (convs.length === 0) return res.json({ conversation: null, unread: 0, messages: [] });

    const conv = convs[0];
    const [msgs] = await pool.execute(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500', [conv.id]
    );
    const unread = msgs.filter(m =>
      m.sender_type === 'owner' &&
      (!conv.user_read_at || new Date(m.created_at) > new Date(conv.user_read_at))
    ).length;
    await pool.execute('UPDATE conversations SET user_read_at = NOW() WHERE id = ?', [conv.id]);

    res.json({
      conversation: { id: conv.id, hotelId: conv.hotel_id },
      unread,
      messages: msgs.map(m => mapMessageRow(m, 'user'))
    });
  } catch (e) {
    console.error('Resort thread error:', e.message);
    res.status(500).json({ message: 'Failed to load conversation.' });
  }
});

router.post('/hotels/:id/messages', authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ message: 'Message cannot be empty.' });
    if (body.length > MSG_MAX_LEN) return res.status(400).json({ message: `Message is too long (max ${MSG_MAX_LEN} characters).` });

    const [hotels] = await conn.execute('SELECT id FROM hotels WHERE id = ?', [req.params.id]);
    if (hotels.length === 0) return res.status(404).json({ message: 'Resort not found.' });

    await conn.beginTransaction();
    const [existing] = await conn.execute(
      'SELECT id FROM conversations WHERE hotel_id = ? AND user_id = ? LIMIT 1 FOR UPDATE',
      [req.params.id, req.user.id]
    );
    let convId;
    if (existing.length > 0) {
      convId = existing[0].id;
    } else {
      const [ins] = await conn.execute(
        'INSERT INTO conversations (hotel_id, user_id, user_read_at) VALUES (?, ?, NOW())',
        [req.params.id, req.user.id]
      );
      convId = ins.insertId;
    }
    await conn.execute(
      "INSERT INTO messages (conversation_id, sender_type, sender_id, body) VALUES (?, 'user', ?, ?)",
      [convId, req.user.id, body]
    );
    await conn.execute('UPDATE conversations SET user_read_at = NOW() WHERE id = ?', [convId]);
    await conn.commit();

    const [msgs] = await pool.execute(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 500', [convId]
    );
    res.status(201).json({
      conversation: { id: convId, hotelId: Number(req.params.id) },
      messages: msgs.map(m => mapMessageRow(m, 'user'))
    });
  } catch (e) {
    try { await conn.rollback(); } catch (e2) {}
    console.error('Resort send error:', e.message);
    res.status(500).json({ message: 'Failed to send message.' });
  } finally { conn.release(); }
});

module.exports = router;