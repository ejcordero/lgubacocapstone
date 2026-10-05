const express = require('express');
const router = express.Router();

// ──────────────────────────────────────────────────────────────
// Thin aggregator — the original 5,583-line monolith was split
// into focused modules under routes/. Everything is mounted here
// in an order that preserves registration semantics.
// ──────────────────────────────────────────────────────────────

router.use(require('./authRoutes'));        // citizen/auth
router.use(require('./weatherRoutes'));     // open-meteo weather
router.use(require('./tourismRoutes'));     // tourism guest routes
router.use(require('./userRoutes'));        // user stats/chat
router.use(require('./talaRoutes'));        // TALA blockchain/IPFS/Polygon
router.use(require('./barangayRoutes'));    // barangays
router.use(require('./municipalityRoutes'));// municipality content
router.use(require('./mhoRoutes'));         // MHO services + reorder
router.use(require('./historyRoutes'));     // Baco history + reorder
router.use(require('./officialsRoutes'));   // municipal officials
router.use(require('./schoolsRoutes'));     // schools
router.use(require('./healthRoutes'));      // health services
router.use(require('./newsRoutes'));        // news
router.use(require('./halconRoutes'));      // Halcon permits/admin
router.use(require('./hotelRoutes'));       // hotel listings/booking/chat
router.use(require('./messageRoutes'));     // guest-side conversations
router.use(require('./adminRoutes'));       // admin portal
router.use(require('./ownerRoutes'));       // STAYHUB owner portal
router.use(require('./officeRoutes'));      // LGU offices directory

module.exports = router;