// routes/booking.js
const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const { isLoggedIn } = require("../middleware");

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
router.post("/confirm", isLoggedIn, async (req, res) => {
  try {
    const {
      serviceId,
      providerId,
      date,
      latitude,
      longitude,
      detailedAddress,
      notes
    } = req.body;

    // Validate required fields
    if (!serviceId || !providerId || !date || !detailedAddress) {
      req.flash('error', 'All required fields must be filled');
      return res.redirect('back');
    }

    // Get service and provider details with error handling
    const [service, provider] = await Promise.all([
      Service.findById(serviceId),
      ServiceProvider.findById(providerId)
        .populate('user')
        .populate('servicesOffered')
    ]);

    // Check if service and provider exist
    if (!service || !provider) {
      req.flash('error', 'Service or provider not found');
      return res.redirect('/services');
    }

    // Find service details from provider's offerings
    let serviceDetails = null;
    provider.servicesOffered.forEach(category => {
      if (category.services && Array.isArray(category.services)) {
        category.services.forEach(s => {
          if (s.service && s.service.toString() === serviceId) {
            serviceDetails = s;
          }
        });
      }
    });

    // Check if service details were found
    if (!serviceDetails) {
      req.flash('error', 'Service details not found');
      return res.redirect('/services');
    }

    // Create booking data object with validation
    const bookingData = {
      serviceId,
      providerId,
      date: new Date(date),
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(longitude) || 0,
          parseFloat(latitude) || 0
        ]
      },
      detailedAddress,
      notes: notes || '',
      customerId: req.user._id,
      cost: serviceDetails.customCost
    };

    // Check if user exists
    if (!req.user || !req.user._id) {
      req.flash('error', 'Please login to continue');
      return res.redirect('/login');
    }

    // Render confirmation page with all required data
    res.render('pages/booking-confirm', {
      service,
      provider,
      bookingData,
      serviceDetails,
      user: req.user
    });

  } catch (err) {
    console.error('Booking confirmation error:', err);
    req.flash('error', 'Something went wrong');
    res.redirect('/services');
  }
});

module.exports = router;
