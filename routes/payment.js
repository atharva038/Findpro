// routes/payment.js
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { isLoggedIn } = require('../middleware');
const crypto = require('crypto');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create advance payment order (10%)
router.post('/create-order', isLoggedIn, async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        const { amount, bookingData } = req.body;

        if (!amount || !bookingData) {
            return res.status(400).json({
                success: false,
                error: 'Invalid request data'
            });
        }
        if (!bookingData || !bookingData.serviceId || !bookingData.providerId) {
            return res.status(400).json({
                success: false,
                error: 'Missing booking details'
            });
        }
        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100), // Convert to paise
            currency: 'INR',
            receipt: `order_${Date.now()}`,
            notes: {
                serviceId: bookingData.serviceId,
                providerId: bookingData.providerId
            }
        });

        // Create booking
        const booking = new Booking({
            service: bookingData.serviceId,
            provider: bookingData.providerId,
            customer: req.user._id,
            scheduledTime: new Date(bookingData.date),
            address: bookingData.address,
            notes: bookingData.notes || '',
            totalCost: bookingData.cost,
            status: 'pending'
        });
        await booking.save();

        // Create payment record
        const payment = new Payment({
            booking: booking._id,
            razorpayOrderId: order.id,
            amount: amount,
            type: 'advance',
            status: 'pending'
        });
        await payment.save();

        res.json({
            success: true,
            orderId: order.id,
            bookingId: booking._id,
            amount: amount
        });

    } catch (error) {
        console.error('Order creation failed:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create order'
        });
    }
});

// Create final payment order (90% + platform fee)
router.post('/create-final-order', isLoggedIn, async (req, res) => {
    try {
        const { bookingId } = req.body;
        const booking = await Booking.findById(bookingId).populate('service');

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const totalAmount = booking.service.cost;
        const finalAmount = Math.round(totalAmount * 0.9 * 100); // 90% in paise

        const order = await razorpay.orders.create({
            amount: finalAmount,
            currency: 'INR',
            receipt: `final_${bookingId}`,
            notes: {
                bookingId: bookingId,
                type: 'final'
            }
        });

        const payment = new Payment({
            booking: bookingId,
            razorpayOrderId: order.id,
            amount: finalAmount / 100,
            type: 'final'
        });
        await payment.save();

        res.json({ order });
    } catch (error) {
        console.error('Payment order creation failed:', error);
        res.status(500).json({ error: 'Payment initialization failed' });
    }
});

// Verify payment and update status
router.post('/verify', isLoggedIn, async (req, res) => {
    try {
        const {
            orderId,
            bookingId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        } = req.body;

        // Verify payment signature
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        // Update payment status
        const payment = await Payment.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            {
                status: 'completed',
                razorpayPaymentId: razorpay_payment_id
            },
            { new: true }
        );

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment record not found'
            });
        }

        // Update booking status
        const booking = await Booking.findByIdAndUpdate(
            bookingId,
            {
                status: 'pending',
                paymentStatus: 'completed',
                advancePayment: {
                    paid: true,
                    amount: payment.amount,
                    paymentId: razorpay_payment_id,
                    paidAt: new Date()
                }
            },
            { new: true }
        );

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Return success with redirect URL
        res.json({
            success: true,
            redirectUrl: `/payment/success/${booking._id}`  // Make sure this matches your route
        });

    } catch (error) {
        console.error('Payment verification failed:', error);
        res.status(500).json({
            success: false,
            error: 'Payment verification failed'
        });
    }
});
router.post('/payment-success', isLoggedIn, async (req, res) => {
    try {
        const {
            bookingId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        } = req.body;

        // Verify payment signature
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            req.flash('error', 'Payment verification failed');
            return res.redirect('/dashboard');
        }

        // Find and update payment
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        if (!payment) {
            req.flash('error', 'Payment record not found');
            return res.redirect('/dashboard');
        }

        payment.status = 'completed';
        payment.razorpayPaymentId = razorpay_payment_id;
        await payment.save();

        // Update booking status
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard');
        }

        if (payment.type === 'advance') {
            booking.status = 'confirmed';
            booking.advancePayment = {
                paid: true,
                amount: payment.amount,
                paymentId: razorpay_payment_id
            };
        } else if (payment.type === 'final') {
            booking.status = 'completed';
            booking.finalPayment = {
                paid: true,
                amount: payment.amount,
                paymentId: razorpay_payment_id
            };

            // Calculate and save commission
            const commission = Math.round(payment.amount * 0.15); // 15% commission
            booking.commission = commission;

            // Update provider's earnings
            const providerAmount = payment.amount - commission;
            await ServiceProvider.findByIdAndUpdate(booking.provider, {
                $inc: { earnings: providerAmount }
            });
        }

        await booking.save();
        req.flash('success', 'Payment successful! Booking confirmed.');
        res.redirect('/dashboard');

    } catch (error) {
        console.error('Payment success handling failed:', error);
        req.flash('error', 'Failed to process payment');
        res.redirect('/dashboard');
    }
});

// Add this route to handle payment success page
router.get('/success/:bookingId', isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate('service')
            .populate({
                path: 'provider',
                populate: {
                    path: 'user'
                }
            });

        if (!booking) {
            req.flash('error', 'Booking not found');
            return res.redirect('/dashboard');
        }

        const payment = await Payment.findOne({
            booking: booking._id,
            status: 'completed'
        }).sort({ createdAt: -1 });

        if (!payment) {
            req.flash('error', 'Payment record not found');
            return res.redirect('/dashboard');
        }

        res.render('pages/payment-success', {
            booking,
            service: booking.service,
            provider: booking.provider,
            payment
        });
    } catch (error) {
        console.error('Error displaying payment success:', error);
        req.flash('error', 'Error loading payment details');
        res.redirect('/dashboard');
    }
});


module.exports = router;