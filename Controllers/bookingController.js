const Booking = require("../models/Booking");
const Service = require("../models/Service");
const Payment = require("../models/Payment");
const User = require("../models/User");
const ServiceProvider = require("../models/ServiceProvider");
const { processProviderPayout } = require("../utils/paymentAutomation");

// Create booking after payment confirmation
exports.createBooking = async (req, res) => {
    try {
        const {
            serviceId,
            providerId,
            date,
            detailedAddress,
            notes,
            cost,
            paymentId,
            latitude,
            longitude
        } = req.body;

        console.log('Creating booking with data:', req.body);

        // Validate required fields
        if (!serviceId || !providerId || !date || !detailedAddress || !cost) {
            return res.status(400).json({
                success: false,
                error: "All required fields must be provided"
            });
        }

        // Verify service and provider exist
        const [service, provider] = await Promise.all([
            Service.findById(serviceId),
            ServiceProvider.findById(providerId).populate('user')
        ]);

        if (!service || !provider) {
            return res.status(404).json({
                success: false,
                error: "Service or provider not found"
            });
        }

        // Create the booking
        const booking = new Booking({
            customer: req.user._id,
            service: serviceId,
            provider: providerId,
            providerUserId: provider.user._id,
            date: new Date(date),
            location: {
                type: 'Point',
                coordinates: [
                    parseFloat(longitude) || 0,
                    parseFloat(latitude) || 0
                ]
            },
            address: detailedAddress,
            notes: notes || "",
            cost: parseFloat(cost),
            totalCost: parseFloat(cost),
            status: 'pending',
            paymentStatus: 'partially_paid',
            advancePayment: {
                paid: true,
                paymentId: paymentId,
                amount: Math.round(cost * 0.15)
            },
            finalPayment: {
                paid: false,
                amount: cost - Math.round(cost * 0.15)
            }
        });

        await booking.save();

        console.log('Booking created successfully:', booking._id);

        res.json({
            success: true,
            bookingId: booking._id,
            message: "Booking created successfully"
        });

    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({
            success: false,
            error: "Server error. Please try again later."
        });
    }
};

// Booking confirmation page (before payment)
exports.confirmBooking = async (req, res) => {
    try {
        const {
            serviceId,
            providerId,
            date,
            addressId,
            latitude,
            longitude,
            detailedAddress,
            notes
        } = req.body;

        console.log('Confirming booking with data:', req.body);

        // Validate required fields
        if (!serviceId || !providerId || !date || !detailedAddress) {
            req.flash('error', 'All required fields must be filled');
            return res.redirect('back');
        }

        // Get service and provider details
        const [service, provider] = await Promise.all([
            Service.findById(serviceId),
            ServiceProvider.findById(providerId)
                .populate('user')
                .populate('servicesOffered')
        ]);

        if (!service || !provider) {
            req.flash('error', 'Service or provider not found');
            return res.redirect('/services');
        }

        // Get user addresses
        const user = await User.findById(req.user._id);
        let coordinates = { latitude, longitude };

        // Handle saved addresses
        if (addressId && addressId !== 'new' && user.addresses) {
            const addressIndex = parseInt(addressId);
            if (user.addresses[addressIndex] && user.addresses[addressIndex].coordinates) {
                coordinates = {
                    latitude: user.addresses[addressIndex].coordinates.latitude,
                    longitude: user.addresses[addressIndex].coordinates.longitude
                };
            }
        }

        // Find service details from provider's offerings
        let serviceDetails = null;
        for (const category of provider.servicesOffered) {
            if (category.services && Array.isArray(category.services)) {
                const foundService = category.services.find(s =>
                    s.service && s.service.toString() === serviceId
                );
                if (foundService) {
                    serviceDetails = foundService;
                    break;
                }
            }
        }

        if (!serviceDetails) {
            req.flash('error', 'Service details not found');
            return res.redirect('/services');
        }

        // Validate booking date
        const bookingDate = new Date(date);
        if (isNaN(bookingDate.getTime()) || bookingDate <= new Date()) {
            req.flash('error', 'Please select a valid future date');
            return res.redirect('back');
        }

        // Create booking data object
        const bookingData = {
            serviceId,
            providerId,
            date: bookingDate,
            location: {
                type: 'Point',
                coordinates: [
                    parseFloat(coordinates.longitude) || 0,
                    parseFloat(coordinates.latitude) || 0
                ]
            },
            detailedAddress,
            notes: notes || '',
            customerId: req.user._id,
            cost: serviceDetails.customCost
        };

        console.log('Booking data prepared:', bookingData);

        // Render confirmation page
        res.render('pages/booking-confirm', {
            service,
            provider,
            bookingData,
            serviceDetails,
            user: req.user,
            title: 'Confirm Booking'
        });

    } catch (err) {
        console.error('Booking confirmation error:', err);
        req.flash('error', 'Something went wrong');
        res.redirect('/services');
    }
};

