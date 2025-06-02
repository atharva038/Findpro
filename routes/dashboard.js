const express = require("express");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment"); // Add Payment model import
const Category = require("../models/category");
const { body, validationResult } = require("express-validator");
const { isLoggedIn } = require("../middleware");
const router = express.Router();
const mongoose = require("mongoose");

// Helper functions for dashboard data
async function getCustomerDashboardData(userId) {
  console.log('Fetching customer dashboard data for user:', userId);

  try {
    // Get all bookings for this customer with detailed population
    const bookings = await Booking.find({ customer: userId })
      .populate({
        path: "service",
        select: "name img price description category"
      })
      .populate({
        path: "provider",
        populate: {
          path: "user",
          select: "name email phone profileImage"
        }
      })
      .sort({ createdAt: -1 }) // Sort by creation date (most recent first)
      .lean();

    console.log(`Found ${bookings.length} bookings for customer ${userId}`);

    // Process bookings to ensure all required fields are present
    const processedBookings = bookings.map(booking => {
      const processedBooking = JSON.parse(JSON.stringify(booking));

      // Ensure service data is valid
      if (!processedBooking.service) {
        processedBooking.service = {
          name: 'Unknown Service',
          img: 'https://placehold.co/300x200?text=Unknown+Service',
          price: 0
        };
      } else if (!processedBooking.service.img) {
        processedBooking.service.img = 'https://placehold.co/300x200?text=No+Image';
      }

      // Ensure provider data is valid
      if (!processedBooking.provider) {
        processedBooking.provider = {
          user: {
            name: 'Unknown Provider',
            profileImage: 'https://placehold.co/100x100?text=Provider'
          }
        };
      } else if (!processedBooking.provider.user) {
        processedBooking.provider.user = {
          name: 'Unknown Provider',
          profileImage: 'https://placehold.co/100x100?text=Provider'
        };
      } else if (!processedBooking.provider.user.profileImage ||
        processedBooking.provider.user.profileImage.includes('data:;base64,=')) {
        processedBooking.provider.user.profileImage = 'https://placehold.co/100x100?text=Provider';
      }

      // Ensure date fields are available
      if (!processedBooking.bookingDate && processedBooking.date) {
        processedBooking.bookingDate = processedBooking.date;
      }
      if (!processedBooking.date && processedBooking.bookingDate) {
        processedBooking.date = processedBooking.bookingDate;
      }

      // Calculate payment status display
      if (processedBooking.paymentStatus === 'partially_paid') {
        processedBooking.displayStatus = 'Advance Paid';
        processedBooking.badgeClass = 'badge-warning';
      } else if (processedBooking.paymentStatus === 'completed') {
        processedBooking.displayStatus = 'Fully Paid';
        processedBooking.badgeClass = 'badge-success';
      } else {
        processedBooking.displayStatus = 'Payment Pending';
        processedBooking.badgeClass = 'badge-danger';
      }

      // Add automation status info
      if (processedBooking.automationStatus && processedBooking.automationStatus.depositProcessed) {
        processedBooking.isAutomated = true;
        processedBooking.automationInfo = 'Automated Payment System';
      }

      return processedBooking;
    });

    // Get available services for the customer
    const services = await Service.find({ isActive: true })
      .populate('category')
      .limit(6)
      .lean();

    // Calculate booking statistics
    const bookingStats = {
      total: bookings.length,
      pending: bookings.filter(b => b.status === 'pending').length,
      confirmed: bookings.filter(b => b.status === 'confirmed').length,
      completed: bookings.filter(b => b.status === 'completed').length,
      cancelled: bookings.filter(b => b.status === 'cancelled').length
    };

    // Get recent payments for this customer
    const recentPayments = await Payment.find({
      status: 'completed'
    })
      .populate({
        path: 'booking',
        match: { customer: userId },
        select: 'service status createdAt'
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const validPayments = recentPayments.filter(p => p.booking);

    console.log('Customer booking stats:', bookingStats);

    return {
      bookings: processedBookings,
      services: services || [],
      bookingStats,
      recentPayments: validPayments
    };

  } catch (error) {
    console.error('Error fetching customer dashboard data:', error);
    return {
      bookings: [],
      services: [],
      bookingStats: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
      recentPayments: []
    };
  }
}

// Helper function to get provider dashboard data
async function getProviderDashboardData(userId) {
  console.log('Fetching provider dashboard data for user:', userId);

  try {
    // Find or create provider record
    let serviceProviderData = await ServiceProvider.findOne({ user: userId });

    if (!serviceProviderData) {
      console.log('Creating new provider record for user:', userId);

      // Create default provider record with availability
      const defaultAvailability = {};
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        defaultAvailability[day] = {
          isAvailable: true,
          slots: [{
            startTime: "09:00",
            endTime: "17:00",
            isActive: true
          }]
        };
      });

      serviceProviderData = await ServiceProvider.create({
        user: userId,
        availability: defaultAvailability,
        earnings: 0,
        isVerified: false,
        isActive: true
      });
    }

    // Get provider with services populated
    const providerWithServices = await ServiceProvider.findOne({ user: userId })
      .populate({
        path: "servicesOffered.category",
        model: "Category",
        select: "name description"
      })
      .populate({
        path: "servicesOffered.services.service",
        model: "Service",
        select: "name img price description category"
      })
      .lean();

    // Get all bookings for this provider
    const bookings = await Booking.find({ provider: serviceProviderData._id })
      .populate({
        path: "service",
        select: "name img price description category"
      })
      .populate({
        path: "customer",
        model: "User",
        select: "name email phone profileImage"
      })
      .sort({ createdAt: -1 })
      .lean();

    console.log(`Found ${bookings.length} bookings for provider ${serviceProviderData._id}`);

    // Process bookings to ensure all data is valid
    const processedBookings = bookings.map(booking => {
      const processedBooking = JSON.parse(JSON.stringify(booking));

      // Ensure service data
      if (!processedBooking.service) {
        processedBooking.service = {
          name: 'Unknown Service',
          img: 'https://placehold.co/300x200?text=Unknown+Service',
          price: 0
        };
      } else if (!processedBooking.service.img) {
        processedBooking.service.img = 'https://placehold.co/300x200?text=No+Image';
      }

      // Ensure customer data
      if (!processedBooking.customer) {
        processedBooking.customer = {
          name: 'Unknown Customer',
          profileImage: 'https://placehold.co/100x100?text=Customer'
        };
      } else if (!processedBooking.customer.profileImage ||
        processedBooking.customer.profileImage.includes('data:;base64,=')) {
        processedBooking.customer.profileImage = 'https://placehold.co/100x100?text=Customer';
      }

      // Ensure date fields
      if (!processedBooking.bookingDate && processedBooking.date) {
        processedBooking.bookingDate = processedBooking.date;
      }
      if (!processedBooking.date && processedBooking.bookingDate) {
        processedBooking.date = processedBooking.bookingDate;
      }

      // Add status display text with automation info
      switch (processedBooking.status) {
        case 'pending':
          if (processedBooking.automationStatus?.depositProcessed) {
            processedBooking.statusDisplay = 'Awaiting Provider Confirmation (Deposit Paid)';
          } else {
            processedBooking.statusDisplay = 'Pending Confirmation';
          }
          processedBooking.statusClass = 'text-warning';
          break;
        case 'confirmed':
          if (processedBooking.automationStatus?.depositProcessed) {
            processedBooking.statusDisplay = 'Confirmed (Auto-Payment) - Awaiting Work Completion';
          } else {
            processedBooking.statusDisplay = 'Confirmed - Ready for Work';
          }
          processedBooking.statusClass = 'text-info';
          break;
        case 'completed':
          processedBooking.statusDisplay = 'Work Completed & Paid';
          processedBooking.statusClass = 'text-success';
          break;
        case 'cancelled':
          processedBooking.statusDisplay = 'Cancelled';
          processedBooking.statusClass = 'text-danger';
          break;
        default:
          processedBooking.statusDisplay = 'Unknown';
          processedBooking.statusClass = 'text-muted';
      }

      // Add payout status for provider
      if (processedBooking.status === 'completed') {
        if (processedBooking.providerPayout?.status === 'processed') {
          processedBooking.payoutStatus = 'Paid Out';
          processedBooking.payoutClass = 'badge-success';
        } else if (processedBooking.automationStatus?.providerPayoutScheduled) {
          processedBooking.payoutStatus = 'Auto-Payout Scheduled';
          processedBooking.payoutClass = 'badge-info';
        } else {
          processedBooking.payoutStatus = 'Payout Pending';
          processedBooking.payoutClass = 'badge-warning';
        }
      }

      return processedBooking;
    });

    // Calculate booking statistics
    const bookingStats = {
      total: bookings.length,
      pending: bookings.filter(b => b.status === "pending").length,
      confirmed: bookings.filter(b => b.status === "confirmed").length,
      completed: bookings.filter(b => b.status === "completed").length,
      cancelled: bookings.filter(b => b.status === "cancelled").length,
      increase: await calculateBookingIncrease(serviceProviderData._id)
    };

    // Calculate ratings
    const ratings = await calculateProviderRatings(serviceProviderData._id);

    // Calculate total earnings from completed bookings with automation support
    const completedBookings = bookings.filter(b =>
      b.status === "completed" &&
      b.finalPayment &&
      b.finalPayment.paid
    );

    let totalEarnings = 0;
    let automatedEarnings = 0;

    completedBookings.forEach(booking => {
      if (booking.finalPayment && booking.finalPayment.amount) {
        // Subtract platform commission (10%)
        const commission = booking.commission || Math.round(booking.finalPayment.amount * 0.10);
        const netAmount = booking.finalPayment.amount - commission;
        totalEarnings += netAmount;

        // Track automated earnings
        if (booking.automationStatus?.automationCompleted) {
          automatedEarnings += netAmount;
        }
      }
    });

    // Update provider earnings if changed
    if (totalEarnings !== serviceProviderData.earnings) {
      await ServiceProvider.findByIdAndUpdate(
        serviceProviderData._id,
        { earnings: totalEarnings }
      );
      serviceProviderData.earnings = totalEarnings;
    }

    // Ensure availability data exists
    if (!providerWithServices || !providerWithServices.availability) {
      const defaultAvailability = {};
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
        defaultAvailability[day] = {
          isAvailable: true,
          slots: [{
            startTime: "09:00",
            endTime: "17:00",
            isActive: true
          }]
        };
      });

      await ServiceProvider.findByIdAndUpdate(
        serviceProviderData._id,
        { availability: defaultAvailability }
      );

      if (providerWithServices) {
        providerWithServices.availability = defaultAvailability;
      }
    }

    // Get recent payments for this provider
    const recentPayments = await Payment.find({
      status: 'completed'
    })
      .populate({
        path: 'booking',
        match: { provider: serviceProviderData._id },
        select: 'customer service status createdAt'
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const validPayments = recentPayments.filter(p => p.booking);

    console.log('Provider dashboard stats:', {
      bookings: bookingStats,
      earnings: totalEarnings,
      automatedEarnings,
      ratings
    });

    return {
      provider: providerWithServices || serviceProviderData,
      bookings: processedBookings,
      services: providerWithServices?.servicesOffered || [],
      bookingStats,
      ratings,
      earnings: totalEarnings,
      automatedEarnings,
      recentPayments: validPayments
    };

  } catch (error) {
    console.error('Error fetching provider dashboard data:', error);
    return {
      provider: null,
      bookings: [],
      services: [],
      bookingStats: { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, increase: 0 },
      ratings: { average: 0, total: 0 },
      earnings: 0,
      automatedEarnings: 0,
      recentPayments: []
    };
  }
}

