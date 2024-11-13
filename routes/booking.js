// routes/booking.js
const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");

// POST route to confirm booking
router.post("/dashboard", async (req, res) => {
  try {
    const { serviceId, providerId, date, address, newAddress, notes } =
      req.body;
    const userId = req.session.userId;

    console.log("userId", userId);
    console.log("providerId", providerId);

    // Verify the customer (user) exists
    const customer = await User.findById(userId);
    if (!customer) {
      req.flash("error", "User not authenticated. Please log in.");
      return res.redirect("/login");
    }

    // Check if the provider and service exist
    const provider = await ServiceProvider.findById(providerId);
    const service = await Service.findById(serviceId);

    const providerUserId = provider.user._id;
    console.log("providerUserId", providerUserId);

    if (!provider) {
      req.flash("error", "Provider not found.");
      return res.redirect("/login");
    }

    if (!provider || !service) {
      req.flash("error", "Service or provider not found.");
      return res.redirect("/services");
    }

    // Check for valid date input
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime())) {
      req.flash("error", "Invalid date and time. Please select a valid date.");
      return res.redirect("/services");
    }

    // Handle address input
    let finalAddress = address;
    if (address === "new") {
      if (!newAddress || newAddress.trim() === "") {
        req.flash("error", "New address is required.");
        return res.redirect("/services");
      }
      finalAddress = newAddress;
    }

    // Create the new booking entry
    const booking = new Booking({
      customer: userId, // Assuming `customer` field refers to the userId
      service: serviceId,
      provider: providerId,
      providerUserId: providerUserId,
      date: bookingDate,
      address: finalAddress,
      notes: notes || "", // Default empty string if no notes are provided
    });

    await booking.save();

    req.flash("success", "Booking confirmed!");
    res.redirect("/dashboard"); // Redirect to the customer's dashboard
  } catch (error) {
    console.error("Error booking service:", error);
    req.flash("error", "Server error. Please try again later.");
    res.redirect("/services");
  }
});

// Route to view customer bookings
router.get("/mybookings", async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .populate("service")
      .populate("provider");
    res.render("bookings", { bookings });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
