const express = require("express");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const Booking = require("../models/Booking");
const Category = require("../models/category");
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
      const { profileImage, name } = req.body;

      // Update user document with new profile image and name
      await User.findByIdAndUpdate(userId, { profileImage, name });


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
        user,
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

// router.post(
//   "/registerService",
//   [
//     body("serviceCategories")
//       .notEmpty()
//       .withMessage("Service category is required."),
//     body("services").notEmpty().withMessage("Service is required."),
//     body("cost").isNumeric().withMessage("Cost must be a valid number."),
//     body("experience").notEmpty().withMessage("Experience is required."),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       const errorMessages = errors.array().map((err) => err.msg);
//       req.flash("error", errorMessages.join(", "));
//       return res.redirect("/registerService");
//     }
//     const userId = req.session.userId;
//     const user = await User.findById(userId);

//     const { serviceCategories, services, cost, experience } = req.body;
//     //  const addresses = user.addresses || []; // Ensure addresses is an array or default to empty

//     try {
//       // Fetch the user to ensure they exist

//       if (!user) {
//         req.flash("error", "User not found.");
//         return res.redirect("/login");
//       }

//       // Fetch category IDs based on category names
//       const categoryIds = await Service.find({
//         name: { $in: serviceCategories },
//       })
//         .select("category")
//         .exec();

//       // Fetch service IDs based on service names
//       const serviceIds = await Service.find({ name: { $in: services } })
//         .select("_id")
//         .exec();

//       // Create new service provider entry
//       const newServiceProvider = new ServiceProvider({
//         user: userId, // Link to the authenticated provider
//         servicesOffered: serviceIds.map((service) => service._id), // Convert to ObjectId array
//         experience: experience, // The experience as a number
//         cost: cost,
//         serviceCategories: categoryIds.map((category) => category._id), // Convert to ObjectId array
//         // addresses: addresses, // Ensure addresses is an array or default to empty,
//         portfolio: [], // Initialize with an empty array or modify as needed
//       });
//       // Save the new service provider to the database
//       await newServiceProvider.save();

//       req.flash("success", "Service registered successfully!");
//       res.redirect("/services");
//     } catch (err) {
//       console.error("Error registering service provider:", err);
//       req.flash("error", "Server error. Please try again later.");
//       res.redirect("/dashboard/registerService");
//     }
//   }
// );


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
