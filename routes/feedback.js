const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware');
const Booking = require('../models/Booking');

// Render feedback page
router.get('/:bookingId', isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate('service')
            .populate({
                path: 'provider',
                populate: { path: 'user' }
            });

        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard');
        }

        res.render('pages/feedback', {
            booking,
            service: booking.service,  // Pass service from booking
            provider: booking.provider // Pass provider from booking
        });
    } catch (error) {
        console.error('Error loading feedback page:', error);
        req.flash('error', 'Failed to load feedback page');
        res.redirect('/dashboard');
    }
});

// Handle feedback submission
router.post('/submit', isLoggedIn, async (req, res) => {
    try {
        const { bookingId, rating, comment } = req.body;

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        booking.feedback = {
            rating: parseInt(rating),
            comment,
            submittedAt: new Date(),
            submittedBy: req.user._id
        };

        await booking.save();

        res.json({
            success: true,
            message: 'Feedback submitted successfully'
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit feedback'
        });
    }
});

module.exports = router;