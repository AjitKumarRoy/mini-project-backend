require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const sheetRoutes = require('./routes/sheetRoutes');

const app = express();
const PORT = process.env.PORT || 3000;



// Connect to MongoDB
connectDB();


const corsOptions = {
    origin:  ['https://www.ajitkumarroy.me', 'https://ajitkumarroy.me', 'https://mini-project-frontend-omega.vercel.app'],//  Replace with your frontend's origin
    credentials: true, //  Allow cookies to be sent
    allowedHeaders: ["Content-Type", "Authorization"],  //
    methods: ["GET", "POST", "PUT", "DELETE"],
};


app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*'); 
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});



// Middlewares
// app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());

// Routes
app.get('/', (req, res) => {
    res.send('hello world!');
});
app.use('/api/auth', authRoutes);
app.use('/api/sheets', sheetRoutes);

// Basic error handler
app.use((err, req, res, next) => {
    console.log(err.stack);
    res.status(500).json({
        'message': 'Something went wrong!',
        'error': err.message
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});