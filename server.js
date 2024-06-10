const express = require('express');
const session = require('express-session');
const path = require('path');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = 3000;

const serviceAccount = require('./key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: true
}));

app.use('/static', express.static(path.join(__dirname, 'public')));

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup');
});

// Signup route
app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('prolog').doc(email).set({
      username,
      email,
      password: hashedPassword,
    });
    res.redirect('/login');
  } catch (error) {
    console.error('Error signing up:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Login page
app.get('/login', (req, res) => {
  res.render('login');
});

// Login route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const userInfo = await db.collection('prolog').doc(email).get();
    if (!userInfo.exists) {
      return res.send('User does not exist');
    }

    const user = userInfo.data();
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      req.session.userId = userInfo.id;
      req.session.username = user.username;
      res.redirect('/dashboard');
    } else {
      res.send('Incorrect password');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  res.render('dashboard', { username: req.session.username });
});

// Search route
app.post('/search', async (req, res) => {
  const { city } = req.body;
  try {
    const response = await axios.get(`https://api.api-ninjas.com/v1/airquality?city=${city}`, {
      headers: {
        'X-Api-Key': 'NLGD1jLHXD7AGUT1G7dSkXDMyHFnR4AU3JCR79JA'
      }
    });
    const airQualityData = response.data;
    airQualityData.city = city; // Assign the city name to the airQualityData object
    res.render('result', { airQuality: airQualityData }); // Pass airQualityData to the template
  } catch (error) {
    console.error('Error fetching air quality data:', error);
    res.status(500).send('Error fetching air quality data. Please try again later.');
  }
});

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
