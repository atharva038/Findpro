const express = require("express");
const ejsMate = require("ejs-mate");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");

const User = require("./models/User.js");
const authorisationRoutes = require("./routes/auth.js");
const bookingRoutes = require("./routes/booking.js");
const providerRoutes = require("./routes/provider.js");
const servicesRoutes = require("./routes/services.js");
const aboutRoutes = require("./routes/about.js");
const dashboardRoutes = require("./routes/dashboard.js");

// Database connection

const MONGO_URL = "mongodb://127.0.0.1:27017/findpro";

main()
  .then(() => {
    console.log("Connected to DB");
  })
  .catch((error) => {
    console.log("Database connection error:", error);
  });
async function main() {
  await mongoose.connect(MONGO_URL);
}

app.use(bodyParser.urlencoded({ extended: true }));

app.engine("ejs", ejsMate);
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

passport.use(new LocalStrategy(User.authenticate()));

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
app.use("/", bookingRoutes);

// Listen on port
app.listen(3000, () => {
  console.log("Server is listening to port 8080");
});
