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
    const service = await Service.findById(serviceId).populate("category").lean();

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/services");
    }

    // Get the selected date and time from query params (if provided)
    let selectedDate = req.query.date ? new Date(req.query.date) : new Date();
    let selectedTime = req.query.time || "";

    // Find providers who offer this service 
    const providers = await ServiceProvider.find({
      // Only find active providers
      isActive: true,
      // Find providers who offer this service
      "servicesOffered.services.service": serviceId
    })
      .populate({
        path: "user",
        select: 'name profileImage addresses phone'
      })
      .lean();

    // Debug information
    console.log(`Found ${providers.length} providers for service ${serviceId}`);

    // Filter providers based on availability
    const availableProviders = providers.filter(provider => {
      // If no availability data, assume available
      if (!provider.availability) {
        console.log(`Provider ${provider._id} has no availability data, assuming available`);
        return true;
      }

      // Get day of week
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];
      console.log(`Checking availability for ${dayOfWeek}`);

      // Check if provider is available on this day
      const dayAvailability = provider.availability[dayOfWeek];
      if (!dayAvailability) {
        console.log(`Provider ${provider._id} has no data for ${dayOfWeek}`);
        return false;
      }

      if (!dayAvailability.isAvailable) {
        console.log(`Provider ${provider._id} is not available on ${dayOfWeek}`);
        return false;
      }

      // If no specific time requested, consider available if the day is available
      if (!selectedTime) {
        console.log(`No specific time requested, provider ${provider._id} is available on ${dayOfWeek}`);
        return true;
      }

      // Check if provider has any active slot that includes the requested time
      try {
        const requestedHour = parseInt(selectedTime.split(':')[0]);
        const requestedMinute = parseInt(selectedTime.split(':')[1] || '0');

        console.log(`Checking if time ${requestedHour}:${requestedMinute} is in any active slot`);

        // Make sure slots exist
        if (!dayAvailability.slots || !Array.isArray(dayAvailability.slots) || dayAvailability.slots.length === 0) {
          console.log(`Provider ${provider._id} has no slots for ${dayOfWeek}`);
          return false;
        }

        const available = dayAvailability.slots.some(slot => {
          // Skip if slot is not active or missing critical data
          if (!slot || !slot.isActive || !slot.startTime || !slot.endTime) {
            console.log('Slot is inactive or missing data', slot);
            return false;
          }

          try {
            const startHour = parseInt(slot.startTime.split(':')[0]);
            const startMinute = parseInt(slot.startTime.split(':')[1] || '0');
            const endHour = parseInt(slot.endTime.split(':')[0]);
            const endMinute = parseInt(slot.endTime.split(':')[1] || '0');

            // Convert to minutes for easier comparison
            const requestedTimeInMinutes = requestedHour * 60 + requestedMinute;
            const startTimeInMinutes = startHour * 60 + startMinute;
            const endTimeInMinutes = endHour * 60 + endMinute;

            const isInSlot = requestedTimeInMinutes >= startTimeInMinutes && requestedTimeInMinutes <= endTimeInMinutes;
            console.log(`Slot ${startHour}:${startMinute} - ${endHour}:${endMinute} is ${isInSlot ? 'available' : 'not available'} for ${requestedHour}:${requestedMinute}`);

            return isInSlot;
          } catch (error) {
            console.error(`Error parsing time slot: ${error.message}`, slot);
            return false;
          }
        });

        console.log(`Provider ${provider._id} is ${available ? 'available' : 'not available'} at requested time`);
        return available;
      } catch (error) {
        console.error(`Error checking time availability: ${error.message}`);
        // If there's an error in time parsing, let's be lenient and show the provider
        return true;
      }
    });

    console.log(`After filtering, ${availableProviders.length} providers are available`);

    // Add fallback image if user or profileImage is not available
    availableProviders.forEach(provider => {
      if (!provider.user || !provider.user.profileImage) {
        if (!provider.user) {
          provider.user = {};
        }
        provider.user.profileImage = 'https://cdn-icons-png.flaticon.com/512/4202/4202841.png';
      }
    });

    res.render("pages/providers", {
      providers: availableProviders,
      service,
      category: service.category,
      serviceId,
      selectedDate: selectedDate.toISOString().split('T')[0],
      selectedTime
    });

  } catch (err) {
    console.error("Error fetching providers:", err);
    req.flash("error", "Unable to load providers");
    res.redirect("/services");
  }
});
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
