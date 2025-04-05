require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const sheetRoutes = require('./routes/sheetRoutes');
const viewsRoutes = require('./routes/viewsRoutes');
const trackIPViews = require('./middlewares/trackIPViews');

const app = express();
const PORT = process.env.PORT || 3000;



// Connect to MongoDB
connectDB();


const corsOptions = {
    origin:  ['https://www.ajitkumarroy.me', 'https://ajitkumarroy.me', 'https://mini-project-frontend-omega.vercel.app', 'https://mini-project-frontend-ajits-projects-7d941631.vercel.app', 'https://mini-project-frontend-git-master-ajits-projects-7d941631.vercel.app'],//  Replace with your frontend's origin
    credentials: true, //  Allow cookies to be sent
    allowedHeaders: ["Content-Type", "Authorization"],  //
    methods: ["GET", "POST", "PUT", "DELETE"],
};




// Middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(cookieParser());



// Routes
app.get('/', trackIPViews, (req, res) => {
    res.send('hello world!');
});
app.use('/api/auth', authRoutes);
app.use('/api/sheets', sheetRoutes);
app.use('/api', viewsRoutes);

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