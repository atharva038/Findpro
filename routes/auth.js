const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const OTP = require("../models/OTP"); // Import OTP model
const router = express.Router();
const { body, validationResult } = require("express-validator");
const passportLocalMongoose = require("passport-local-mongoose");
const passport = require("passport");
const ServiceProvider = require("../models/ServiceProvider");
const { upload } = require('../config/cloudinary');
const cloudinary = require('cloudinary').v2;
const { generateOTP, sendEmailOTP, sendSmsOTP } = require('../utils/otp');

// Render registration form
router.get("/register", (req, res) => {
  res.render("pages/register");
});

// Handle registration form submission - first step
router.post(
  "/register",
  upload.single('image'), // Handle file upload
  [
    body("name")
      .trim()
      .notEmpty().withMessage("Name is required.")
      .isLength({ min: 2 }).withMessage("Name must be at least 2 characters long"),

    body("username")
      .trim()
      .notEmpty().withMessage("Email is required.")
      .isEmail().withMessage("Please provide a valid email address.")
      .normalizeEmail(),

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

      // Check if username (email) already exists
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        if (req.file) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        req.flash("error", "Email already exists");
        return res.redirect("/register");
      }

      // Check if phone already exists
      const existingPhone = await User.findOne({ phone });
      if (existingPhone) {
        if (req.file) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        req.flash("error", "Phone number already exists");
        return res.redirect("/register");
      }

      // Generate OTPs
      const emailOTP = generateOTP();
      const phoneOTP = generateOTP();

      console.log(`Email OTP for ${username}: ${emailOTP}`); // For testing/debugging
      console.log(`Phone OTP for ${phone}: ${phoneOTP}`); // For testing/debugging

      // Save user data and OTPs
      const userData = {
        name: name.trim(),
        username: username.trim(),
        password, // We'll hash it upon successful verification
        addresses: [addresses.trim()],
        phone: phone.trim(),
        role: role.trim(),
        profileImage: req.file ? req.file.path : undefined
      };

      // Delete any existing OTP documents for this email or phone
      await OTP.deleteMany({
        $or: [{ email: username }, { phone }]
      });

      // Store OTPs
      const otpDoc = new OTP({
        email: username,
        phone,
        emailOTP,
        phoneOTP,
        userData
      });

      await otpDoc.save();

      // Send OTPs
      const emailResult = await sendEmailOTP(username, emailOTP);

      if (!emailResult.success) {
        throw new Error(`Failed to send email OTP: ${emailResult.error}`);
      }

      // Only try to send SMS if Twilio is properly configured
      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        const smsResult = await sendSmsOTP(phone, phoneOTP);
        if (!smsResult.success) {
          console.warn(`SMS OTP sending failed: ${smsResult.error}`);
          // Continue anyway, as we at least sent the email OTP
        }
      }

      // Store reference in session for verification page
      req.session.verificationEmail = username;

      // Redirect to verification page
      res.redirect("/verify-otp");

    } catch (err) {
      console.error("Error during registration process:", err);
      if (req.file) {
        await cloudinary.uploader.destroy(req.file.filename);
      }
      req.flash("error", err.message || "Registration failed. Please try again.");
      res.redirect("/register");
    }
  }
);

// OTP Verification page
router.get("/verify-otp", (req, res) => {
  const email = req.session.verificationEmail;

  if (!email) {
    req.flash("error", "Please register first");
    return res.redirect("/register");
  }

  res.render("pages/verify-otp", { email });
});

