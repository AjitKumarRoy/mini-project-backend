const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const Contact = require('../models/Contact');
const IPViewCount = require('../models/Views'); // Assuming you still want to track views


router.post('/contact', [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('Invalid email.'),
    body('message').trim().notEmpty().withMessage('Message is required.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: errors.array()[0].msg });
    }

    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Please fill in all fields.' });
    }

    try {
        // step1: save the contact form data to the db
        const newContact = new Contact({
            name,
            email,
            message,
            ipAddress: req.ip
        });
        await newContact.save();

        // step2: Integrate with view tracking (optional)
        const ipAddress = req.ip;
        const ipViewRecord = await IPViewCount.findOne({ ipAddress });
        if (ipViewRecord && !ipViewRecord.contactFormSubmissions?.includes(newContact._id)) {
            ipViewRecord.contactFormSubmissions = ipViewRecord.contactFormSubmissions || [];
            ipViewRecord.contactFormSubmissions.push(newContact._id);
            await ipViewRecord.save();
        }

        // step3: send the email using nodemailer
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.GMAIL_USER,   // your gmail address
                pass: process.env.GMAIL_PASSWORD, // your gmail password
            }
        });

        // email to admin
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: 'easysheetsofficial@gmail.com',
            subject: `New Contact Form Submission from ${name}`,
            html: `<p><strong>Name:</strong> ${name}</p>
                   <p><strong>Email:</strong> ${email}</p>
                   <p><strong>Message:</strong></p>
                   <p>${message}</p>
                   <hr>
                   <p>IP Address: ${req.ip}</p>`, // Include IP for context
        };


        // send email to admin
        await transporter.sendMail(mailOptions);

        //  Send Confirmation Email to User
        await transporter.sendMail({
            from: `"Easy Sheets Support" <${process.env.GMAIL_USER}>`,
            to: email,
            subject: 'Thanks for Contacting Easy Sheets!',
            text: `Hi ${name},\n\nThank you for reaching out to us. We have received your message and will get back to you shortly.\n\nRegards,\nEasy Sheets Team\nhttps://www.ajitkumarroy.me`,
            html: `
                <p>Hi ${name},</p>
                <p>Thank you for reaching out to <strong>Easy Sheets</strong>.</p>
                <p>We have received your message and will get back to you shortly.</p>
                <br>
                <hr>
                <p style="font-size: 12px; color: #666;">
                  You are receiving this email because you contacted us via our website.<br>
                  Visit us at <a href="https://www.ajitkumarroy.me">www.ajitkumarroy.me</a><br>
                  Contact: ${process.env.GMAIL_USER}
                </p>
            `
        });
        

        res.status(200).json({ message: 'Thank you for you message! We have received it and will get back to you soon.' });
    } catch (error) {
        console.error('Error handling contact form submission:', error);
        res.status(500).json({ message: 'Failed to submit the form. Please try again later.' });
    }
});

module.exports = router;

