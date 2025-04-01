const { google } = require('googleapis');
const User = require('../models/User');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
);

// Scopes for accessing Google Sheets and basic profile info.
const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
];

// Automatically update tokens when new ones are received
oauth2Client.on('tokens', async (tokens) => {
    console.log('Tokens caputured : ', tokens.access_token, tokens.refresh_token);
    console.log('tokens : ', tokens);

    if (!tokens.id_token) return;
    // Decode the id_token to get Google ID
    const { sub: googleId } = JSON.parse(
        Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()
    );

    // find the user in DB
    const user = await User.findOne({ googleId });
    if (!user) return;

    // update in DB
    if (tokens.refresh_token) {
        // find and update the user with the new refresh token
        await User.findOneAndUpdate(
            { googleId: user.googleId }, // Identify the user
            { refreshToken: tokens.refresh_token, accessToken: tokens.access_token, tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null }
        );
        console.log('both access and refresh tokens are updated.');
    } else if (tokens.access_token) {
        // Update access token only if no new refresh token
        await User.findOneAndUpdate(
            { googleId: user.googleId }, // Identify the user
            { accessToken: tokens.access_token, tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null }
        );
        console.log('access  token is being updated.');
    }
});

module.exports = {
    oauth2Client,
    SCOPES
};