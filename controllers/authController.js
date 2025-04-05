const { oauth2Client, SCOPES } = require('../config/google');
const { generateToken } = require('../utils/jwt');
const User = require('../models/User');
const { google } = require('googleapis');

exports.googleAuth = (req, res) => {
    // Generate the url that will be used for consent dialog.
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });
    res.redirect(authUrl);
};

exports.googleCallback = async (req, res, next) => {
    try {
        const code = req.query.code;
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        
        // Get user profile info
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data } = await oauth2.userinfo.get();

        // Find or create user in MongoDB
        let user = await User.findOne({ googleId: data.id });
        if (!user) {
            user = new User({
                googleId: data.id,
                email: data.email,
                name: data.name,
                picture: data.picture,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null
            });
        } else {
            user.accessToken = tokens.access_token;

            if (tokens.refresh_token) {
                user.refreshToken = tokens.refresh_token;
            }
            user.tokenExpiry = tokens.expiry_date ? new Date(tokens.expiry_date) : null;
        }
        await user.save();

        // Generate JWT and set in HTTP-only cookie
        const payload = {
            id: user._id.toString(),  // convert mongo ObjectId to string
            email: user.email
        };
        const jwtToken = generateToken(payload);
        res.cookie('token', jwtToken, {
            httpOnly: true,
            sameSite: 'Lax', // Allow frontend and backend on different ports
        });
        //res.redirect('/api/auth/profile');  // or send a JSON response if usring SPA     
        //res.redirect(`http://localhost:3001/profile?token=${jwtToken}`);
        res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/`)
    } catch(error) {
        next(error);
    }
};

exports.refreshToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({'message ' : 'Refresh token missing.'});
        }
        oauth2Client.setCredentials({refresh_token: refreshToken});
        const { credentials } = await oauth2Client.refreshAccessToken();

        // Update the access token and expiration time in DB
        // find the user by refresh token
        const user = await User.findOne({refreshToken});
        if (user) {
            user.accessToken = credentials.access_token,
            user.tokenExpiry = credentials.expiry_date
        }
        res.json({
            accessToken: credentials.access_token,
            expiryDate: credentials.expiry_date
        });
    } catch(error) {
        next(error);
    }
};

exports.logout = (req, res) => {
    res.clearCookie('token');
    res.json({'message': 'Logged out sucessfully'});
};

exports.getProfile = async (req, res, next) => {
    try {
        // Asumming the req.user contains the decoded JWT payload
        const user = await User.findById(req.user.id).select('-__v');
        // res.json({user});
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // ✅ Return user details as JSON (including profile picture)
        res.json({
            name: user.name,
            email: user.email,
            profilePicture: user.picture, // Assuming user has a `profilePicture` field
        });
    } catch(error) {
        next(error);
    }
};