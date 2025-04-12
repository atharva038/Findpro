const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();
const { body, validationResult } = require("express-validator");
// const {isLoggedIn} = require("../middleware.js");
const passportLocalMongoose = require("passport-local-mongoose");
const passport = require("passport");
const ServiceProvider = require("../models/ServiceProvider");

// Register route (both customers and providers)
router.get("/register", (req, res) => {
  res.render("pages/register.ejs");
});

// POST /register route
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required."),
    body("username")
      .notEmpty()
      .isAlphanumeric()
      .withMessage("Username must contain only letters and numbers."),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long."),
    body("addresses").notEmpty().withMessage("Address is required."),
    body("phone")
      .isMobilePhone()
      .withMessage("Valid phone number is required."),
    body("role")
      .isIn(["customer", "provider"])
      .withMessage("Role must be either customer or provider."),
  ],
  async (req, res) => {
    // Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((err) => err.msg);
      req.flash("error", errorMessages.join(", "));
      return res.redirect("/register");
    }

    const { name, username, password, addresses, phone, role } = req.body;

    try {
      // Create a new user
      const newUser = new User({
        name,
        username,
        addresses,
        phone,
        role,
      });

      // Register the user using passport-local-mongoose or save directly if not using it
      const registeredUser = await User.register(newUser, password);

      // If role is 'provider', add to ServiceProvider collection
      if (role === "provider") {
        const newProvider = new ServiceProvider({
          user: registeredUser._id, // Link the ServiceProvider to the user
          // Add any additional fields for providers
        });
        await newProvider.save();
      }

      req.flash("success", "Welcome to KnockNFix! You are registered"); // Flash success message
      return res.redirect("/login");
    } catch (err) {
      console.error("Error during user registration:", err);
      req.flash("error", "Server error. Please try again later.");
      res.redirect("/register");
    }
  }
);

router.get("/login", (req, res) => {
  res.render("pages/login.ejs");
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err); // Handle error
    }
    if (!user) {
      req.flash("error", info.message || "Login failed"); // Flash an error message
      return res.redirect("/login"); // Redirect on failure
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err); // Handle error
      }

      req.session.userId = user._id; // Store user ID in session
      console.log("User ID stored in session:", req.session.userId); // Log user ID

      req.flash("success", "Welcome back to KnockNFix! You are logged in"); // Flash success message
      let redirectUrl = res.locals.redirectUrl || "/"; // Default redirect URL
      console.log(redirectUrl); // Debugging: check the value
      return res.redirect(redirectUrl); // Redirect after successful login
    });
  })(req, res, next);
});

// Logout route
router.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
  }); // Assuming you use sessions
  req.flash("success", "User logout succesfully");
  res.redirect("/login");
});

module.exports = router;
