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
        const { date, time, location, latitude, longitude, distance = 30 } = req.query;

        console.log('Providers request params:', { serviceId, date, time, location, latitude, longitude, distance });

        // Parse coordinates if provided, or fallback to session location
        let userLocation = null;
        if (latitude && longitude) {
            userLocation = {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            };
        } else if (req.session.currentLocation) {
            // Fallback to session location if no coordinates in query
            userLocation = {
                latitude: req.session.currentLocation.latitude,
                longitude: req.session.currentLocation.longitude
            };
            console.log('Using session location:', userLocation);
        }

        if (userLocation) {
            console.log('User location coordinates:', userLocation);
        }

        // Get the service and its category
        const service = await Service.findById(serviceId).populate('category');
        if (!service) {
            req.flash('error', 'Service not found');
            return res.redirect('/services');
        }

        // Find providers for this service with increased search radius for regional coverage
        const searchDistance = parseInt(distance);
        const providerData = await findProvidersForService(serviceId, {
            location,
            userLocation,
            distance: searchDistance
        });

        console.log(`Found ${providerData.length} providers within ${searchDistance}km`);

        // If no providers found with default distance, try with larger radius
        let expandedSearch = false;
        if (providerData.length === 0 && userLocation && searchDistance < 100) {
            console.log('No providers found, expanding search radius to 100km...');
            const expandedProviders = await findProvidersForService(serviceId, {
                location,
                userLocation,
                distance: 100
            });

            if (expandedProviders.length > 0) {
                providerData.push(...expandedProviders);
                expandedSearch = true;
                console.log(`Found ${expandedProviders.length} additional providers with expanded search`);
            }
        }

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
            latitude: userLocation?.latitude,
            longitude: userLocation?.longitude,
            distance: expandedSearch ? 100 : searchDistance,
            dayOfWeek,
            expandedSearch, // Pass this to show a message to user
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
    const { location, userLocation, distance = 30 } = options; // Default to 30km

    // Base query for providers who offer this service
    let providerQuery = {
        'servicesOffered.services.service': serviceId,
        isActive: true
    };

    console.log('Provider query:', JSON.stringify(providerQuery, null, 2));
    console.log('Search options:', { location, userLocation: !!userLocation, distance });

    // Find all providers who offer this service (don't filter by location in query initially)
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

    // Apply location and distance filtering with enhanced regional logic
    if (userLocation || location) {
        // Use more lenient distance for regional searches - minimum 50km for location-based searches
        const effectiveDistance = location ? Math.max(distance, 50) : distance;
        
        allProviders = allProviders.filter(provider => {
            return filterProvidersByLocationAndDistance(provider, userLocation, effectiveDistance, location);
        });

        console.log(`${allProviders.length} providers after location filtering (within ${effectiveDistance}km region)`);
    }

    return allProviders;
}

