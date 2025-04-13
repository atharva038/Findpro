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

// router.get("/:id/providers", async (req, res) => {
//   try {
//     // Get the service ID from the URL parameter
//     const serviceId = req.params.id;

//     // Fetch the category details from service id
//     const category = await Service.findById(serviceId).select("category");

//     if (!category) {
//       return res
//         .status(404)
//         .render("pages/services", { error: "Category not found." });
//     }

//     // Fetch services that belong to the requested category
//     const services = await Service.find({ category: category.category })
//       .populate("category")
//       .lean();

//     if (!services || services.length === 0) {
//       return res.status(404).render("pages/services", {
//         error: "No services found for this category.",
//       });
//     }

//     // Find providers who offer these services
//     const providers = await ServiceProvider.find({
//       servicesOffered: { $in: serviceId },
//     })
//       .populate("user") // Assuming 'user' is a reference to provider details
//       .populate("servicesOffered")
//       .lean(); // Use lean for better performance

//     if (!providers || providers.length === 0) {
//       return res.status(404).render("pages/providers", {
//         error: "No providers found for this category.",
//       });
//     }

//     // Render the providers list page, passing the providers and category
//     res.render("pages/providers", { providers, category, services, serviceId });
//   } catch (err) {
//     console.error("Error fetching providers:", err);
//     res.status(500).send("Server error");
//   }
// });

router.get("/:id/providers", async (req, res) => {
  try {
    // Get the service ID from the URL parameter
    const serviceId = req.params.id;

    // Fetch the service and populate its category
    const service = await Service.findById(serviceId).populate("category");

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/services");
    }

    // Find providers who offer this service
    const providers = await ServiceProvider.find({
      servicesOffered: serviceId
    })
      .populate("user")
      .populate("portfolio")
      .lean();

    // Render the providers page with all necessary data
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
router.get("/:id/:provider/book", async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.isAuthenticated()) {
      req.flash("error", "You must be logged in to book a service.");
      return res.redirect("back"); // Redirects to the previous page
    }

    // Extract service and provider IDs from the URL
    const { id: serviceId, provider: providerId } = req.params;

    // Fetch the specific service by ID
    const service = await Service.findById(serviceId)
      .populate("category")
      .lean();

    if (!service) {
      return res
        .status(404)
        .render("pages/services", { error: "Service not found." });
    }

    // Fetch the specific provider by ID
    const provider = await ServiceProvider.findById(providerId)
      .populate("user") // Assuming 'user' has provider details
      .populate("servicesOffered")
      .lean();

    if (!provider) {
      return res
        .status(404)
        .render("pages/services", { error: "Provider not found." });
    }

    // Fetch the user's saved addresses
    const user = await User.findById(req.user._id).lean(); // Ensure user is authenticated
    const addresses = user ? user.addresses : []; // Get saved addresses if they exist

    // Render the booking page with the fetched service, provider, and addresses
    res.render("pages/booking", { service, provider, addresses });
  } catch (error) {
    console.error("Error fetching service or provider:", error);
    res.status(500).send("Server error");
  }
});

// Route for customers to book a service
router.post("/book/:serviceId", async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    if (!service) {
      return res.status(404).send("Service not found");
    }

    const booking = new Booking({
      customer: req.user.id, // Assuming customer is logged in
      service: req.params.serviceId,
      provider: service.provider,
    });

    await booking.save();
    res.redirect("/bookings");
  } catch (err) {
    res.status(500).send("Server error");
  }
});
module.exports = router;