// Helper function to calculate booking increase percentage
async function calculateBookingIncrease(providerId) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthBookings = await Booking.countDocuments({
      provider: providerId,
      createdAt: { $gte: startOfMonth }
    });

    const lastMonthBookings = await Booking.countDocuments({
      provider: providerId,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    if (lastMonthBookings === 0) return thisMonthBookings > 0 ? 100 : 0;
    return Math.round(((thisMonthBookings - lastMonthBookings) / lastMonthBookings) * 100);
  } catch (error) {
    console.error('Error calculating booking increase:', error);
    return 0;
  }
}

// Helper function to calculate provider ratings
async function calculateProviderRatings(providerId) {
  try {
    const bookingsWithRatings = await Booking.find({
      provider: providerId,
      'feedback.rating': { $exists: true, $ne: null }
    }).select('feedback.rating');

    if (bookingsWithRatings.length === 0) {
      return { average: 0, total: 0 };
    }

    const totalRating = bookingsWithRatings.reduce((sum, booking) => {
      return sum + (booking.feedback.rating || 0);
    }, 0);

    return {
      average: Math.round((totalRating / bookingsWithRatings.length) * 10) / 10,
      total: bookingsWithRatings.length
    };
  } catch (error) {
    console.error('Error calculating provider ratings:', error);
    return { average: 0, total: 0 };
  }
}

