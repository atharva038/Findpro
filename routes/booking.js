const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const { isLoggedIn, isAdmin } = require("../middleware");

// ===== CUSTOMER ROUTES =====

// Create booking after payment confirmation
router.post("/create", isLoggedIn, bookingController.createBooking);

// Booking confirmation page (before payment)
router.post("/confirm", isLoggedIn, bookingController.confirmBooking);

// Get customer's bookings
router.get("/mybookings", isLoggedIn, bookingController.getMyBookings);

// Get booking details
router.get("/details/:id", isLoggedIn, bookingController.getBookingDetails);

// Complete booking (customer or provider)
router.post("/complete/:id", isLoggedIn, bookingController.completeBooking);

// Cancel booking (customer only)
router.post("/cancel/:id", isLoggedIn, bookingController.cancelBooking);

// Booking success page
router.get("/success", isLoggedIn, bookingController.getBookingSuccess);

// ===== ADMIN ROUTES =====

// Get all bookings (admin view)
router.get("/admin/all", isLoggedIn, isAdmin, bookingController.getAllBookings);

// Update booking status (admin only)
router.patch("/admin/:id/status", isLoggedIn, isAdmin, bookingController.updateBookingStatus);

module.exports = router;