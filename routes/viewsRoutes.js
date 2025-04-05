const express = require('express');
const router = express.Router();
const IPViewCount = require('../models/Views');

router.get('/view-counts', async(req, res) => {
    const today = new Date().toISOString().split('T')[0];

    try {
        const allIPCounts = await IPViewCount.find();
        let todaysTotalViews = 0;
        let overallTotalViews = 0;

        allIPCounts.forEach(record => {
            todaysTotalViews += record.dailyViews.get(today) || 0;
            overallTotalViews += record.totalViews;
        });

        res.json({
            todaysViewCount: todaysTotalViews,
            totalViews: overallTotalViews,  // sum of all totalViews for each IP
        });
    } catch(error) {
        console.error('Error fetching view counts: ', error);
        res.status(500).json({message: 'Failed to fetch view counts'});
    }
});

module.exports = router;