// Main dashboard route - UPDATED to use req.user instead of session
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const user = req.user; // Use req.user from middleware instead of session
    const userLocation = req.session.userLocation || null;
    console.log('Dashboard accessed by user:', user._id, 'Role:', user.role);

    let data = {};

    if (user.role === "customer") {
      data = await getCustomerDashboardData(user._id);

      res.render("pages/customerDashboard", {
        currUser: user,
        user: user, // Add both for compatibility
        userLocation: userLocation,
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        title: "Customer Dashboard",
        ...data
      });

    } else if (user.role === "provider") {
      data = await getProviderDashboardData(user._id);

      res.render("pages/providerDashboard", {
        currUser: user,
        user: user, // Add both for compatibility
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
        googleMapsId: process.env.GOOGLE_MAPS_ID || '8ae73d86e35053e8',
        title: "Provider Dashboard",
        ...data
      });

    } else if (user.role === "admin") {
      // Admin dashboard
      const totalBookings = await Booking.countDocuments();
      const totalUsers = await User.countDocuments();
      const totalProviders = await ServiceProvider.countDocuments();
      const totalServices = await Service.countDocuments();

      const recentBookings = await Booking.find()
        .populate('customer', 'name email')
        .populate('service', 'name')
        .populate({
          path: 'provider',
          populate: { path: 'user', select: 'name' }
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

      res.render("dashboard/admin", {
        totalBookings,
        totalUsers,
        totalProviders,
        totalServices,
        recentBookings,
        user: user,
        currUser: user,
        title: "Admin Dashboard"
      });
    } else {
      req.flash("error", "Invalid user role");
      return res.redirect("/");
    }
  } catch (err) {
    console.error("Dashboard error:", err);
    req.flash("error", "Error loading dashboard: " + err.message);
    return res.redirect("/");
  }
});

