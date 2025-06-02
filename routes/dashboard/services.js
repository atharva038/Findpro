const express = require("express");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const Category = require("../../models/category");
const User = require("../../models/User");
const { isLoggedIn } = require("../../middleware");

const router = express.Router();

// Get service registration page
router.get("/registerService", async (req, res) => {
  try {
    const categories = await Category.find().lean();
    const services = await Service.find().populate("category").lean();

    res.render("pages/registerService", {
      categories,
      services,
      title: "Register Service",
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Unable to load categories and services");
    res.redirect("/dashboard");
  }
});

// Register a new service
router.post("/registerService", async (req, res) => {
  // Check authentication
  if (!req.isAuthenticated()) {
    return res.status(401).json({
      success: false,
      message: "Session expired. Please login again."
    });
  }

  // Always set JSON content type
  res.setHeader('Content-Type', 'application/json');

  try {
    const { serviceCategories, services, cost, experience } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!serviceCategories || !services || !cost || !experience) {
      return res.json({
        success: false,
        message: "All fields are required"
      });
    }

    let serviceProvider = await ServiceProvider.findOne({ user: userId });

    if (!serviceProvider) {
      serviceProvider = new ServiceProvider({
        user: userId,
        servicesOffered: []
      });
    }

    // Add the new service
    const serviceData = {
      category: serviceCategories,
      services: [{
        service: services,
        customCost: Number(cost),
        experience: experience
      }]
    };

    const existingCategoryIndex = serviceProvider.servicesOffered.findIndex(
      offered => offered.category.toString() === serviceCategories
    );

    if (existingCategoryIndex > -1) {
      serviceProvider.servicesOffered[existingCategoryIndex].services.push(serviceData.services[0]);
    } else {
      serviceProvider.servicesOffered.push(serviceData);
    }

    await serviceProvider.save();

    return res.json({
      success: true,
      message: "Service added successfully"
    });

  } catch (error) {
    console.error("Service registration error:", error);
    return res.json({
      success: false,
      message: error.message || "Failed to register service"
    });
  }
});

// Delete a service
router.post("/delete/:id", async (req, res) => {
  try {
    const serviceId = req.params.id;
    const { categoryId } = req.body;
    const userId = req.session.userId;

    if (!serviceId || !categoryId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing service or category ID" });
    }

    const serviceProvider = await ServiceProvider.findOne({ user: userId });

    if (!serviceProvider) {
      return res
        .status(404)
        .json({ success: false, message: "Service provider not found" });
    }

    const categoryIndex = serviceProvider.servicesOffered.findIndex(
      (category) => category.category.toString() === categoryId
    );

    if (categoryIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "Category not found" });
    }

    serviceProvider.servicesOffered[categoryIndex].services =
      serviceProvider.servicesOffered[categoryIndex].services.filter(
        (service) => service._id.toString() !== serviceId
      );

    await serviceProvider.save();

    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting service:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get service by ID (for AJAX)
router.get("/:id", async (req, res) => {
  try {
    const serviceId = req.params.id;

    // Check if ID is valid before querying
    if (
      !serviceId ||
      serviceId === "undefined" ||
      serviceId === "null" ||
      serviceId === "[object Object]" ||
      !mongoose.Types.ObjectId.isValid(serviceId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID format",
      });
    }

    const service = await Service.findById(serviceId);

    if (!service) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }

    res.json({
      success: true,
      service: {
        name: service.name,
        img: service.img,
        price: service.price,
        description: service.description,
      },
    });
  } catch (err) {
    console.error("Error fetching service:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