// Get customer bookings
exports.getMyBookings = async (req, res) => {
    try {
        console.log('Fetching bookings for user:', req.user._id);

        const bookings = await Booking.find({ customer: req.user._id })
            .populate("service")
            .populate("provider")
            .populate("providerUserId", "name email phone")
            .sort({ createdAt: -1 });

        console.log(`Found ${bookings.length} bookings for user`);

        res.render("pages/my-bookings", {
            bookings,
            user: req.user,
            title: "My Bookings"
        });
    } catch (err) {
        console.error("Error fetching bookings:", err);
        req.flash('error', 'Unable to fetch bookings');
        res.redirect('/dashboard');
    }
};

// Complete booking (triggers provider payout)
exports.completeBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;

        console.log('Completing booking:', bookingId);

        // Find booking and verify ownership
        const booking = await Booking.findById(bookingId)
            .populate('customer')
            .populate('provider');

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: "Booking not found"
            });
        }

        // Check if user is the customer or provider
        const isCustomer = booking.customer._id.toString() === req.user._id.toString();
        const isProvider = booking.provider.user &&
            booking.provider.user.toString() === req.user._id.toString();

        if (!isCustomer && !isProvider) {
            return res.status(403).json({
                success: false,
                error: "Unauthorized to complete this booking"
            });
        }

        // Update booking status
        const updatedBooking = await Booking.findByIdAndUpdate(bookingId, {
            status: 'completed',
            completedAt: new Date(),
            paymentStatus: 'completed'
        }, { new: true });

        console.log('Booking status updated to completed');

        // Trigger automated provider payout
        try {
            await processProviderPayout(bookingId);
            console.log(`✅ Automated payout triggered for booking ${bookingId}`);
        } catch (payoutError) {
            console.error('Provider payout failed:', payoutError);
            // Don't fail the completion, just log the error
        }

        res.json({
            success: true,
            message: 'Booking completed and provider payout processed',
            automated: 'Provider payout processed automatically'
        });

    } catch (error) {
        console.error("Error completing booking:", error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete booking'
        });
    }
};

// Cancel booking
// Remove the time check completely
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { reason } = req.body;

        console.log('Cancelling booking:', bookingId);

        const booking = await Booking.findById(bookingId);

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: "Booking not found"
            });
        }

        // Check if user owns this booking
        if (booking.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: "Unauthorized"
            });
        }

        // Check if booking can be cancelled based on status only
        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                error: "Booking is already cancelled"
            });
        }

        if (booking.status === 'completed') {
            return res.status(400).json({
                success: false,
                error: "Cannot cancel a completed booking"
            });
        }

        // No time restrictions - allow cancellation anytime
        // (You can add this back later for production)

        // Update booking
        await Booking.findByIdAndUpdate(bookingId, {
            status: 'cancelled',
            cancellationReason: reason || 'No reason provided',
            cancelledAt: new Date()
        });

        console.log('Booking cancelled successfully');

        res.json({
            success: true,
            message: "Booking cancelled successfully"
        });

    } catch (error) {
        console.error("Error cancelling booking:", error);
        res.status(500).json({
            success: false,
            error: "Failed to cancel booking"
        });
    }
};