// API endpoint to get fresh booking data (for AJAX updates)
router.get("/api/bookings", isLoggedIn, async (req, res) => {
  try {
    let bookings = [];

    if (req.user.role === "customer") {
      bookings = await Booking.find({ customer: req.user._id })
        .populate('service', 'name img')
        .populate({
          path: 'provider',
          populate: { path: 'user', select: 'name' }
        })
        .sort({ createdAt: -1 })
        .lean();
    } else if (req.user.role === "provider") {
      const provider = await ServiceProvider.findOne({ user: req.user._id });
      if (provider) {
        bookings = await Booking.find({ provider: provider._id })
          .populate('service', 'name img')
          .populate('customer', 'name')
          .sort({ createdAt: -1 })
          .lean();
      }
    }

    res.json({ success: true, bookings });
  } catch (error) {
    console.error("API bookings error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Provider profile routes
router.post('/provider/update-info', isLoggedIn, async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider profile not found'
      });
    }

    if (req.body.experience !== undefined) provider.experience = req.body.experience;
    if (req.body.specialization !== undefined) provider.specialization = req.body.specialization;
    if (req.body.bio !== undefined) provider.bio = req.body.bio;

    await provider.save();

    res.json({
      success: true,
      message: 'Provider information updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update provider information: ' + error.message
    });
  }
});

