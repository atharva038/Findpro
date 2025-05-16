const express = require("express");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Category = require("../models/category");
const { body, validationResult } = require("express-validator");
const { isLoggedIn } = require("../middleware");
const router = express.Router();
const mongoose = require("mongoose");

// Helper functions for dashboard data
async function getCustomerDashboardData(userId) {
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
    services: []
  };
}

async function getProviderDashboardData(userId) {
  let serviceProviderData = await ServiceProvider.findOne({ user: userId });

  if (!serviceProviderData) {
    // Create default availability for each day
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
      servicesOffered: [],
      experience: 0,
      isActive: true,
      availability: defaultAvailability,
      earnings: 0
    });
  }

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

  const processedBookings = bookings.map(booking => {
    const processedBooking = JSON.parse(JSON.stringify(booking));

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

  const bookingStats = {
    total: bookings.length,
    ongoing: bookings.filter(b => b.status === "confirmed").length,
    completed: bookings.filter(b => b.status === "completed").length,
    pending: bookings.filter(b => b.status === "pending").length,
    cancelled: bookings.filter(b => b.status === "cancelled").length,
    increase: await calculateBookingIncrease(serviceProviderData._id)
  };

  const ratings = await calculateProviderRatings(serviceProviderData._id);

  // Calculate total earnings from completed bookings
  const totalEarnings = bookings
    .filter(b => b.status === "completed" && b.finalPayment && b.finalPayment.paid)
    .reduce((sum, booking) => sum + (booking.finalPayment.amount || 0), 0);

  // Update provider earnings if there are completed bookings
  if (totalEarnings > 0 && totalEarnings !== serviceProviderData.earnings) {
    await ServiceProvider.findByIdAndUpdate(
      serviceProviderData._id,
      { earnings: totalEarnings }
    );
  }

  // Ensure availability data is properly structured
  if (!providerWithServices.availability) {
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

    // Add availability to the provider object for rendering
    providerWithServices.availability = defaultAvailability;
  }

  return {
    provider: providerWithServices || serviceProviderData,
    bookings: processedBookings,
    services: providerWithServices?.servicesOffered || [],
    bookingStats,
    ratings
  };
}

async function calculateBookingIncrease(providerId) {
  return 10;
}

async function calculateProviderRatings(providerId) {
  return {
    average: 4.7,
    count: 24
  };
}

// Main dashboard route
router.get("/", isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId);

    if (!user) {
      req.flash("error", "User not found");
      return res.redirect("/login");
    }

    if (user.role === "customer") {
      const data = await getCustomerDashboardData(userId);
      return res.render("pages/customerDashboard", {
        currUser: user,
        ...data
      });
    } else if (user.role === "provider") {
      const data = await getProviderDashboardData(userId);
      return res.render("pages/providerDashboard", {
        currUser: user,
        ...data
      });
    } else {
      req.flash("error", "Invalid user role");
      return res.redirect("/");
    }
  } catch (err) {
    req.flash("error", "Error loading dashboard: " + err.message);
    return res.redirect("/");
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
router.get('/registerService', async (req, res) => {
  try {
    const categories = await Category.find().lean();
    const services = await Service.find().populate('category').lean();

    res.render('pages/registerService', {
      categories,
      services,
      title: 'Register Service'
    });
  } catch (err) {
    req.flash('error', 'Unable to load categories and services');
    res.redirect('/dashboard');
  }
});

router.post("/registerService",
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

// Booking payment routes
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

    booking.finalPayment = {
      paid: true,
      amount: booking.totalCost * 0.9,
      date: new Date()
    };

    booking.status = 'completed';
    booking.paymentStatus = 'completed';

    await booking.save();

    res.json({
      success: true,
      message: 'Payment completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

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

    booking.advancePayment = {
      paid: true,
      amount: booking.totalCost * 0.1,
      date: new Date()
    };

    booking.paymentStatus = 'partially_paid';

    await booking.save();

    res.json({
      success: true,
      message: 'Advance payment completed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process payment'
    });
  }
});

// Update or add the following route for availability changes

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
              startTime: "09:00",
              endTime: "17:00",
              isActive: true
            }]
          };
        }
        
        // Ensure slots array exists and has at least one entry
        if (!req.body.availability[day].slots || !Array.isArray(req.body.availability[day].slots)) {
          req.body.availability[day].slots = [{
            startTime: "09:00",
            endTime: "17:00",
            isActive: true
          }];
        }
        
        // If day is available but no slots, add default
        if (req.body.availability[day].isAvailable && req.body.availability[day].slots.length === 0) {
          req.body.availability[day].slots.push({
            startTime: "09:00",
            endTime: "17:00",
            isActive: true
          });
        }
        
        // Validate each slot has proper format
        req.body.availability[day].slots = req.body.availability[day].slots.map(slot => ({
          startTime: slot.startTime || "09:00",
          endTime: slot.endTime || "17:00",
          isActive: typeof slot.isActive === 'boolean' ? slot.isActive : true
        }));
      });
      
      // Replace provider's availability with validated data
      provider.availability = req.body.availability;
    }

    await provider.save();
    console.log('Provider availability saved successfully');

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

module.exports = router;