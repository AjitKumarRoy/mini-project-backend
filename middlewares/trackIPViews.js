const IPViewCount = require('../models/Views');

// Middleware to track daily and total views per IP
const trackIPViews = async (req, res, next) => {
    const ipAddress = req.ip;
    const now = new Date();
    const today = now.toISOString().split('T')[0];  // YYYY-MM-DD

    try {
        const record = await IPViewCount.findOne({ipAddress});

        if (record) {
            record.totalViews += 1;
            record.lastSeen = now;
            record.dailyViews.set(today, (record.dailyViews.get(today) || 0) + 1);
            await record.save();
        } else {
            const newRecord = new IPViewCount({
                ipAddress,
                totalViews: 1,
                firstSeen: now,
                lastSeen: now,
                dailyViews: {[today] : 1},
            });
            await newRecord.save();
        }
    } catch(error) {
        console.error('Error tracking IP views: ', error);
    }

    next();
};

module.exports = trackIPViews;