// Service registration routes
router.get('/registerService', isLoggedIn, async (req, res) => {
  try {
    const categories = await Category.find().lean();
    const services = await Service.find().populate('category').lean();

    res.render('pages/registerService', {
      categories,
      services,
      user: req.user,
      title: 'Register Service'
    });
  } catch (err) {
    req.flash('error', 'Unable to load categories and services');
    res.redirect('/dashboard');
  }
});

router.post("/registerService",
  isLoggedIn, // Add isLoggedIn middleware
  [
    body("serviceCategories").notEmpty().withMessage("Service category is required."),
    body("services").notEmpty().withMessage("Service is required."),
    body("cost").notEmpty().withMessage("Cost is required."),
    body("experience").notEmpty().withMessage("Experience is required.")
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((err) => err.msg);
        req.flash("error", errorMessages.join(", "));
        return res.redirect("/dashboard/registerService");
      }

      const userId = req.user._id; // Use req.user instead of session
      const user = req.user;

      const { serviceCategories, services, cost, experience } = req.body;

      let serviceProvider = await ServiceProvider.findOne({ user: userId });

      if (serviceProvider) {
        const isDuplicate = serviceProvider.servicesOffered.some(offered =>
          offered.services.some(s => s.service.toString() === services)
        );

        if (isDuplicate) {
          req.flash("error", "You have already registered for this service");
          return res.redirect("/dashboard/registerService");
        }

        const existingCategoryIndex = serviceProvider.servicesOffered.findIndex(
          offered => offered.category.toString() === serviceCategories
        );

        if (existingCategoryIndex !== -1) {
          await ServiceProvider.findOneAndUpdate(
            {
              user: userId,
              "servicesOffered.category": serviceCategories
            },
            {
              $push: {
                "servicesOffered.$.services": {
                  service: services,
                  customCost: Number(cost),
                  experience: `${experience} years`
                }
              },
              experience: Number(experience)
            },
            { new: true }
          );
        } else {
          await ServiceProvider.findOneAndUpdate(
            { user: userId },
            {
              $push: {
                servicesOffered: {
                  category: serviceCategories,
                  services: [{
                    service: services,
                    customCost: Number(cost),
                    experience: `${experience} years`
                  }]
                }
              },
              experience: Number(experience)
            },
            { new: true }
          );
        }
      } else {
        serviceProvider = await ServiceProvider.create({
          user: userId,
          servicesOffered: [{
            category: serviceCategories,
            services: [{
              service: services,
              customCost: Number(cost),
              experience: `${experience} years`
            }]
          }],
          experience: Number(experience)
        });
      }

      await Service.findByIdAndUpdate(
        services,
        { $addToSet: { providers: serviceProvider._id } }
      );

      req.flash("success", "Service added successfully!");
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Service registration error:", err);
      req.flash("error", "Failed to register service. Please try again.");
      res.redirect("/dashboard/registerService");
    }
  }
);

