const express = require('express');
const router = express.Router();
const Booking = require('../../models/Booking');
const { isLoggedIn, isServiceProvider } = require('../../middleware');
const razorpay = require('razorpay');

// Get booking details
router.get('/:id', isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('service')
            .populate({
                path: 'provider',
                populate: { path: 'user' }
            })
            .populate({
                path: 'customer',
                select: 'name email phone'
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Check if user is authorized (either the customer or provider of this booking)
        const isCustomer = booking.customer._id.toString() === req.user._id.toString();
        const isProvider = booking.provider.user._id.toString() === req.user._id.toString();

        if (!isCustomer && !isProvider) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this booking'
            });
        }

        res.json({
            success: true,
            booking
        });
    } catch (error) {
        console.error('Error fetching booking details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch booking details'
        });
    }
});

// Accept booking (for providers)
router.post('/:id/accept', isLoggedIn, isServiceProvider, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({
                path: 'provider',
                populate: { path: 'user' }
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Verify that the user is the provider for this booking
        if (booking.provider.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to accept this booking'
            });
        }

        // Check if booking status allows acceptance
        if (booking.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Can only accept pending bookings'
            });
        }

        booking.status = 'confirmed';
        await booking.save();

        res.json({
            success: true,
            message: 'Booking accepted successfully'
        });
    } catch (error) {
        console.error('Error accepting booking:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to accept booking'
        });
    }
});

// Reject booking (for providers)
router.post('/:id/reject', isLoggedIn, isServiceProvider, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate({
                path: 'provider',
                populate: { path: 'user' }
            });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Verify that the user is the provider for this booking
        if (booking.provider.user._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to reject this booking'
            });
        }

        // Check if booking status allows rejection
        if (booking.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Can only reject pending bookings'
            });
        }

        booking.status = 'cancelled';
        booking.cancellationReason = 'Rejected by service provider';
        await booking.save();

        res.json({
            success: true,
            message: 'Booking rejected successfully'
        });
    } catch (error) {
        console.error('Error rejecting booking:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject booking'
        });
    }
});

// Cancel booking (for customers)
router.post('/:id/cancel', isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Verify that the user is the customer for this booking
        if (booking.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to cancel this booking'
            });
        }

        // Check if booking status allows cancellation
        if (booking.status !== 'pending' && booking.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                error: 'Cannot cancel a booking that is already completed or cancelled'
            });
        }

        booking.status = 'cancelled';
        booking.cancellationReason = 'Cancelled by customer';
        await booking.save();

        res.json({
            success: true,
            message: 'Booking cancelled successfully'
        });
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cancel booking'
        });
    }
});
// router.post('/:id/complete-payment', isLoggedIn, async (req, res) => {
//     try {
//         console.log("Complete payment endpoint hit for booking:", req.params.id);
//         console.log("Current user ID:", req.user._id);

//         const booking = await Booking.findById(req.params.id)
//             .populate('customer')
//             .populate('service');

//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Booking not found'
//             });
//         }
//         console.log("Booking customer ID:", booking.customer._id);
//         console.log("Current user ID:", req.user._id);
//         // Verify that the user is the customer for this booking
//         if (booking.customer.toString() !== req.user._id.toString()) {
//             return res.status(403).json({
//                 success: false,
//                 error: 'Not authorized to complete payment for this booking'
//             });
//         }

//         // Check if booking status allows payment
//         if (booking.status !== 'confirmed') {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Can only complete payment for confirmed bookings'
//             });
//         }

//         const amount = Math.round(booking.totalCost * 0.9 * 100);

//         console.log("Creating Razorpay order for amount:", amount);

//         // Create a Razorpay order
//         const options = {
//             amount: amount,
//             currency: "INR",
//             receipt: `booking_${booking._id}`,
//             notes: {
//                 bookingId: booking._id.toString(),
//                 serviceName: booking.service.name,
//                 paymentType: 'final_payment'
//             }
//         };

//         // Make sure razorpay is properly initialized
//         if (!razorpay || !razorpay.orders) {
//             console.error("Razorpay not properly initialized");
//             return res.status(500).json({
//                 success: false,
//                 error: 'Payment service unavailable'
//             });
//         }

//         const order = await razorpay.orders.create(options);
//         console.log("Order created:", order);

//         // Send order details to client
//         res.json({
//             success: true,
//             order: order,
//             key: process.env.RAZORPAY_KEY_ID,
//             booking: {
//                 id: booking._id,
//                 service: booking.service.name,
//                 amount: amount / 100, // Convert back to rupees for display
//                 customer: {
//                     name: req.user.name,
//                     email: req.user.email,
//                     phone: req.user.phone || ''
//                 }
//             }
//         });
//     } catch (error) {
//         console.error('Error initiating payment:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to initiate payment: ' + error.message
//         });
//     }
// });

// router.post('/:id/advance-payment', isLoggedIn, async (req, res) => {
//     try {
//         console.log("Advance payment endpoint hit for booking:", req.params.id);

//         const booking = await Booking.findById(req.params.id)
//             .populate('customer')
//             .populate('service');

//         if (!booking) {
//             return res.status(404).json({
//                 success: false,
//                 error: 'Booking not found'
//             });
//         }

//         // Verify that the user is the customer for this booking
//         if (booking.customer._id.toString() !== req.user._id.toString()) {
//             return res.status(403).json({
//                 success: false,
//                 error: 'Not authorized to make payment for this booking'
//             });
//         }

//         // Check if booking status allows payment
//         if (booking.status !== 'pending') {
//             return res.status(400).json({
//                 success: false,
//                 error: 'Can only make advance payment for pending bookings'
//             });
//         }

//         // Calculate the advance amount (10% of total) in smallest currency unit (paisa for INR)
//         const amount = Math.round(booking.totalCost * 0.1 * 100);

//         console.log("Creating Razorpay order for amount:", amount);

//         // Create a Razorpay order
//         const options = {
//             amount: amount,
//             currency: "INR",
//             receipt: `booking_${booking._id}`,
//             notes: {
//                 bookingId: booking._id.toString(),
//                 serviceName: booking.service.name,
//                 paymentType: 'advance_payment'
//             }
//         };

//         const order = await razorpay.orders.create(options);
//         console.log("Order created:", order);

//         // Send order details to client
//         res.json({
//             success: true,
//             order: order,
//             key: process.env.RAZORPAY_KEY_ID,
//             booking: {
//                 id: booking._id,
//                 service: booking.service.name,
//                 amount: amount / 100, // Convert back to rupees for display
//                 customer: {
//                     name: req.user.name,
//                     email: req.user.email,
//                     phone: req.user.phone || ''
//                 }
//             }
//         });
//     } catch (error) {
//         console.error('Error initiating advance payment:', error);
//         res.status(500).json({
//             success: false,
//             error: 'Failed to initiate advance payment: ' + error.message
//         });
//     }
// });
module.exports = router;