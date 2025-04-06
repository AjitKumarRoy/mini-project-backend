const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ipViewCount = new Schema({
    ipAddress: { type: String, required: true, index: true, unique: true },
    userName: { type: String },
    dailyViews: { type: Map, of: Number, default: {} }, // Key: YYYY-MM-DD, Value: count
    totalViews: { type: Number, default: 0 },
    firstSeen: { type: Date },
    lastSeen: { type: Date },
}, { timestamps: true });

const ipViewCountModel = mongoose.model('IPViewCount', ipViewCount);
module.exports = ipViewCountModel;