// Enhanced filter function with better regional coverage
function filterProvidersByLocationAndDistance(provider, userLocation, distance = 30, location) {
    let hasNearbyServiceArea = false;
    let minDistance = Infinity;

    console.log(`Filtering provider ${provider.user.name}:`, {
        userLocation: userLocation ? `${userLocation.latitude}, ${userLocation.longitude}` : 'None',
        distance: distance,
        location: location,
        providerServiceArea: provider.serviceArea,
        providerServiceAreas: provider.serviceAreas?.length || 0
    });

    // ENHANCED REGIONAL MATCHING - Check city/state level first
    if (location) {
        const locationLower = location.toLowerCase();
        
        // Extract city name from location string (remove state, country, etc.)
        const cityFromLocation = extractCityName(locationLower);
        
        // Check if provider serves the same city/region
        const cityMatch = provider.serviceArea &&
            provider.serviceArea.city &&
            (provider.serviceArea.city.toLowerCase().includes(cityFromLocation) ||
             cityFromLocation.includes(provider.serviceArea.city.toLowerCase()) ||
             areInSameCity(provider.serviceArea.city.toLowerCase(), cityFromLocation));

        const stateMatch = provider.serviceArea &&
            provider.serviceArea.state &&
            (provider.serviceArea.state.toLowerCase().includes(locationLower) ||
             locationLower.includes(provider.serviceArea.state.toLowerCase()));

        // Check specific service areas for city matches
        const areaMatch = provider.serviceAreas &&
            provider.serviceAreas.some(area => {
                if (!area.name && !area.address) return false;
                
                const areaName = (area.name || '').toLowerCase();
                const areaAddress = (area.address || '').toLowerCase();
                
                return (
                    areaName.includes(cityFromLocation) ||
                    cityFromLocation.includes(areaName) ||
                    areaAddress.includes(cityFromLocation) ||
                    cityFromLocation.includes(areaAddress) ||
                    areInSameCity(areaName, cityFromLocation) ||
                    areInSameCity(areaAddress, cityFromLocation)
                );
            });

        // If we have a city/regional match, include this provider regardless of distance
        if (cityMatch || stateMatch || areaMatch) {
            hasNearbyServiceArea = true;
            minDistance = 10; // Set a default reasonable distance for regional matches
            console.log(`Provider ${provider.user.name} matched by REGIONAL location: ${location}`);
        }
    }

    // If we have user coordinates, do distance-based filtering (but be more lenient for regional matches)
    if (userLocation && !hasNearbyServiceArea) {
        // Check main service area coordinates
        if (provider.serviceArea && provider.serviceArea.coordinates) {
            const providerDistance = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                provider.serviceArea.coordinates.latitude,
                provider.serviceArea.coordinates.longitude
            );

            console.log(`Provider ${provider.user.name} main area distance: ${providerDistance.toFixed(2)}km`);

            // Use larger radius for city-level searches
            const effectiveDistance = location ? Math.max(distance, 50) : distance; // 50km for regional searches
            
            if (providerDistance <= effectiveDistance) {
                minDistance = Math.min(minDistance, providerDistance);
                hasNearbyServiceArea = true;
                console.log(`Provider ${provider.user.name} included by DISTANCE (${providerDistance.toFixed(2)}km <= ${effectiveDistance}km)`);
            }
        }

        // Check specific service areas with more flexible radius
        if (provider.serviceAreas && provider.serviceAreas.length > 0) {
            provider.serviceAreas.forEach(area => {
                if (area.lat && area.lng) {
                    const areaDistance = calculateDistance(
                        userLocation.latitude,
                        userLocation.longitude,
                        area.lat,
                        area.lng
                    );

                    console.log(`Provider ${provider.user.name} area "${area.name}" distance: ${areaDistance.toFixed(2)}km`);

                    // Use provider's area radius plus a buffer for regional coverage
                    const providerRadius = area.radius || 20;
                    const regionalBuffer = location ? 30 : 10; // Add 30km buffer for city searches
                    const effectiveRadius = Math.max(providerRadius + regionalBuffer, distance);

                    if (areaDistance <= effectiveRadius) {
                        minDistance = Math.min(minDistance, areaDistance);
                        hasNearbyServiceArea = true;
                        console.log(`Provider ${provider.user.name} included by AREA DISTANCE (${areaDistance.toFixed(2)}km <= ${effectiveRadius}km)`);
                    }
                }
            });
        }
    }

    // Fallback: Include providers with large service areas (state/multi-city coverage)
    if (!hasNearbyServiceArea && provider.serviceAreas) {
        const hasLargeServiceArea = provider.serviceAreas.some(area => (area.radius || 0) >= 30); // 30km+ radius
        
        if (hasLargeServiceArea) {
            hasNearbyServiceArea = true;
            minDistance = 25; // Default for large service areas
            console.log(`Provider ${provider.user.name} included via LARGE SERVICE AREA`);
        }
    }

    // Final fallback: Include providers who serve the same state
    if (!hasNearbyServiceArea && location && provider.serviceArea) {
        const stateKeywords = extractStateKeywords(location.toLowerCase());
        const providerStateKeywords = extractStateKeywords((provider.serviceArea.state || '').toLowerCase());
        
        if (stateKeywords.length > 0 && providerStateKeywords.length > 0) {
            const hasStateMatch = stateKeywords.some(keyword => 
                providerStateKeywords.some(providerKeyword => 
                    keyword.includes(providerKeyword) || providerKeyword.includes(keyword)
                )
            );
            
            if (hasStateMatch) {
                hasNearbyServiceArea = true;
                minDistance = 40; // Default for state-level matches
                console.log(`Provider ${provider.user.name} included via STATE MATCH`);
            }
        }
    }

    // Set the calculated distance on the provider
    if (hasNearbyServiceArea && minDistance !== Infinity) {
        provider.distance = minDistance;
    }

    console.log(`Provider ${provider.user.name} result: ${hasNearbyServiceArea ? 'INCLUDED' : 'EXCLUDED'}, distance: ${minDistance !== Infinity ? minDistance.toFixed(1) + 'km' : 'N/A'}`);

    return hasNearbyServiceArea;
}

// Helper function to extract city name from location string
function extractCityName(locationString) {
    // Remove common suffixes and clean up the location string
    let cityName = locationString
        .replace(/,.*$/g, '') // Remove everything after first comma
        .replace(/\b(state|district|city|town|village|area|sector|block|ward)\b/gi, '')
        .replace(/\b(india|bharat)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Handle specific patterns like "City Name, State" 
    if (cityName.includes(',')) {
        cityName = cityName.split(',')[0].trim();
    }
    
    return cityName;
}

// Helper function to check if two city names refer to the same city
function areInSameCity(city1, city2) {
    if (!city1 || !city2) return false;
    
    // Clean up city names
    const cleanCity1 = city1.replace(/\b(city|district|town|nagar|pur|bad|ganj)\b/gi, '').trim();
    const cleanCity2 = city2.replace(/\b(city|district|town|nagar|pur|bad|ganj)\b/gi, '').trim();
    
    // Check for partial matches (useful for cities with different spellings)
    if (cleanCity1.length >= 3 && cleanCity2.length >= 3) {
        return (
            cleanCity1.includes(cleanCity2) || 
            cleanCity2.includes(cleanCity1) ||
            levenshteinDistance(cleanCity1, cleanCity2) <= 2 // Allow for minor spelling differences
        );
    }
    
    return cleanCity1 === cleanCity2;
}

// Helper function to extract state keywords
function extractStateKeywords(locationString) {
    const stateKeywords = [
        'maharashtra', 'karnataka', 'gujarat', 'rajasthan', 'tamil nadu', 'telangana',
        'andhra pradesh', 'kerala', 'punjab', 'haryana', 'uttar pradesh', 'bihar',
        'west bengal', 'odisha', 'madhya pradesh', 'chhattisgarh', 'jharkhand',
        'assam', 'himachal pradesh', 'uttarakhand', 'delhi', 'mumbai', 'bangalore',
        'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'surat', 'jaipur'
    ];
    
    return stateKeywords.filter(keyword => locationString.includes(keyword));
}

// Simple Levenshtein distance function for fuzzy string matching
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
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