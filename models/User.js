const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const user = new Schema({
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    name: { type: String },
    picture: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiry: { type: Date }
}, { timestamps: true });

const userModel = mongoose.model('User', user);

module.exports = userModel;