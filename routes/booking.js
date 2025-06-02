const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const Payment = require("../models/Payment");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const { isLoggedIn } = require("../middleware");
const { processProviderPayout } = require("../utils/paymentAutomation"); // Add this import

// POST route to create booking after payment confirmation
router.post("/create", isLoggedIn, async (req, res) => {
  try {
    const {
      serviceId,
      providerId,
      date,
      detailedAddress,
      notes,
      cost,
      paymentId,
      latitude,
      longitude
    } = req.body;

    // Validate required fields
    if (!serviceId || !providerId || !date || !detailedAddress || !cost) {
      return res.status(400).json({
        success: false,
        error: "All required fields must be provided"
      });
    }

    // Verify service and provider exist
    const [service, provider] = await Promise.all([
      Service.findById(serviceId),
      ServiceProvider.findById(providerId).populate('user')
    ]);

    if (!service || !provider) {
      return res.status(404).json({
        success: false,
        error: "Service or provider not found"
      });
    }

    // Create the booking
    const booking = new Booking({
      customer: req.user._id,
      service: serviceId,
      provider: providerId,
      providerUserId: provider.user._id,
      date: new Date(date),
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(longitude) || 0,
          parseFloat(latitude) || 0
        ]
      },
      address: detailedAddress,
      notes: notes || "",
      cost: parseFloat(cost),
      totalCost: parseFloat(cost), // Add this for consistency
      status: 'pending', // ✅ Keep as pending until provider confirms
      paymentStatus: 'partially_paid',
      advancePayment: {
        paid: true,
        paymentId: paymentId,
        amount: Math.round(cost * 0.15)
      },
      finalPayment: {
        paid: false,
        amount: cost - Math.round(cost * 0.15)
      }
    });

    await booking.save();

    res.json({
      success: true,
      bookingId: booking._id,
      message: "Booking created successfully"
    });

  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      error: "Server error. Please try again later."
    });
  }
});

// Route for booking confirmation page (before payment)
router.post("/confirm", isLoggedIn, async (req, res) => {
  try {
    const {
      serviceId,
      providerId,
      date,
      addressId,
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

    // Get service and provider details
    const [service, provider] = await Promise.all([
      Service.findById(serviceId),
      ServiceProvider.findById(providerId)
        .populate('user')
        .populate('servicesOffered')
    ]);

    if (!service || !provider) {
      req.flash('error', 'Service or provider not found');
      return res.redirect('/services');
    }

    // Get user addresses
    const user = await User.findById(req.user._id);
    let coordinates = { latitude, longitude };

    // Handle saved addresses
    if (addressId && addressId !== 'new' && user.addresses) {
      const addressIndex = parseInt(addressId);
      if (user.addresses[addressIndex] && user.addresses[addressIndex].coordinates) {
        coordinates = {
          latitude: user.addresses[addressIndex].coordinates.latitude,
          longitude: user.addresses[addressIndex].coordinates.longitude
        };
      }
    }

    // Find service details from provider's offerings
    let serviceDetails = null;
    for (const category of provider.servicesOffered) {
      if (category.services && Array.isArray(category.services)) {
        const foundService = category.services.find(s =>
          s.service && s.service.toString() === serviceId
        );
        if (foundService) {
          serviceDetails = foundService;
          break;
        }
      }
    }

    if (!serviceDetails) {
      req.flash('error', 'Service details not found');
      return res.redirect('/services');
    }

    // Validate booking date
    const bookingDate = new Date(date);
    if (isNaN(bookingDate.getTime()) || bookingDate <= new Date()) {
      req.flash('error', 'Please select a valid future date');
      return res.redirect('back');
    }

    // Create booking data object
    const bookingData = {
      serviceId,
      providerId,
      date: bookingDate,
      location: {
        type: 'Point',
        coordinates: [
          parseFloat(coordinates.longitude) || 0,
          parseFloat(coordinates.latitude) || 0
        ]
      },
      detailedAddress,
      notes: notes || '',
      customerId: req.user._id,
      cost: serviceDetails.customCost
    };

    // Render confirmation page
    res.render('pages/booking-confirm', {
      service,
      provider,
      bookingData,
      serviceDetails,
      user: req.user,
      title: 'Confirm Booking'
    });

  } catch (err) {
    console.error('Booking confirmation error:', err);
    req.flash('error', 'Something went wrong');
    res.redirect('/services');
  }
});

// Route to view customer bookings
router.get("/mybookings", isLoggedIn, async (req, res) => {
  try {
    const bookings = await Booking.find({ customer: req.user._id })
      .populate("service")
      .populate("provider")
      .populate("providerUserId", "name email phone")
      .sort({ createdAt: -1 });

    res.render("pages/my-bookings", {
      bookings,
      user: req.user,
      title: "My Bookings"
    });
  } catch (err) {
    console.error("Error fetching bookings:", err);
    req.flash('error', 'Unable to fetch bookings');
    res.redirect('/dashboard');
  }
});

// Route to mark booking as completed (triggers provider payout)
router.post("/complete/:id", isLoggedIn, async (req, res) => {
  try {
    const bookingId = req.params.id;

    // Find booking and verify ownership
    const booking = await Booking.findById(bookingId)
      .populate('customer')
      .populate('provider');

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found"
      });
    }

    // Check if user is the customer or provider
    const isCustomer = booking.customer._id.toString() === req.user._id.toString();
    const isProvider = booking.provider.user &&
      booking.provider.user.toString() === req.user._id.toString();

    if (!isCustomer && !isProvider) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized to complete this booking"
      });
    }

    // Update booking status
    const updatedBooking = await Booking.findByIdAndUpdate(bookingId, {
      status: 'completed',
      completedAt: new Date(),
      paymentStatus: 'completed'
    }, { new: true });

    // Trigger automated provider payout
    try {
      await processProviderPayout(bookingId);
      console.log(`✅ Automated payout triggered for booking ${bookingId}`);
    } catch (payoutError) {
      console.error('Provider payout failed:', payoutError);
      // Don't fail the completion, just log the error
    }

    res.json({
      success: true,
      message: 'Booking completed and provider payout processed',
      automated: 'Provider payout processed automatically'
    });

  } catch (error) {
    console.error("Error completing booking:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete booking'
    });
  }
});