// Handle OTP verification
router.post("/verify-otp", async (req, res) => {
  try {
    const { emailOTP, phoneOTP } = req.body;
    const email = req.session.verificationEmail;

    if (!email) {
      req.flash("error", "Verification session expired. Please register again.");
      return res.redirect("/register");
    }

    // Find the OTP document
    const otpDoc = await OTP.findOne({ email });

    if (!otpDoc) {
      req.flash("error", "Verification code expired. Please register again.");
      return res.redirect("/register");
    }

    // Validate email OTP
    const isEmailOTPValid = emailOTP === otpDoc.emailOTP;

    // Validate phone OTP
    const isPhoneOTPValid = phoneOTP === otpDoc.phoneOTP;

    if (!isEmailOTPValid && !isPhoneOTPValid) {
      req.flash("error", "Both verification codes are invalid.");
      return res.redirect("/verify-otp");
    }

    if (!isEmailOTPValid) {
      req.flash("error", "Email verification code is invalid.");
      return res.redirect("/verify-otp");
    }

    if (!isPhoneOTPValid) {
      req.flash("error", "Phone verification code is invalid.");
      return res.redirect("/verify-otp");
    }

    // Both OTPs valid, proceed with user creation
    const userData = otpDoc.userData;

    // Create the new user
    const newUser = new User({
      name: userData.name,
      username: userData.username,
      addresses: userData.addresses,
      phone: userData.phone,
      role: userData.role,
      profileImage: userData.profileImage
    });

    // Register the user using passport-local-mongoose
    const registeredUser = await User.register(newUser, userData.password);

    // Create service provider if role is provider
    if (userData.role === "provider") {
      const newProvider = new ServiceProvider({
        user: registeredUser._id,
        servicesOffered: [],
        portfolio: []
      });
      await newProvider.save();
    }

    // Clean up the OTP document
    await OTP.deleteOne({ email });

    // Clear verification session
    delete req.session.verificationEmail;

    req.flash("success", "Account verified and created successfully! You can now log in.");
    res.redirect("/login");

  } catch (err) {
    console.error("Error during verification:", err);
    req.flash("error", err.message || "Verification failed. Please try again.");
    res.redirect("/verify-otp");
  }
});

// Resend OTP
router.post("/resend-otp", async (req, res) => {
  try {
    const email = req.session.verificationEmail;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Session expired, please register again"
      });
    }

    const otpDoc = await OTP.findOne({ email });

    if (!otpDoc) {
      return res.status(400).json({
        success: false,
        message: "Verification data expired, please register again"
      });
    }

    // Generate new OTPs
    const newEmailOTP = generateOTP();
    const newPhoneOTP = generateOTP();

    console.log(`New Email OTP for ${email}: ${newEmailOTP}`); // For testing
    console.log(`New Phone OTP for ${otpDoc.phone}: ${newPhoneOTP}`); // For testing

    // Update OTPs
    otpDoc.emailOTP = newEmailOTP;
    otpDoc.phoneOTP = newPhoneOTP;
    otpDoc.createdAt = Date.now(); // Reset expiration timer
    await otpDoc.save();

    // Send new OTPs
    const emailResult = await sendEmailOTP(email, newEmailOTP);

    if (!emailResult.success) {
      throw new Error(`Failed to send email OTP: ${emailResult.error}`);
    }

    // Only try to send SMS if Twilio is properly configured
    let smsSuccess = false;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      const smsResult = await sendSmsOTP(otpDoc.phone, newPhoneOTP);
      smsSuccess = smsResult.success;
      if (!smsResult.success) {
        console.warn(`SMS OTP sending failed: ${smsResult.error}`);
      }
    }

    res.json({
      success: true,
      emailSent: true,
      smsSent: smsSuccess,
      message: "Verification codes sent successfully"
    });

  } catch (err) {
    console.error("Error resending OTP:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to resend verification codes"
    });
  }
});

// Login routes remain the same
router.get("/login", (req, res) => {
  res.render("pages/login.ejs");
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      req.flash("error", info.message || "Login failed");
      return res.redirect("/login");
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }

      req.session.userId = user._id;
      req.flash("success", "Welcome back to KnockNFix! You are logged in");
      let redirectUrl = res.locals.redirectUrl || "/";
      return res.redirect(redirectUrl);
    });
  })(req, res, next);
});

// Logout route
router.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "User logged out successfully");
    res.redirect("/login");
  });
});

module.exports = router;