// Service management routes
router.post('/service/delete/:id', isLoggedIn, async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { categoryId } = req.body;
    const userId = req.user._id; // Use req.user instead of session

    if (!serviceId || !categoryId) {
      return res.status(400).json({ success: false, message: 'Missing service or category ID' });
    }

    const serviceProvider = await ServiceProvider.findOne({ user: userId });

    if (!serviceProvider) {
      return res.status(404).json({ success: false, message: 'Service provider not found' });
    }

    const categoryIndex = serviceProvider.servicesOffered.findIndex(
      category => category.category.toString() === categoryId
    );

    if (categoryIndex === -1) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    serviceProvider.servicesOffered[categoryIndex].services =
      serviceProvider.servicesOffered[categoryIndex].services.filter(
        service => service._id.toString() !== serviceId
      );

    await serviceProvider.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/service/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;

    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service ID format'
      });
    }

    const service = await Service.findById(serviceId);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({
      success: true,
      service: {
        name: service.name,
        img: service.img,
        price: service.price,
        description: service.description
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update the booking payment routes to support automated payments
router.post('/:id/advance-payment', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to make payment for this booking'
      });
    }

    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Can only make advance payment for pending bookings'
      });
    }

    // Check if this booking was created through automated payment system
    if (booking.automationStatus && booking.automationStatus.depositProcessed) {
      return res.status(400).json({
        success: false,
        error: 'This booking already has automated payment processing'
      });
    }

    booking.advancePayment = {
      paid: true,
      amount: booking.totalCost * 0.15, // 15% advance
      date: new Date()
    };

    booking.paymentStatus = 'partially_paid';
    booking.status = 'confirmed';

    await booking.save();

    res.json({
      success: true,
      message: 'Advance payment completed successfully'
    });
  } catch (error) {
    console.error('Advance payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

router.post('/:id/complete-payment', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to complete payment for this booking'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Can only complete payment for confirmed bookings'
      });
    }

    const remainingAmount = booking.totalCost - (booking.advancePayment?.amount || 0);

    booking.finalPayment = {
      paid: true,
      amount: remainingAmount,
      date: new Date()
    };

    booking.status = 'completed';
    booking.paymentStatus = 'completed';
    booking.completedAt = new Date();

    await booking.save();

    res.json({
      success: true,
      message: 'Final payment completed successfully'
    });
  } catch (error) {
    console.error('Final payment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

// Provider availability management
router.post('/provider/update-availability', isLoggedIn, async (req, res) => {
  try {
    console.log('Updating provider availability:', JSON.stringify(req.body, null, 2));

    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider profile not found'
      });
    }

    // Update overall active status
    provider.isActive = req.body.isActive;

    // Update availability for each day
    if (req.body.availability) {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      // Validate and ensure complete availability data
      days.forEach(day => {
        if (!req.body.availability[day]) {
          req.body.availability[day] = {
            isAvailable: true,
            slots: [{
              startTime: "07:00",
              endTime: "21:00",
              isActive: true
            }]
          };
        }

        // Ensure slots array exists and has at least one entry
        if (!req.body.availability[day].slots || !Array.isArray(req.body.availability[day].slots) || req.body.availability[day].slots.length === 0) {
          req.body.availability[day].slots = [{
            startTime: "07:00",
            endTime: "21:00",
            isActive: true
          }];
        }

        if (req.body.availability[day].isAvailable && req.body.availability[day].slots.length === 0) {
          req.body.availability[day].slots.push({
            startTime: "07:00",
            endTime: "21:00",
            isActive: true
          });
        }

        // Validate each slot has proper format
        req.body.availability[day].slots = req.body.availability[day].slots.map(slot => ({
          startTime: slot.startTime || "07:00",
          endTime: slot.endTime || "21:00",
          isActive: typeof slot.isActive === 'boolean' ? slot.isActive : true
        }));
      });

      // Replace provider's availability with validated data
      provider.availability = req.body.availability;
    }

    await provider.save();

    res.json({
      success: true,
      message: 'Availability settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update availability settings: ' + error.message
    });
  }
});