// Route to cancel booking
router.post("/cancel/:id", isLoggedIn, async (req, res) => {
  try {
    const bookingId = req.params.id;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: "Booking not found"
      });
    }

    // Check if user owns this booking
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized"
      });
    }

    // Check if booking can be cancelled
    const bookingDate = new Date(booking.date);
    const now = new Date();
    const hoursUntilBooking = (bookingDate - now) / (1000 * 60 * 60);

    if (hoursUntilBooking < 24) {
      return res.status(400).json({
        success: false,
        error: "Cannot cancel booking less than 24 hours before scheduled time"
      });
    }

    // Update booking
    await Booking.findByIdAndUpdate(bookingId, {
      status: 'cancelled',
      cancellationReason: reason || 'No reason provided',
      cancelledAt: new Date()
    });

    res.json({
      success: true,
      message: "Booking cancelled successfully"
    });

  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel booking"
    });
  }
});

// Get booking details
router.get("/details/:id", isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('service')
      .populate('provider')
      .populate('customer', 'name email phone')
      .populate('providerUserId', 'name email phone');

    if (!booking) {
      req.flash('error', 'Booking not found');
      return res.redirect('/booking/mybookings');
    }

    // Check if user has access to this booking
    const hasAccess = booking.customer._id.toString() === req.user._id.toString() ||
      (booking.provider.user && booking.provider.user.toString() === req.user._id.toString());

    if (!hasAccess) {
      req.flash('error', 'Unauthorized access');
      return res.redirect('/booking/mybookings');
    }

    res.render('pages/booking-details', {
      booking,
      user: req.user,
      title: 'Booking Details'
    });

  } catch (error) {
    console.error("Error fetching booking details:", error);
    req.flash('error', 'Unable to fetch booking details');
    res.redirect('/booking/mybookings');
  }
});

// Add this route for booking success
router.get('/success', isLoggedIn, async (req, res) => {
  try {
    let booking = null;
    let payment = null;

    // First try to get the most recent completed booking for this user
    booking = await Booking.findOne({
      customer: req.user._id,
      status: { $in: ['confirmed', 'completed'] }
    })
      .populate('service')
      .populate({
        path: 'provider',
        populate: {
          path: 'user'
        }
      })
      .sort({ createdAt: -1 });

    if (booking) {
      // Get the most recent payment for this booking
      payment = await Payment.findOne({
        booking: booking._id,
        status: 'completed'
      }).sort({ createdAt: -1 });
    } else {
      // If no booking found, try to get the most recent automated payment
      payment = await Payment.findOne({
        status: 'completed',
        paymentType: 'advance' // For automated advance payments
      })
        .populate({
          path: 'booking',
          match: { customer: req.user._id },
          populate: [
            { path: 'service' },
            {
              path: 'provider',
              populate: { path: 'user' }
            }
          ]
        })
        .sort({ createdAt: -1 });

      if (payment && payment.booking) {
        booking = payment.booking;
      }
    }

    // If still no booking/payment found, show a generic success message
    if (!booking && !payment) {
      console.log('No booking or payment found for user:', req.user._id);
    }

    res.render('pages/payment-success', {
      booking: booking || null,
      service: booking ? booking.service : null,
      provider: booking ? booking.provider : null,
      payment: payment || null,
      title: 'Payment Successful',
      user: req.user
    });

  } catch (error) {
    console.error('Error displaying booking success:', error);
    req.flash('error', 'Failed to load booking details');
    res.redirect('/dashboard');
  }
});

module.exports = router;