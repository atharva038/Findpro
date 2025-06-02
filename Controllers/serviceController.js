const Service = require("../models/Service");
const User = require("../models/User");
const Category = require("../models/category");
const ServiceProvider = require("../models/ServiceProvider");
const calculateDistance = require('../utils/distance');

// Get all services/categories
exports.getAllServices = async (req, res) => {
    try {
        // Fetch all categories with their images
        const categories = await Category.find();

        // Render the services page with the category data
        res.render("pages/service", { categories });
    } catch (err) {
        console.error('Error fetching categories:', err);
        req.flash('error', 'Failed to load services');
        res.status(500).render('pages/service', { categories: [] });
    }
};

// Route to list services by specific category
exports.getServicesByCategory = async (req, res) => {
    try {
        // Get the category ID from the URL parameter
        const categoryId = req.params.id;

        // Fetch the category details
        const category = await Category.findById(categoryId);

        if (!category) {
            req.flash('error', 'Category not found');
            return res.status(404).render("pages/services", {
                error: "Category not found.",
                services: [],
                category: null
            });
        }

        // Fetch services that belong to the requested category
        const services = await Service.find({ category: categoryId }).populate("category");

        // Check if there are services for this category
        if (services.length === 0) {
            req.flash('info', `No services found for ${category.name} category`);
            return res.render("pages/services", {
                services: [],
                category,
                message: `No services available in ${category.name} category yet.`
            });
        }

        // Render the services page with the list of services under that category
        res.render("pages/services", { services, category });
    } catch (err) {
        console.error('Error fetching services by category:', err);
        req.flash('error', 'Failed to load services');
        res.status(500).render("pages/services", {
            services: [],
            category: null,
            error: 'Server error occurred'
        });
    }
};

// Get providers for a specific service
exports.getProviders = async (req, res) => {
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

        // Find providers for this service
        const providerData = await findProvidersForService(serviceId, {
            location,
            userLocation,
            distance: parseInt(distance)
        });

        // Process availability if date/time provided
        const processedProviders = await processProviderAvailability(
            providerData,
            date,
            time
        );

        // Get day of week for display purposes
        let dayOfWeek = '';
        if (date) {
            const requestedDate = new Date(date);
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            dayOfWeek = days[requestedDate.getDay()];
        }

        console.log(`Final results: ${processedProviders.available.length} available, ${processedProviders.unavailable.length} unavailable`);

        res.render('pages/providers', {
            providers: processedProviders,
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
};

// Book service route
exports.bookService = async (req, res) => {
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
        const serviceDetails = findServiceDetails(provider, serviceId);

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
};

// Update location route
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinates provided'
            });
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

        res.json({
            success: true,
            message: 'Location updated successfully'
        });
    } catch (error) {
        console.error('Error updating user location:', error);
        res.status(500).json({
            success: false,
            error: 'Error updating location'
        });
    }
};

// Helper Functions (moved to bottom)

// Find providers for a specific service
async function findProvidersForService(serviceId, options = {}) {
    const { location, userLocation, distance } = options;

    // Base query for providers who offer this service
    let providerQuery = {
        'servicesOffered.services.service': serviceId,
        isActive: true
    };

    // Add location-based filtering if location is provided
    if (location) {
        console.log('Filtering providers by location:', location);
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
        const serviceDetails = findServiceDetails(provider, serviceId);

        // Add service-specific information to provider
        provider.serviceExperience = serviceDetails?.experience || 'Not specified';
        provider.serviceCost = serviceDetails?.customCost;
        provider.formattedPrice = serviceDetails?.customCost ?
            `₹${serviceDetails.customCost}` : 'Price on request';

        return provider;
    });

    // Apply distance filtering if coordinates are provided
    if (userLocation && allProviders.length > 0) {
        allProviders = allProviders.filter(provider => {
            return filterProvidersByDistance(provider, userLocation, distance, location);
        });

        console.log(`${allProviders.length} providers after location filtering`);
    }

    return allProviders;
}

// Filter providers by distance
function filterProvidersByDistance(provider, userLocation, distance, location) {
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
}

// Process provider availability
async function processProviderAvailability(allProviders, date, time) {
    const availableProviders = [];
    const unavailableProviders = [];

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
        provider.address = getProviderAddress(provider);

        // Add to appropriate array
        if (isAvailable) {
            availableProviders.push(provider);
        } else {
            provider.unavailabilityReason = unavailabilityReason;
            unavailableProviders.push(provider);
        }
    }

    // Sort providers
    sortProviders(availableProviders);
    sortProviders(unavailableProviders);

    return {
        available: availableProviders,
        unavailable: unavailableProviders
    };
}

// Find service details for a provider
function findServiceDetails(provider, serviceId) {
    let serviceDetails = null;

    provider.servicesOffered.forEach(category => {
        category.services.forEach(s => {
            if (s.service._id.toString() === serviceId) {
                serviceDetails = s;
            }
        });
    });

    return serviceDetails;
}

// Get provider address for display
function getProviderAddress(provider) {
    if (provider.serviceArea) {
        return provider.serviceArea.city || provider.serviceArea.state || 'Service area available';
    } else if (provider.serviceAreas && provider.serviceAreas.length > 0) {
        return provider.serviceAreas[0].address || 'Service area available';
    } else {
        return 'Service area available';
    }
}

// Sort providers by distance or name
function sortProviders(providers) {
    return providers.sort((a, b) => {
        // If both have distance, sort by distance
        if (a.distance !== undefined && b.distance !== undefined) {
            return a.distance - b.distance;
        }
        // If only one has distance, prioritize it
        if (a.distance !== undefined) return -1;
        if (b.distance !== undefined) return 1;
        // Otherwise sort by name
        return (a.user.name || '').localeCompare(b.user.name || '');
    });
}

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