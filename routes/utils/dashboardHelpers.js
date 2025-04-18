const ServiceProvider = require("../models/ServiceProvider");
const Booking = require("../models/Booking");
const Service = require("../models/Service");
const User = require("../models/User");

/**
 * Get dashboard data for customers
 */
async function getCustomerDashboardData(userId) {
    // Get customer's bookings
    const bookings = await Booking.find({ customer: userId })
        .populate("service")
        .populate({
            path: "provider",
            populate: { path: "user" }
        })
        .sort({ bookingDate: -1 })
        .lean();

    return {
        bookings,
        services: [] // Customer doesn't need services yet
    };
}

/**
 * Get dashboard data for service providers
 */
async function getProviderDashboardData(userId) {
    // Get provider profile or create if it doesn't exist
    let serviceProviderData = await ServiceProvider.findOne({ user: userId });

    if (!serviceProviderData) {
        serviceProviderData = await ServiceProvider.create({
            user: userId,
            servicesOffered: [],
            experience: 0
        });
    }

    // Get provider's service offerings with proper population
    const providerWithServices = await ServiceProvider.findOne({ user: userId })
        .populate({
            path: "servicesOffered.category",
            model: "Category",
            select: "name description"
        })
        .populate({
            path: "servicesOffered.services.service",
            model: "Service",
            select: "name img price description category"
        })
        .lean();

    // Get provider's bookings with better population for images
    const bookings = await Booking.find({ provider: serviceProviderData._id })
        .populate({
            path: "service",
            select: "name img price description"
        })
        .populate({
            path: "customer",
            model: "User",
            select: "name email phone profileImage"
        })
        .sort({ bookingDate: -1 })
        .lean();

    // Process bookings to ensure image URLs are valid
    const processedBookings = bookings.map(booking => {
        // Create a deep copy to avoid modifying the cached data
        const processedBooking = JSON.parse(JSON.stringify(booking));

        // Only use fallback if image is completely missing
        if (processedBooking.service) {
            if (!processedBooking.service.img) {
                processedBooking.service.img = 'https://placehold.co/300x200?text=No+Image';
            }
        } else {
            processedBooking.service = {
                name: 'Unknown Service',
                img: 'https://placehold.co/300x200?text=Unknown+Service'
            };
        }

        // Only use fallback if customer image is completely missing
        if (processedBooking.customer) {
            if (!processedBooking.customer.profileImage) {
                processedBooking.customer.profileImage = 'https://placehold.co/100x100?text=User';
            }
        } else {
            processedBooking.customer = {
                name: 'Unknown Customer',
                profileImage: 'https://placehold.co/100x100?text=Unknown+User'
            };
        }

        return processedBooking;
    });

    // Calculate booking statistics
    const bookingStats = {
        total: bookings.length,
        ongoing: bookings.filter(b => b.status === "confirmed").length,
        completed: bookings.filter(b => b.status === "completed").length,
        pending: bookings.filter(b => b.status === "pending").length,
        cancelled: bookings.filter(b => b.status === "cancelled").length,
        increase: await calculateBookingIncrease(serviceProviderData._id)
    };

    // Get ratings
    const ratings = await calculateProviderRatings(serviceProviderData._id);

    return {
        provider: providerWithServices || serviceProviderData,
        bookings: processedBookings,
        services: providerWithServices?.servicesOffered || [],
        bookingStats,
        ratings
    };
}

/**
 * Calculate booking increase percentage (mock implementation)
 */
async function calculateBookingIncrease(providerId) {
    return 10; // Mock 10% increase
}

/**
 * Calculate provider ratings (mock implementation)
 */
async function calculateProviderRatings(providerId) {
    return {
        average: 4.7,
        count: 24
    };
}

module.exports = {
    getCustomerDashboardData,
    getProviderDashboardData,
    calculateBookingIncrease,
    calculateProviderRatings
};