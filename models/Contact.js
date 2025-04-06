// models/Contact.js
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const contact = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    ipAddress: { type: String }, // Optional: To store the IP address of the sender
}, { timestamps: true });

const contactModel = mongoose.model('Contact', contact);

module.exports = contactModel;