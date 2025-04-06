const IPViewCount = require('../models/Views');

// Middleware to track daily and total views per IP
const trackIPViews = async (req, res, next) => {
    const ipAddress = req.ip;

    const userName = req.user ? req.user.name : null; // Assuming user info is in req.user after authentication

    const now = new Date();
    const today = now.toISOString().split('T')[0];  // YYYY-MM-DD

    try {
        const record = await IPViewCount.findOne({ipAddress});

        if (record) {
            record.totalViews += 1;
            record.lastSeen = now;
            record.dailyViews.set(today, (record.dailyViews.get(today) || 0) + 1);
            // Optionally update userName if it's available and different
            if (userName && record.userName !== userName) {
                record.userName = userName;
            }
            await record.save();
        } else {
            const newRecord = new IPViewCount({
                ipAddress,
                userName, // Add the user name when creating a new record
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