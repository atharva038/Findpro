const express = require("express");
const Service = require("../models/Service");
const User = require("../models/User");
const Category = require("../models/category");
const ServiceProvider = require("../models/ServiceProvider");
const router = express.Router();
const calculateDistance = require('../utils/distance');
const { isLoggedIn } = require('../middleware');

// Get all services/categories
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


router.get('/:serviceId/providers', async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { date, time, location, latitude, longitude, distance = 10 } = req.query;

    console.log('Providers request params:', { serviceId, date, time, location, latitude, longitude });

    // Parse coordinates if provided
    let userLocation = null;
    if (latitude && longitude) {
      userLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude)
      };
      console.log('User location coordinates:', userLocation);
    }

    // Get the service and its category
    const service = await Service.findById(serviceId).populate('category');
    if (!service) {
      req.flash('error', 'Service not found');
      return res.redirect('/services');
    }

    // Base query for providers who offer this service
    let providerQuery = {
      'servicesOffered.services.service': serviceId,
      isActive: true
    };

    // Add location-based filtering if location is provided
    if (location) {
      console.log('Filtering providers by location:', location);
      // Search for providers in the specified city/area
      providerQuery.$or = [
        { 'serviceArea.city': new RegExp(location, 'i') },
        { 'serviceArea.state': new RegExp(location, 'i') },
        { 'serviceAreas.address': new RegExp(location, 'i') }
      ];
    }

    console.log('Provider query:', JSON.stringify(providerQuery, null, 2));

    // Find all providers who offer this service
    let allProviders = await ServiceProvider.find(providerQuery)
      .populate({
        path: 'user',
        select: 'name email phone profileImage'
      })
      .populate({
        path: 'servicesOffered.category',
        model: 'Category'
      })
      .populate({
        path: 'servicesOffered.services.service',
        model: 'Service'
      })
      .lean();

    console.log(`Found ${allProviders.length} providers before processing`);

    // Process each provider to add service-specific information
    allProviders = allProviders.map(provider => {
      // Find the specific service details from provider's servicesOffered
      let serviceDetails = null;
      let serviceExperience = null;
      let serviceCost = null;

      provider.servicesOffered.forEach(category => {
        category.services.forEach(s => {
          if (s.service._id.toString() === serviceId) {
            serviceDetails = s;
            serviceExperience = s.experience;
            serviceCost = s.customCost;
          }
        });
      });

      // Add service-specific information to provider
      provider.serviceExperience = serviceExperience || 'Not specified';
      provider.serviceCost = serviceCost;
      provider.formattedPrice = serviceCost ? `₹${serviceCost}` : 'Price on request';

      return provider;
    });

    // Apply distance filtering if coordinates are provided
    if (userLocation && allProviders.length > 0) {
      allProviders = allProviders.filter(provider => {
        let hasNearbyServiceArea = false;
        let minDistance = Infinity;

        // Check main service area
        if (provider.serviceArea && provider.serviceArea.coordinates) {
          const providerDistance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            provider.serviceArea.coordinates.latitude,
            provider.serviceArea.coordinates.longitude
          );

          if (providerDistance <= distance) {
            minDistance = Math.min(minDistance, providerDistance);
            hasNearbyServiceArea = true;
          }
        }

        // Check specific service areas
        if (provider.serviceAreas && provider.serviceAreas.length > 0) {
          provider.serviceAreas.forEach(area => {
            if (area.lat && area.lng) {
              const areaDistance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                area.lat,
                area.lng
              );

              const effectiveRadius = area.radius || distance;
              if (areaDistance <= effectiveRadius) {
                minDistance = Math.min(minDistance, areaDistance);
                hasNearbyServiceArea = true;
              }
            }
          });
        }

        // If no specific coordinates, but location text matches, include them
        if (!hasNearbyServiceArea && location) {
          const cityMatch = provider.serviceArea &&
            provider.serviceArea.city &&
            provider.serviceArea.city.toLowerCase().includes(location.toLowerCase());

          const areaMatch = provider.serviceAreas &&
            provider.serviceAreas.some(area =>
              area.address && area.address.toLowerCase().includes(location.toLowerCase())
            );

          if (cityMatch || areaMatch) {
            hasNearbyServiceArea = true;
            minDistance = 0; // Default distance for text-based matches
          }
        }

        if (hasNearbyServiceArea && minDistance !== Infinity) {
          provider.distance = minDistance;
        }

        return hasNearbyServiceArea;
      });

      console.log(`${allProviders.length} providers after location filtering`);
    }

    // Process providers for availability
    const availableProviders = [];
    const unavailableProviders = [];

    // Get day of week for display purposes
    let dayOfWeek = '';
    if (date) {
      const requestedDate = new Date(date);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      dayOfWeek = days[requestedDate.getDay()];
    }

    // Process each provider for availability
    for (const provider of allProviders) {
      let isAvailable = true;
      let unavailabilityReason = '';

      // Check date and time availability if provided
      if (date || time) {
        try {
          const availability = await checkProviderAvailability(provider._id, date, time);
          isAvailable = availability.isAvailable;
          if (!isAvailable) {
            unavailabilityReason = availability.reason || 'Not available at selected time';
            provider.availableTimeSlots = availability.availableSlots || [];
          }
        } catch (error) {
          console.error(`Error checking availability for provider ${provider._id}:`, error);
          isAvailable = false;
          unavailabilityReason = 'Error checking availability';
        }
      }

      // Add distance to display if available
      if (provider.distance !== undefined) {
        provider.distanceText = `${provider.distance.toFixed(1)} km away`;
      }

      // Add service area info for display
      if (provider.serviceArea) {
        provider.address = provider.serviceArea.city || provider.serviceArea.state || 'Service area available';
      } else if (provider.serviceAreas && provider.serviceAreas.length > 0) {
        provider.address = provider.serviceAreas[0].address || 'Service area available';
      } else {
        provider.address = 'Service area available';
      }

      // Add to appropriate array
      if (isAvailable) {
        availableProviders.push(provider);
      } else {
        provider.unavailabilityReason = unavailabilityReason;
        unavailableProviders.push(provider);
      }
    }

    // Sort by distance if location is available, otherwise by name
    const sortProviders = (providers) => {
      if (userLocation) {
        return providers.sort((a, b) => {
          const distA = a.distance !== undefined ? a.distance : Infinity;
          const distB = b.distance !== undefined ? b.distance : Infinity;
          return distA - distB;
        });
      } else {
        return providers.sort((a, b) => {
          return (a.user.name || '').localeCompare(b.user.name || '');
        });
      }
    };

    sortProviders(availableProviders);
    sortProviders(unavailableProviders);

    console.log(`Final results: ${availableProviders.length} available, ${unavailableProviders.length} unavailable`);

    res.render('pages/providers', {
      providers: {
        available: availableProviders,
        unavailable: unavailableProviders
      },
      service,
      serviceId,
      category: service.category,
      selectedDate: date,
      selectedTime: time,
      location,
      latitude,
      longitude,
      distance: parseInt(distance),
      dayOfWeek,
      title: `${service.name} Providers`
    });

  } catch (error) {
    console.error('Error finding providers:', error);
    req.flash('error', 'Failed to load providers');
    res.redirect('/services');
  }
});
// Book service route
router.get("/:id/:provider/book", isLoggedIn, async (req, res) => {
  try {
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

// Update location route
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

// Add this function before the router.get('/:serviceId/providers') route

// Helper function to check provider availability
async function checkProviderAvailability(providerId, date, time) {
  try {
    const provider = await ServiceProvider.findById(providerId);
    if (!provider || !provider.availability) {
      return {
        isAvailable: false,
        reason: 'Provider availability not configured',
        availableSlots: []
      };
    }

    // If no date/time specified, consider available
    if (!date && !time) {
      return {
        isAvailable: true,
        reason: '',
        availableSlots: []
      };
    }

    // Get day of week for the requested date
    let dayOfWeek = '';
    if (date) {
      const requestedDate = new Date(date);
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      dayOfWeek = days[requestedDate.getDay()];
    }

    // If date is provided but no time, check if provider is available on that day
    if (date && !time) {
      const dayAvailability = provider.availability[dayOfWeek];
      if (!dayAvailability || !dayAvailability.isAvailable) {
        return {
          isAvailable: false,
          reason: `Not available on ${dayOfWeek}`,
          availableSlots: []
        };
      }

      return {
        isAvailable: true,
        reason: '',
        availableSlots: dayAvailability.slots || []
      };
    }

    // If time is provided, check specific time slot availability
    if (time) {
      const requestedTime = time;
      const [requestedHour, requestedMinute] = requestedTime.split(':').map(Number);
      const requestedTimeInMinutes = requestedHour * 60 + requestedMinute;

      // If no date provided, assume it's for today or a general check
      if (!date) {
        // Check against all days or current day
        const today = new Date();
        const todayDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
        dayOfWeek = todayDay;
      }

      const dayAvailability = provider.availability[dayOfWeek];
      if (!dayAvailability || !dayAvailability.isAvailable) {
        return {
          isAvailable: false,
          reason: `Not available on ${dayOfWeek}`,
          availableSlots: dayAvailability ? dayAvailability.slots : []
        };
      }

      // Check if requested time falls within any available slot
      let isTimeAvailable = false;
      const availableSlots = [];

      if (dayAvailability.slots) {
        dayAvailability.slots.forEach(slot => {
          if (slot.isActive) {
            const [startHour, startMinute] = slot.startTime.split(':').map(Number);
            const [endHour, endMinute] = slot.endTime.split(':').map(Number);

            const startTimeInMinutes = startHour * 60 + startMinute;
            const endTimeInMinutes = endHour * 60 + endMinute;

            availableSlots.push({
              startTime: slot.startTime,
              endTime: slot.endTime
            });

            if (requestedTimeInMinutes >= startTimeInMinutes && requestedTimeInMinutes < endTimeInMinutes) {
              isTimeAvailable = true;
            }
          }
        });
      }

      return {
        isAvailable: isTimeAvailable,
        reason: isTimeAvailable ? '' : `Not available at ${formatTime(requestedTime)}`,
        availableSlots: availableSlots
      };
    }

    return {
      isAvailable: true,
      reason: '',
      availableSlots: []
    };

  } catch (error) {
    console.error('Error checking provider availability:', error);
    return {
      isAvailable: false,
      reason: 'Error checking availability',
      availableSlots: []
    };
  }
}

// Helper function to format time
function formatTime(time) {
  if (!time) return "N/A";
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedHour = hour % 12 || 12;
  return `${formattedHour}:${minutes || '00'} ${ampm}`;
}

module.exports = router;