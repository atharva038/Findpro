const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const router = express.Router();
const { body, validationResult } = require("express-validator");
// const {isLoggedIn} = require("../middleware.js");
const passportLocalMongoose = require("passport-local-mongoose");
const passport = require("passport");
const ServiceProvider = require("../models/ServiceProvider");
const { upload } = require('../config/cloudinary');
const cloudinary = require('cloudinary').v2;

router.get("/register", (req, res) => {
  res.render("pages/register");
});

router.post(
  "/register",
  upload.single('image'), // Add multer middleware before validation
  [
    body("name")
      .trim()
      .notEmpty().withMessage("Name is required.")
      .isLength({ min: 2 }).withMessage("Name must be at least 2 characters long"),

    body("username")
      .trim()
      .notEmpty().withMessage("Username is required.")
      .matches(/^[a-zA-Z0-9]+$/).withMessage("Username must contain only letters and numbers.")
      .isLength({ min: 3 }).withMessage("Username must be at least 3 characters long"),

    body("password")
      .isLength({ min: 6 }).withMessage("Password must be at least 6 characters long"),

    body("addresses")
      .trim()
      .notEmpty().withMessage("Address is required."),

    body("phone")
      .trim()
      .notEmpty().withMessage("Phone number is required.")
      .matches(/^[0-9]{10}$/).withMessage("Please enter a valid 10-digit phone number"),

    body("role")
      .trim()
      .notEmpty().withMessage("Role is required.")
      .isIn(["customer", "provider"]).withMessage("Role must be either customer or provider.")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Clean up uploaded file if validation fails
        if (req.file) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        const errorMessages = errors.array().map((err) => err.msg);
        req.flash("error", errorMessages.join(", "));
        return res.redirect("/register");
      }

      const { name, username, password, addresses, phone, role } = req.body;

      // Check if username already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        if (req.file) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        req.flash("error", "Username already exists");
        return res.redirect("/register");
      }

      // Create a new user
      const newUser = new User({
        name: name.trim(),
        username: username.trim(),
        addresses: [addresses.trim()],
        phone: phone.trim(),
        role: role.trim(),
        profileImage: req.file ? req.file.path : undefined, // Change 'image' to 'profileImage'
      });


      // Register the user using passport-local-mongoose
      const registeredUser = await User.register(newUser, password);

      // Create service provider if role is provider
      if (role === "provider") {
        const newProvider = new ServiceProvider({
          user: registeredUser._id,
          servicesOffered: [],
          portfolio: []
        });
        await newProvider.save();
      }

      req.flash("success", "Welcome to KnockNFix! You are registered");
      return res.redirect("/login");

    } catch (err) {
      console.error("Error during user registration:", err);
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      req.flash("error", "Registration failed. Please try again.");
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
