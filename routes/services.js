const express = require("express");
const Service = require("../models/Service");
const User = require("../models/User");
const Category = require("../models/category");
const ServiceProvider = require("../models/ServiceProvider");
const router = express.Router();
const calculateDistance = require('../utils/distance');

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


// Inside your /:id/providers route handler:
router.get("/:id/providers", async (req, res) => {
  try {
    const serviceId = req.params.id;
    const service = await Service.findById(serviceId).populate("category").lean();

    if (!service) {
      req.flash("error", "Service not found");
      return res.redirect("/services");
    }
    // Get user location from different sources with priority
    let userLocation = null;

    // 1. Try to get from the session (most recent)
    if (req.session.currentLocation) {
      userLocation = req.session.currentLocation;
    }
    // 2. If logged in, try to get from the user's default address
    else if (req.user) {
      const user = await User.findById(req.user._id);

      if (user) {
        // Find default address first
        const defaultAddress = user.addresses.find(addr => addr.isDefault);

        if (defaultAddress && defaultAddress.coordinates) {
          userLocation = defaultAddress.coordinates;
        }
        // If no default address but there are other addresses, use the first one
        else if (user.addresses.length > 0 && user.addresses[0].coordinates) {
          userLocation = user.addresses[0].coordinates;
        }
      }
    }
    // Get the selected date and time from query params (if provided)
    let selectedDate = req.query.date ? new Date(req.query.date) : new Date();
    let selectedTime = req.query.time || "";

    // Validate date (can't be in the past)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedDate < today) {
      selectedDate = today;
    }

    // Validate time if date is today
    if (selectedDate.getTime() === today.getTime() && selectedTime) {
      const [hours, minutes] = selectedTime.split(':').map(num => parseInt(num));
      const selectedDateTime = new Date(selectedDate);
      selectedDateTime.setHours(hours, minutes);

      // If selected time is in the past, adjust to next available slot
      if (selectedDateTime < now) {
        let nextHour = now.getHours();
        let nextMinute = now.getMinutes() < 30 ? 30 : 0;

        if (nextMinute === 0) {
          nextHour++;
        }

        // Ensure within working hours
        if (nextHour < 7) {
          nextHour = 7;
          nextMinute = 0;
        } else if (nextHour >= 21) {
          // No more slots today, move to tomorrow
          selectedDate = new Date(today);
          selectedDate.setDate(selectedDate.getDate() + 1);
          nextHour = 7;
          nextMinute = 0;
        }

        selectedTime = `${nextHour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`;
      }
    }

    // Working hours constraint (7 AM to 9 PM)
    if (selectedTime) {
      const [hours] = selectedTime.split(':').map(num => parseInt(num));

      // Check if time is outside working hours
      if (hours < 7 || hours >= 21) {
        // Default to 7 AM if outside working hours
        selectedTime = "07:00";
      }
    }


    // Find all providers who offer this service 
    const allProviders = await ServiceProvider.find({
      "servicesOffered.services.service": serviceId
    })
      .populate({
        path: "user",
        select: 'name profileImage addresses phone'
      })
      .lean();

    // Get day of week for availability check
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][selectedDate.getDay()];

    // Separate providers into available and unavailable
    const availableProviders = [];
    const unavailableProviders = [];

    // Process each provider
    allProviders.forEach(provider => {
      // Add fallback image if needed
      if (!provider.user || !provider.user.profileImage) {
        if (!provider.user) {
          provider.user = {};
        }
        provider.user.profileImage = 'https://cdn-icons-png.flaticon.com/512/4202/4202841.png';
      }

      // Extract service details for this provider
      let matchedService = null;
      if (provider.servicesOffered) {
        provider.servicesOffered.forEach(category => {
          if (category.services) {
            category.services.forEach(s => {
              if (s.service.toString() === serviceId) {
                matchedService = s;
              }
            });
          }
        });
      }
      provider.matchedService = matchedService;

      // Check if provider is inactive
      if (provider.isActive === false) {
        provider.unavailabilityReason = 'Provider is not currently accepting bookings';
        unavailableProviders.push(provider);
        return;
      }

      // Calculate distance if user location is available
      if (userLocation && provider.user && provider.user.addresses && provider.user.addresses.length > 0) {
        // Find provider's address
        const providerAddress = provider.user.addresses.find(addr => addr.isDefault) || provider.user.addresses[0];

        if (providerAddress && providerAddress.coordinates &&
          providerAddress.coordinates.latitude && providerAddress.coordinates.longitude) {
          const distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            providerAddress.coordinates.latitude,
            providerAddress.coordinates.longitude
          );

          provider.distance = distance;
          provider.formattedDistance = distance < 1 ?
            `${(distance * 1000).toFixed(0)} meters` :
            `${distance.toFixed(1)} km`;
        }
      }

      // Check availability for the selected date/time
      let isAvailable = true;
      let availableTimeSlots = [];

      // If no availability data, consider unavailable
      if (!provider.availability) {
        isAvailable = false;
        provider.unavailabilityReason = 'Provider has not set their availability';
      } else {
        // Check if provider is available on this day
        const dayAvailability = provider.availability[dayOfWeek];
        if (!dayAvailability || !dayAvailability.isAvailable) {
          isAvailable = false;
          provider.unavailabilityReason = `Provider is not available on ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}s`;
        } else {
          // Always collect available time slots regardless of whether a specific time is requested
          if (dayAvailability.slots && Array.isArray(dayAvailability.slots)) {
            dayAvailability.slots.forEach(slot => {
              if (slot && slot.isActive && slot.startTime && slot.endTime) {
                availableTimeSlots.push({
                  startTime: slot.startTime,
                  endTime: slot.endTime
                });
              }
            });
          }
          // Sort time slots chronologically
          availableTimeSlots.sort((a, b) => {
            return a.startTime.localeCompare(b.startTime);
          });

          // Store the available slots for display
          provider.availableTimeSlots = availableTimeSlots;

          // Add debugging to check what time slots are found
          console.log(`Provider ${provider._id} has ${availableTimeSlots.length} time slots on ${dayOfWeek}`);
          if (availableTimeSlots.length > 0) {
            console.log('Time slots:', availableTimeSlots.map(slot => `${slot.startTime}-${slot.endTime}`).join(', '));
          }

          // Check specific time slot if requested
          try {
            const requestedHour = parseInt(selectedTime.split(':')[0]);
            const requestedMinute = parseInt(selectedTime.split(':')[1] || '0');

            // Check if there are any slots
            if (!dayAvailability.slots || !Array.isArray(dayAvailability.slots) || dayAvailability.slots.length === 0) {
              isAvailable = false;
              provider.unavailabilityReason = `Provider has no time slots set for ${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}s`;
            } else {
              // Check each slot for the requested time
              isAvailable = dayAvailability.slots.some(slot => {
                // Skip if slot is not active or missing data
                if (!slot || !slot.isActive || !slot.startTime || !slot.endTime) {
                  return false;
                }

                const startHour = parseInt(slot.startTime.split(':')[0]);
                const startMinute = parseInt(slot.startTime.split(':')[1] || '0');
                const endHour = parseInt(slot.endTime.split(':')[0]);
                const endMinute = parseInt(slot.endTime.split(':')[1] || '0');

                // Convert to minutes for comparison
                const requestedTimeInMinutes = requestedHour * 60 + requestedMinute;
                const startTimeInMinutes = startHour * 60 + startMinute;
                const endTimeInMinutes = endHour * 60 + endMinute;

                return requestedTimeInMinutes >= startTimeInMinutes && requestedTimeInMinutes <= endTimeInMinutes;
              });

              if (!isAvailable) {
                provider.unavailabilityReason = `Not available at ${selectedTime}, but has other time slots`;
              }
            }
          } catch (error) {
            console.error(`Error checking time availability: ${error.message}`);
            isAvailable = false;
            provider.unavailabilityReason = 'Error checking availability';
          }
        }
      }

      // Format the time slots for display
      if (provider.availableTimeSlots && provider.availableTimeSlots.length > 0) {
        provider.formattedTimeSlots = provider.availableTimeSlots.map(slot => {
          return formatTimeSlot(slot.startTime, slot.endTime);
        }).join(', ');
      }

      // Add to appropriate array
      if (isAvailable) {
        availableProviders.push(provider);
      } else {
        unavailableProviders.push(provider);
      }
    });

    console.log(`Total providers: ${allProviders.length}, Available: ${availableProviders.length}, Unavailable: ${unavailableProviders.length}`);

    // After populating both arrays, sort them by distance if location is available
    if (userLocation) {
      availableProviders.sort((a, b) => {
        const distA = a.distance !== undefined ? a.distance : Infinity;
        const distB = b.distance !== undefined ? b.distance : Infinity;
        return distA - distB;
      });

      unavailableProviders.sort((a, b) => {
        const distA = a.distance !== undefined ? a.distance : Infinity;
        const distB = b.distance !== undefined ? b.distance : Infinity;
        return distA - distB;
      });
    }

    res.render("pages/providers", {
      providers: {
        available: availableProviders,
        unavailable: unavailableProviders
      },
      service,
      category: service.category,
      serviceId,
      selectedDate: selectedDate.toISOString().split('T')[0],
      selectedTime,
      dayOfWeek: dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1),
      hasUserLocation: !!userLocation
    });

  } catch (err) {
    console.error("Error fetching providers:", err);
    req.flash("error", "Unable to load providers");
    res.redirect("/services");
  }
});

// Helper function to format time slots in a readable way
function formatTimeSlot(startTime, endTime) {
  // Convert 24-hour format to 12-hour format
  function formatTime(time) {
    if (!time) return "N/A";

    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${minutes || '00'} ${ampm}`;
  }

  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}
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

router.post('/update-location', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, error: 'Invalid coordinates provided' });
    }

    // Store the coordinates in the user's session for non-logged-in users
    req.session.currentLocation = { latitude, longitude };

    // If user is logged in, update their profile too
    if (req.user) {
      const user = await User.findById(req.user._id);

      if (user) {
        user.currentLocation = {
          latitude,
          longitude,
          lastUpdated: new Date()
        };
        await user.save();
      }
    }

    res.json({ success: true, message: 'Location updated successfully' });
  } catch (error) {
    console.error('Error updating user location:', error);
    res.status(500).json({ success: false, error: 'Error updating location' });
  }
});
module.exports = router;
