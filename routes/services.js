const express = require("express");
const Service = require("../models/Service");
const User = require("../models/User");
const Category = require("../models/category");
const ServiceProvider = require("../models/ServiceProvider");
const router = express.Router();
const mongoose = require("mongoose");

router.get("/", async (req, res) => {
  try {
    // Fetch all categories with their images
    const categories = await Category.find();

    // Render the services page with the category data
    res.render("pages/service", { categories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// Route to list services by specific category
router.get("/:id", async (req, res) => {
  try {
    // Get the category ID from the URL parameter
    const categoryId = req.params.id;

    // Fetch the category details
    const category = await Category.findById(categoryId);

    if (!category) {
      return res
        .status(404)
        .render("pages/services", { error: "Category not found." });
    }

    // Fetch services that belong to the requested category
    const services = await Service.find({ category: categoryId }).populate(
      "category"
    );

    // Check if there are services for this category
    if (services.length === 0) {
      return res
        .status(404)
        .render("pages/services", { services: [], category });
    }

    // Render the services page with the list of services under that category
    res.render("pages/services", { services, category });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

router.get("/:id/providers", async (req, res) => {
  try {
    const serviceId = req.params.id;

    // Fetch the service and its category
    const service = await Service.findById(serviceId).populate("category");

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/services");
    }

    // Find all providers who offer this specific service
    const providers = await ServiceProvider.find({
      "servicesOffered.services.service": serviceId
    })
      .populate({
        path: 'user',
        select: 'name profileImage addresses phone' // Include profileImage in selection
      })
      .lean();

    // Add fallback image if profileImage is not available
    providers.forEach(provider => {
      if (!provider.user.profileImage) {
        provider.user.profileImage = 'https://cdn-icons-png.flaticon.com/512/4202/4202841.png';
      }
    });

    res.render("pages/providers", {
      providers,
      service,
      category: service.category,
      serviceId
    });

  } catch (err) {
    console.error("Error fetching providers:", err);
    req.flash("error", "Unable to load providers");
    res.redirect("/services");
  }
});

// router.get("/:id/:provider/book", async (req, res) => {
//   try {
//     // Check if the user is authenticated
//     if (!req.isAuthenticated()) {
//       req.flash("error", "You must be logged in to book a service.");
//       return res.redirect("back"); // Redirects to the previous page
//     }

//     // Extract service and provider IDs from the URL
//     const { id: serviceId, provider: providerId } = req.params;

//     // Fetch the specific service by ID
//     const service = await Service.findById(serviceId)
//       .populate("category")
//       .lean();

//     if (!service) {
//       return res
//         .status(404)
//         .render("pages/services", { error: "Service not found." });
//     }

//     // Fetch the specific provider by ID
//     const provider = await ServiceProvider.findById(providerId)
//       .populate("user") // Assuming 'user' has provider details
//       .populate("servicesOffered")
//       .lean();

//     if (!provider) {
//       return res
//         .status(404)
//         .render("pages/services", { error: "Provider not found." });
//     }

//     // Fetch the user's saved addresses
//     const user = await User.findById(req.user._id).lean(); // Ensure user is authenticated
//     const addresses = user ? user.addresses : []; // Get saved addresses if they exist

//     // Render the booking page with the fetched service, provider, and addresses
//     res.render("pages/booking", { service, provider, addresses });
//   } catch (error) {
//     console.error("Error fetching service or provider:", error);
//     res.status(500).send("Server error");
//   }
// });

// // Route for customers to book a service
// router.post("/book/:serviceId", async (req, res) => {
//   try {
//     const service = await Service.findById(req.params.serviceId);
//     if (!service) {
//       return res.status(404).send("Service not found");
//     }

//     const booking = new Booking({
//       customer: req.user.id, // Assuming customer is logged in
//       service: req.params.serviceId,
//       provider: service.provider,
//     });

//     await booking.save();
//     res.redirect("/bookings");
//   } catch (err) {
//     res.status(500).send("Server error");
//   }
// });
// Update the book route
router.get("/:id/:provider/book", async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
      req.flash("error", "You must be logged in to book a service.");
      return res.redirect(req.get("Referrer") || "/"); // Updated redirect
    }

    const { id: serviceId, provider: providerId } = req.params;

    // Fetch service and provider
    const [service, provider] = await Promise.all([
      Service.findById(serviceId).populate("category").lean(),
      ServiceProvider.findById(providerId)
        .populate("user")
        .populate("servicesOffered.services.service")
        .lean()
    ]);

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/services");
    }

    if (!provider) {
      req.flash("error", "Provider not found");
      return res.redirect("/services");
    }

    // Find the specific service details from provider's servicesOffered
    let serviceDetails = null;
    provider.servicesOffered.forEach(category => {
      category.services.forEach(s => {
        if (s.service._id.toString() === serviceId) {
          serviceDetails = s;
        }
      });
    });

    // If service details not found
    if (!serviceDetails) {
      req.flash("error", "Service details not found");
      return res.redirect("/services");
    }

    // Fetch user addresses
    const user = await User.findById(req.user._id).lean();
    const addresses = user ? user.addresses : [];

    // Add custom cost to service object
    service.cost = serviceDetails.customCost;
    service.providerExperience = serviceDetails.experience;

    res.render("pages/booking", {
      service,
      provider,
      addresses,
      serviceDetails
    });
  } catch (error) {
    console.error("Error fetching service or provider:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/services");
  }
});
module.exports = router;