// Provider service area management
router.post('/provider/update-service-area', isLoggedIn, async (req, res) => {
  try {
    // Find the provider
    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider profile not found'
      });
    }

    // Get and validate the request data
    const radius = parseInt(req.body.radius) || 20;
    const city = req.body.city || '';
    const state = req.body.state || '';
    const pincode = req.body.pincode || '';

    // Create or update service area object
    if (!provider.serviceArea) {
      provider.serviceArea = {};
    }

    // Update service area details
    provider.serviceArea.radius = radius;
    provider.serviceArea.city = city;
    provider.serviceArea.state = state;
    provider.serviceArea.pincode = pincode;

    // Handle coordinates if provided in the request
    if (req.body.latitude && req.body.longitude) {
      const latitude = parseFloat(req.body.latitude);
      const longitude = parseFloat(req.body.longitude);

      // Validate coordinates
      if (!isNaN(latitude) && !isNaN(longitude)) {
        provider.serviceArea.coordinates = {
          latitude,
          longitude
        };
      }
    }
    // If coordinates not provided but user has addresses with coordinates
    else if (!provider.serviceArea.coordinates) {
      const user = await User.findById(req.user._id);
      if (user && user.addresses && user.addresses.length > 0) {
        const defaultAddress = user.addresses.find(addr => addr.isDefault) || user.addresses[0];
        if (defaultAddress.coordinates &&
          defaultAddress.coordinates.latitude &&
          defaultAddress.coordinates.longitude) {
          provider.serviceArea.coordinates = {
            latitude: defaultAddress.coordinates.latitude,
            longitude: defaultAddress.coordinates.longitude
          };
        }
      }
    }

    // Add geocoded data for the provided city/state if missing coordinates
    if (!provider.serviceArea.coordinates && (city || state)) {
      try {
        // You would implement geocoding here if needed
        // This is a placeholder - in production, you'd use a geocoding service
        console.log('Would geocode:', city, state);
      } catch (geocodeError) {
        console.error('Geocoding error:', geocodeError);
      }
    }

    // Save the provider with updated service area
    await provider.save();

    // Return success response
    res.json({
      success: true,
      message: 'Service area updated successfully',
      data: {
        serviceArea: provider.serviceArea
      }
    });
  } catch (error) {
    console.error('Error updating service area:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service area: ' + error.message
    });
  }
});

// Provider location management APIs
router.post('/api/provider/locations', isLoggedIn, async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Validate location data
    const { name, lat, lng, radius } = req.body;

    if (!name || !lat || !lng || !radius) {
      return res.status(400).json({
        success: false,
        message: 'Missing required location data'
      });
    }

    // Convert to proper types
    const location = {
      name: name.trim(),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: parseInt(radius)
    };

    // Validate values
    if (isNaN(location.lat) || isNaN(location.lng) || isNaN(location.radius)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location coordinates or radius'
      });
    }

    // Create serviceAreas array if it doesn't exist
    if (!provider.serviceAreas) {
      provider.serviceAreas = [];
    }

    // Add the new service area
    provider.serviceAreas.push(location);

    // Save the provider
    await provider.save();

    res.json({
      success: true,
      message: 'Service area location added successfully',
      location
    });
  } catch (error) {
    console.error('Error adding service area location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// API endpoint to delete a service area location
router.delete('/api/provider/locations/:id', isLoggedIn, async (req, res) => {
  try {
    const locationId = req.params.id;

    if (!locationId || !mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location ID'
      });
    }

    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    if (!provider.serviceAreas || provider.serviceAreas.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No service areas found'
      });
    }

    // Remove the location
    const locationIndex = provider.serviceAreas.findIndex(area =>
      area._id.toString() === locationId
    );

    if (locationIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Service area location not found'
      });
    }

    provider.serviceAreas.splice(locationIndex, 1);
    await provider.save();

    res.json({
      success: true,
      message: 'Service area location removed successfully'
    });
  } catch (error) {
    console.error('Error removing service area location:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// API endpoint to save travel fee settings
router.post('/api/provider/location-settings', isLoggedIn, async (req, res) => {
  try {
    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider profile not found'
      });
    }

    // Get and validate request data
    const { travelFeeEnabled, travelFeeAmount } = req.body;

    // Update provider with travel fee settings
    provider.travelFeeEnabled = !!travelFeeEnabled; // Convert to boolean

    if (travelFeeAmount !== undefined) {
      const amount = parseFloat(travelFeeAmount);
      if (!isNaN(amount) && amount >= 0) {
        provider.travelFeeAmount = amount;
      }
    }

    await provider.save();

    res.json({
      success: true,
      message: 'Travel fee settings updated successfully',
      data: {
        travelFeeEnabled: provider.travelFeeEnabled,
        travelFeeAmount: provider.travelFeeAmount
      }
    });
  } catch (error) {
    console.error('Error updating travel fee settings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

module.exports = router;