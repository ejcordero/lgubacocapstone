const express = require('express');
const router = express.Router();

const BACO_LAT = 13.35;
const BACO_LNG = 121.10;
let weatherCache = { data: null, fetchedAt: 0 };
const WEATHER_TTL = 10 * 60 * 1000; // 10 minutes

router.get('/weather', async (req, res) => {
    try {
        const lat = req.query.lat ? parseFloat(req.query.lat) : BACO_LAT;
        const lng = req.query.lng ? parseFloat(req.query.lng) : BACO_LNG;

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        // Serve cached copy (default Baco coords) within TTL
        const isDefault = lat === BACO_LAT && lng === BACO_LNG;
        if (isDefault && weatherCache.data && Date.now() - weatherCache.fetchedAt < WEATHER_TTL) {
            return res.json(weatherCache.data);
        }

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
            `&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m` +
            `&hourly=precipitation_probability,temperature_2m` +
            `&forecast_hours=12` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,` +
            `precipitation_probability_max,precipitation_sum,precipitation_hours,` +
            `wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,` +
            `uv_index_max,sunrise,sunset` +
            `&timezone=Asia%2FManila&forecast_days=7`;

        const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!response.ok) {
            throw new Error(`Open-Meteo responded ${response.status}`);
        }
        const data = await response.json();

        const payload = {
            location: { name: 'Baco, Oriental Mindoro', lat, lng },
            timezone: data.timezone,
            current: data.current,
            hourly: data.hourly,
            daily: data.daily,
            units: { ...data.current_units, ...data.daily_units },
            updatedAt: new Date().toISOString(),
        };

        if (isDefault) {
            weatherCache = { data: payload, fetchedAt: Date.now() };
        }

        res.json(payload);
    } catch (err) {
        // Fall back to cache if it exists, otherwise report the error
        if (weatherCache.data) return res.json({ ...weatherCache.data, stale: true });
        res.status(502).json({ error: 'Weather service unavailable', message: err.message });
    }
});

module.exports = router;