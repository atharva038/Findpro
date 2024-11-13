const express = require("express");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const { body, validationResult } = require("express-validator");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.session.userId; // Get the current logged-in user's ID
    const user = await User.findById(userId); // Find the user
    if (!user) {
      req.flash("error", "User not found.");
      return res.redirect("/login");
    }

    // Fetch services associated with the current provider
    const services = await ServiceProvider.find({ user: userId }).populate(
      "servicesOffered"
    );

    let bookings = [];

    if (user.role == "customer") {
      bookings = await Booking.find({ customer: userId })
        .populate("service")
        .populate({
          path: "provider",
          populate: { path: "user" }, // Populate the user inside provider
        });
      res.render("pages/customerDashboard", {
        services,
        bookings,
        currUser: user,
      });
    } else if (user.role == "provider") {

      // Directly get the provider's _id
      // const provider = await ServiceProvider.findOne({ user:  });
      // if (!provider) {
      //   req.flash("error", "Provider not found.");
      //   return res.redirect("/login");
      // }

      // Fetch bookings for the provider using provider._id
      bookings = await Booking.find({ providerUserId: userId })
        .populate("service customer")
        .populate({
          path: "provider",
          populate: { path: "user" }, // Populate the user inside providerId
        });

      console.log("Provider id: ",userId);
      console.log("Bookings:", bookings);
      res.render("pages/providerDashboard", {
        services,
        bookings,
        currUser: user,
      });
    }
  } catch (err) {
    console.error("Error fetching provider's services:", err);
    req.flash("error", "Server error. Please try again later.");
    res.redirect("/login");
  }
});

router.get("/registerService", (req, res) => {
  if (!req.isAuthenticated()) {
    req.flash("error", "you must be logged in to register for new service");
    console.log("log in");
    return res.redirect("/registerService");
  }
  res.render("pages/registerService");
});

router.post(
  "/registerService",
  [
    body("serviceCategories")
      .notEmpty()
      .withMessage("Service category is required."),
    body("services").notEmpty().withMessage("Service is required."),
    body("cost").isNumeric().withMessage("Cost must be a valid number."),
    body("experience").notEmpty().withMessage("Experience is required."),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map((err) => err.msg);
      req.flash("error", errorMessages.join(", "));
      return res.redirect("/registerService");
    }
    const userId = req.session.userId;
    const user = await User.findById(userId);

    const { serviceCategories, services, cost, experience } = req.body;
    const { addresses } = user.addresses;

    try {
      // Fetch the user to ensure they exist

      if (!user) {
        req.flash("error", "User not found.");
        return res.redirect("/login");
      }

      // Fetch category IDs based on category names
      const categoryIds = await Service.find({
        name: { $in: serviceCategories },
      })
        .select("category")
        .exec();

      // Fetch service IDs based on service names
      const serviceIds = await Service.find({ name: { $in: services } })
        .select("_id")
        .exec();

      // Create new service provider entry
      const newServiceProvider = new ServiceProvider({
        user: userId, // Link to the authenticated provider
        servicesOffered: serviceIds.map((service) => service._id), // Convert to ObjectId array
        experience: experience, // The experience as a number
        cost: cost,
        serviceCategories: categoryIds.map((category) => category._id), // Convert to ObjectId array
        addresses: addresses, // Ensure addresses is an array or default to empty,
        portfolio: [], // Initialize with an empty array or modify as needed
      });
      // Save the new service provider to the database
      await newServiceProvider.save();

      req.flash("success", "Service registered successfully!");
      res.redirect("/services");
    } catch (err) {
      console.error("Error registering service provider:", err);
      req.flash("error", "Server error. Please try again later.");
      res.redirect("/dashboard/registerService");
    }
  }
);

module.exports = router;
