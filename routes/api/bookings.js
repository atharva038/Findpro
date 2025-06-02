const express = require('express');
const router = express.Router();
const Booking = require('../../models/Booking');
const ServiceProvider = require('../../models/ServiceProvider');
const { isLoggedIn } = require('../../middleware');

// Get booking details
router.get('/:id', isLoggedIn, async (req, res) => {
    try {
        const bookingId = req.params.id;

        const booking = await Booking.findById(bookingId)
            .populate({
                path: 'service',
                select: 'name img price description'
            })
            .populate({
                path: 'customer',
                select: 'name email phone profileImage'
            })
            .populate({
                path: 'provider',
                populate: {
                    path: 'user',
                    select: 'name email phone'
                }
            })
            .lean();

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Check if user has access to this booking
        const isCustomer = booking.customer._id.toString() === req.user._id.toString();
        const isProvider = booking.provider && booking.provider.user &&
            booking.provider.user._id.toString() === req.user._id.toString();

        if (!isCustomer && !isProvider) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
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

// Accept booking (Provider only)
router.post('/:id/accept', isLoggedIn, async (req, res) => {
    try {
        const bookingId = req.params.id;

        // Find the provider
        const provider = await ServiceProvider.findOne({ user: req.user._id });
        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Find and update the booking
        const booking = await Booking.findOne({
            _id: bookingId,
            provider: provider._id,
            status: 'pending'
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found or already processed'
            });
        }

        // Update booking status
        booking.status = 'confirmed';
        booking.providerConfirmation = {
            status: 'accepted',
            confirmedAt: new Date()
        };

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

// Reject booking (Provider only)
router.post('/:id/reject', isLoggedIn, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { reason } = req.body;

        // Find the provider
        const provider = await ServiceProvider.findOne({ user: req.user._id });
        if (!provider) {
            return res.status(404).json({
                success: false,
                error: 'Provider profile not found'
            });
        }

        // Find and update the booking
        const booking = await Booking.findOne({
            _id: bookingId,
            provider: provider._id,
            status: 'pending'
        });

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found or already processed'
            });
        }

        // Update booking status
        booking.status = 'cancelled';
        booking.providerConfirmation = {
            status: 'rejected',
            rejectionReason: reason || 'No reason provided'
        };
        booking.cancelledAt = new Date();
        booking.cancellationReason = reason || 'Rejected by provider';

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

module.exports = router;