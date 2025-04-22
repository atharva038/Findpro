const express = require("express");
const ejsMate = require("ejs-mate");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
require("dotenv").config();
const User = require("./models/User.js");
const authorisationRoutes = require("./routes/auth.js");
const bookingRoutes = require("./routes/booking.js");
const providerRoutes = require("./routes/provider.js");
const servicesRoutes = require("./routes/services.js");
const aboutRoutes = require("./routes/about.js");
const dashboardRoutes = require("./routes/dashboard.js");
const adminRoutes = require('./routes/admin');
const locationRoutes = require('./routes/location');
const paymentRoutes = require('./routes/payment');
const profileRoutes = require('./routes/profile');
const bookingApiRoutes = require('./routes/api/bookings');
// Database connection

// Update the database connection section
async function main() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB Atlas");
  } catch (error) {
    console.error("MongoDB Atlas connection error:", error);
    process.exit(1); // Exit if unable to connect to database
  }
}

main();
app.use(bodyParser.urlencoded({ extended: true }));

app.engine("ejs", ejsMate);
app.use(express.json());

app.use(express.static(path.join(__dirname, "/public")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

const sessionOptions = {
  secret: "mysupersecretcode",
  resave: false,
  saveUninitialized: true,
  cookie: {
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
  },
};

app.use(session(sessionOptions));
app.use(flash());

// app.get("/reg",(req,res)=>{
//   let{name = "atharva"} = req.query;
//   req.session.name = name;
//   req.flash("success","user registered")
// })
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});
app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

// Middleware to check if the current user is a provider
function setCurrentProvider(req, res, next) {
  if (req.isAuthenticated() && req.user.role === "provider") {
    // If the logged-in user is a provider, set res.locals.currProvider
    res.locals.currProvider = req.user;
  }
  if (req.isAuthenticated() && req.user.role === "customer") {
    // If the logged-in user is a provider, set res.locals.currProvider
    res.locals.currCustomer = req.user;
  }
  next();
}

// Apply this middleware globally in app.js (before routes)
app.use(setCurrentProvider);

// Add this custom authentication strategy

// Customize the authentication strategy to allow login with email or phone
passport.use(new LocalStrategy(
  async function (username, password, done) {
    try {
      // Check if username is an email or phone number
      let user;
      if (username.includes('@')) {
        // Login with email
        user = await User.findOne({ username: username });
      } else {
        // Login with phone number
        user = await User.findOne({ phone: username });
      }

      if (!user) {
        return done(null, false, { message: 'Incorrect username or password.' });
      }

      // Let passport-local-mongoose handle the password verification
      user.authenticate(password, function (err, result) {
        if (err) { return done(err); }
        if (!result) { return done(null, false, { message: 'Incorrect password.' }); }
        return done(null, user);
      });
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//Routes

app.get("/", (req, res) => {
  res.render("pages/home");
});

app.use("/", authorisationRoutes);
app.use("/services", servicesRoutes);
app.use("/", aboutRoutes);
app.use("/dashboard", dashboardRoutes);
// app.use("/", bookingRoutes);
app.use('/admin', adminRoutes);
app.use('/api/location', locationRoutes);
app.use('/booking', bookingRoutes);
app.use('/payment', paymentRoutes);
app.use('/profile', profileRoutes);
app.use('/api/bookings', bookingApiRoutes);
// Listen on port
app.listen(3000, () => {
  console.log("Server started on port 3000");
});