// Get booking details
exports.getBookingDetails = async (req, res) => {
    try {
        const bookingId = req.params.id;

        console.log('Fetching booking details for:', bookingId);

        const booking = await Booking.findById(bookingId)
            .populate('service')
            .populate('provider')
            .populate('customer', 'name email phone')
            .populate('providerUserId', 'name email phone');

        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/booking/mybookings');
        }

        // Check if user has access to this booking
        const hasAccess = booking.customer._id.toString() === req.user._id.toString() ||
            (booking.provider.user && booking.provider.user.toString() === req.user._id.toString());

        if (!hasAccess) {
            req.flash('error', 'Unauthorized access');
            return res.redirect('/booking/mybookings');
        }

        console.log('Booking details loaded successfully');

        res.render('pages/booking-details', {
            booking,
            user: req.user,
            title: 'Booking Details'
        });

    } catch (error) {
        console.error("Error fetching booking details:", error);
        req.flash('error', 'Unable to fetch booking details');
        res.redirect('/booking/mybookings');
    }
};

// Booking success page
exports.getBookingSuccess = async (req, res) => {
    try {
        console.log('Loading booking success page for user:', req.user._id);

        let booking = null;
        let payment = null;

        // First try to get the most recent completed booking for this user
        booking = await Booking.findOne({
            customer: req.user._id,
            status: { $in: ['confirmed', 'completed'] }
        })
            .populate('service')
            .populate({
                path: 'provider',
                populate: {
                    path: 'user'
                }
            })
            .sort({ createdAt: -1 });

        if (booking) {
            // Get the most recent payment for this booking
            payment = await Payment.findOne({
                booking: booking._id,
                status: 'completed'
            }).sort({ createdAt: -1 });

            console.log('Found booking and payment for success page');
        } else {
            // If no booking found, try to get the most recent automated payment
            payment = await Payment.findOne({
                status: 'completed',
                paymentType: 'advance' // For automated advance payments
            })
                .populate({
                    path: 'booking',
                    match: { customer: req.user._id },
                    populate: [
                        { path: 'service' },
                        {
                            path: 'provider',
                            populate: { path: 'user' }
                        }
                    ]
                })
                .sort({ createdAt: -1 });

            if (payment && payment.booking) {
                booking = payment.booking;
                console.log('Found booking through payment record');
            }
        }

        // If still no booking/payment found, show a generic success message
        if (!booking && !payment) {
            console.log('No booking or payment found for user:', req.user._id);
        }

        res.render('pages/payment-success', {
            booking: booking || null,
            service: booking ? booking.service : null,
            provider: booking ? booking.provider : null,
            payment: payment || null,
            title: 'Payment Successful',
            user: req.user
        });

    } catch (error) {
        console.error('Error displaying booking success:', error);
        req.flash('error', 'Failed to load booking details');
        res.redirect('/dashboard');
    }
};

// Get all bookings (admin view)
exports.getAllBookings = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        console.log('Admin fetching all bookings, page:', page);

        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }

        const bookings = await Booking.find(query)
            .populate('customer', 'name email phone')
            .populate('service', 'name')
            .populate({
                path: 'provider',
                populate: {
                    path: 'user',
                    select: 'name email phone'
                }
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const totalBookings = await Booking.countDocuments(query);
        const totalPages = Math.ceil(totalBookings / limit);

        console.log(`Found ${bookings.length} bookings out of ${totalBookings} total`);

        res.render('admin/bookings', {
            bookings,
            currentPage: parseInt(page),
            totalPages,
            totalBookings,
            selectedStatus: status || 'all',
            title: 'All Bookings - Admin'
        });

    } catch (error) {
        console.error('Error fetching all bookings:', error);
        req.flash('error', 'Failed to load bookings');
        res.redirect('/admin');
    }
};

// Update booking status (admin)
exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes } = req.body;

        console.log(`Admin updating booking ${id} status to:`, status);

        const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status'
            });
        }

        const updateData = {
            status,
            updatedAt: new Date()
        };

        if (notes) {
            updateData.adminNotes = notes;
        }

        if (status === 'completed') {
            updateData.completedAt = new Date();
            updateData.paymentStatus = 'completed';
        }

        const booking = await Booking.findByIdAndUpdate(id, updateData, { new: true });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        console.log('Booking status updated successfully');

        res.json({
            success: true,
            message: 'Booking status updated successfully',
            booking
        });

    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update booking status'
        });
    }
};