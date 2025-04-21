const express = require("express");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Category = require("../models/category");
const { body, validationResult } = require("express-validator");
const { isLoggedIn } = require("../middleware")
const router = express.Router();
const mongoose = require("mongoose");

// Helper functions for dashboard data
async function getCustomerDashboardData(userId) {
  // Get customer's bookings
  const bookings = await Booking.find({ customer: userId })
    .populate("service")
    .populate({
      path: "provider",
      populate: { path: "user" }
    })
    .sort({ bookingDate: -1 })
    .lean();

  return {
    bookings,
    services: [] // Customer doesn't need services yet
  };
}

async function getProviderDashboardData(userId) {
  // Get provider profile or create if it doesn't exist
  let serviceProviderData = await ServiceProvider.findOne({ user: userId });

  if (!serviceProviderData) {
    serviceProviderData = await ServiceProvider.create({
      user: userId,
      servicesOffered: [],
      experience: 0
    });
  }

  // Get provider's service offerings with proper population
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

  // Get provider's bookings with better population for images
  const bookings = await Booking.find({ provider: serviceProviderData._id })
    .populate({
      path: "service",
      select: "name img price description"
    })
    .populate({
      path: "customer",
      model: "User",
      select: "name email phone profileImage"
    })
    .sort({ bookingDate: -1 })
    .lean();

  // Process bookings to ensure image URLs are valid
  const processedBookings = bookings.map(booking => {
    // Create a deep copy to avoid modifying the cached data
    const processedBooking = JSON.parse(JSON.stringify(booking));

    // Only use fallback if image is completely missing
    if (processedBooking.service) {
      if (!processedBooking.service.img) {
        processedBooking.service.img = 'https://placehold.co/300x200?text=No+Image';
      }
    } else {
      processedBooking.service = {
        name: 'Unknown Service',
        img: 'https://placehold.co/300x200?text=Unknown+Service'
      };
    }

    // Only use fallback if customer image is completely missing
    if (processedBooking.customer) {
      if (!processedBooking.customer.profileImage) {
        processedBooking.customer.profileImage = 'https://placehold.co/100x100?text=User';
      }
    } else {
      processedBooking.customer = {
        name: 'Unknown Customer',
        profileImage: 'https://placehold.co/100x100?text=Unknown+User'
      };
    }

    return processedBooking;
  });


  // Calculate booking statistics
  const bookingStats = {
    total: bookings.length,
    ongoing: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    pending: bookings.filter(b => b.status === "pending").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
    increase: await calculateBookingIncrease(serviceProviderData._id)
  };

  // Get ratings
  const ratings = await calculateProviderRatings(serviceProviderData._id);

  return {
    provider: providerWithServices || serviceProviderData,
    bookings: processedBookings,
    services: providerWithServices?.servicesOffered || [],
    bookingStats,
    ratings
  };
}

// Calculate booking increase percentage (mock implementation)
async function calculateBookingIncrease(providerId) {
  // This is a placeholder. In a real implementation:
  // 1. Get current month bookings count
  // 2. Get last month bookings count
  // 3. Calculate percentage increase
  return 10; // Mock 10% increase
}

// Calculate provider ratings (mock implementation)
async function calculateProviderRatings(providerId) {
  // This is a placeholder. In a real implementation:
  // 1. Query actual reviews/ratings for this provider
  // 2. Calculate average rating and count
  return {
    average: 4.7,
    count: 24
  };
}

router.post('/provider/update-info', isLoggedIn, async (req, res) => {
  try {
    // Make sure we're using the correct model name here
    const provider = await ServiceProvider.findOne({ user: req.user._id });

    if (!provider) {
      return res.status(404).json({
        success: false,
        error: 'Provider profile not found'
      });
    }

    // Update provider fields if they are provided in the request
    if (req.body.experience !== undefined) provider.experience = req.body.experience;
    if (req.body.specialization !== undefined) provider.specialization = req.body.specialization;
    if (req.body.bio !== undefined) provider.bio = req.body.bio;

    await provider.save();

    res.json({
      success: true,
      message: 'Provider information updated successfully'
    });
  } catch (error) {
    console.error('Error updating provider information:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update provider information: ' + error.message
    });
  }
});
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/login");
    }

    // Handle different dashboard types based on user role
    if (user.role === "customer") {
      // CUSTOMER DASHBOARD
      const data = await getCustomerDashboardData(userId);

      return res.render("pages/customerDashboard", {
        currUser: user,
        ...data
      });

    } else if (user.role === "provider") {
      // PROVIDER DASHBOARD
      const data = await getProviderDashboardData(userId);

      return res.render("pages/providerDashboard", {
        currUser: user,
        ...data
      });

    } else {
      // ADMIN OR OTHER ROLE
      req.flash("error", "Invalid user role");
      return res.redirect("/");
    }

  } catch (err) {
    console.error("Dashboard error:", err);
    req.flash("error", "Error loading dashboard: " + err.message);
    return res.redirect("/");
  }
});


// Add this to your dashboard.js
router.post('/service/delete/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { categoryId } = req.body;
    const userId = req.session.userId;

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
    console.error('Error deleting service:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



// Add this route to fetch service details by ID
router.get('/service/:id', async (req, res) => {
  try {
    const serviceId = req.params.id;

    // Check if ID is valid before querying
    if (!serviceId || serviceId === 'undefined' || serviceId === 'null' ||
      serviceId === '[object Object]' || !mongoose.Types.ObjectId.isValid(serviceId)) {
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
    console.error('Error fetching service:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// Add this route to the existing bookings API file

// Mark booking as completed and process final payment
router.post('/:id/complete-payment', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Verify that the user is the customer for this booking
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to complete payment for this booking'
      });
    }

    // Check if booking status allows payment
    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        error: 'Can only complete payment for confirmed bookings'
      });
    }

    // Process payment (this would connect to payment gateway in production)
    // For now, just mark as paid
    booking.finalPayment = {
      paid: true,
      amount: booking.totalCost * 0.9, // 90% of total cost
      date: new Date()
    };

    // Update booking status
    booking.status = 'completed';
    booking.paymentStatus = 'completed';

    await booking.save();

    res.json({
      success: true,
      message: 'Payment completed successfully'
    });
  } catch (error) {
    console.error('Error completing payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

// Route to handle advance payment (for pending bookings)
router.post('/:id/advance-payment', isLoggedIn, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }

    // Verify that the user is the customer for this booking
    if (booking.customer.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to make payment for this booking'
      });
    }

    // Check if booking status allows payment
    if (booking.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Can only make advance payment for pending bookings'
      });
    }

    // Process payment (this would connect to payment gateway in production)
    // For now, just mark as paid
    booking.advancePayment = {
      paid: true,
      amount: booking.totalCost * 0.1, // 10% of total cost
      date: new Date()
    };

    booking.paymentStatus = 'partially_paid';

    await booking.save();

    res.json({
      success: true,
      message: 'Advance payment completed successfully'
    });
  } catch (error) {
    console.error('Error processing advance payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});
router.get('/registerService',
  async (req, res) => {
    try {
      const categories = await Category.find().lean();
      const services = await Service.find().populate('category').lean();

      res.render('pages/registerService', {
        categories,
        services,
        title: 'Register Service'
      });
    } catch (err) {
      console.error(err);
      req.flash('error', 'Unable to load categories and services');
      res.redirect('/dashboard');
    }
  });



router.post(
  "/registerService",
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

      const userId = req.session.userId;
      const user = await User.findById(userId);
      if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
      }

      const { serviceCategories, services, cost, experience } = req.body;

      // Find existing service provider or create new one
      let serviceProvider = await ServiceProvider.findOne({ user: userId });

      if (serviceProvider) {
        // Check if this service is already registered
        const isDuplicate = serviceProvider.servicesOffered.some(offered =>
          offered.services.some(s => s.service.toString() === services)
        );

        if (isDuplicate) {
          req.flash("error", "You have already registered for this service");
          return res.redirect("/dashboard/registerService");
        }

        // Check if category already exists in servicesOffered
        const existingCategoryIndex = serviceProvider.servicesOffered.findIndex(
          offered => offered.category.toString() === serviceCategories
        );

        if (existingCategoryIndex !== -1) {
          // Category exists, add service to existing category
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
          // Category doesn't exist, create new category entry
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
        // Create new service provider
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

      // Add this provider to the Service
      await Service.findByIdAndUpdate(
        services,
        { $addToSet: { providers: serviceProvider._id } }
      );

      req.flash("success", "Service added successfully!");
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Error registering service:", err);
      req.flash("error", "Failed to register service. Please try again.");
      res.redirect("/dashboard/registerService");
    }
  }
);
module.exports = router;
