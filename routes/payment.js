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
router.post('/:id/complete-payment', isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customer')
            .populate('service');

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Verify that the user is the customer for this booking
        if (booking.customer._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to complete payment for this booking'
            });
        }

        // Check if booking status allows payment
        if (booking.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                error: 'Can only complete payment for confirmed bookings'
            });
        }

        // Calculate the remaining amount (90% of total)
        const amount = Math.round(booking.totalCost * 90); // Convert to paisa (smallest currency unit)

        // Create a Razorpay order
        const options = {
            amount: amount,
            currency: "INR",
            receipt: `booking_${booking._id}`,
            notes: {
                bookingId: booking._id.toString(),
                serviceName: booking.service.name,
                paymentType: 'final_payment'
            }
        };

        const order = await razorpay.orders.create(options);

        // Send order details to client
        res.json({
            success: true,
            order: order,
            key: razorpay.key_id,
            booking: {
                id: booking._id,
                service: booking.service.name,
                amount: amount / 100, // Convert back to rupees for display
                customer: {
                    name: req.user.name,
                    email: req.user.email,
                    phone: req.user.phone
                }
            }
        });
    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate payment'
        });
    }
});

// Similarly update the advance-payment endpoint
router.post('/:id/advance-payment', isLoggedIn, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('customer')
            .populate('service');

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Verify that the user is the customer for this booking
        if (booking.customer._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to make payment for this booking'
            });
        }

        // Check if booking status allows payment
        if (booking.status !== 'pending') {
            return res.status(400).json({
                success: false,
                error: 'Can only make advance payment for pending bookings'
            });
        }

        // Calculate the advance amount (10% of total)
        const amount = Math.round(booking.totalCost * 10); // Convert to paisa (smallest currency unit)

        // Create a Razorpay order
        const options = {
            amount: amount,
            currency: "INR",
            receipt: `booking_${booking._id}`,
            notes: {
                bookingId: booking._id.toString(),
                serviceName: booking.service.name,
                paymentType: 'advance_payment'
            }
        };

        const order = await razorpay.orders.create(options);

        // Send order details to client
        res.json({
            success: true,
            order: order,
            key: razorpay.key_id,
            booking: {
                id: booking._id,
                service: booking.service.name,
                amount: amount / 100, // Convert back to rupees for display
                customer: {
                    name: req.user.name,
                    email: req.user.email,
                    phone: req.user.phone
                }
            }
        });
    } catch (error) {
        console.error('Error initiating advance payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate advance payment'
        });
    }
});

// This should be defined in your payment routes
router.post('/verify-payment', isLoggedIn, async (req, res) => {
    try {
        console.log("Payment verification request received:", req.body);

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId, paymentType } = req.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !bookingId || !paymentType) {
            console.error("Missing required fields in payment verification:", req.body);
            return res.status(400).json({
                success: false,
                error: 'Missing required payment verification data'
            });
        }

        console.log("Generating signature with:", `${razorpay_order_id}|${razorpay_payment_id}`);
        console.log("Secret key available:", !!process.env.RAZORPAY_KEY_SECRET);

        // Verify the payment signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        console.log("Generated signature:", generatedSignature);
        console.log("Received signature:", razorpay_signature);

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        // Find the booking
        console.log("Finding booking with ID:", bookingId);
        const booking = await Booking.findById(bookingId);

        if (!booking) {
            console.error("Booking not found:", bookingId);
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        console.log("Found booking:", booking);
        console.log("Payment type:", paymentType);

        // Update booking based on payment type
        if (paymentType === 'advance') {
            booking.advancePayment = {
                paid: true,
                amount: booking.totalCost * 0.1,
                date: new Date(),
                transactionId: razorpay_payment_id
            };

            booking.paymentStatus = 'partially_paid';
        } else if (paymentType === 'final') {
            booking.finalPayment = {
                paid: true,
                amount: booking.totalCost * 0.9,
                date: new Date(),
                transactionId: razorpay_payment_id
            };

            booking.status = 'completed';
            booking.paymentStatus = 'completed';
        }

        await booking.save();
        console.log("Booking updated successfully");

        // Create payment record
        console.log("Creating payment record");
        const payment = new Payment({
            booking: booking._id,
            user: req.user._id,
            paymentId: razorpay_payment_id,
            // Change these field names to match your model requirements
            razorpayOrderId: razorpay_order_id,  // Instead of orderId
            type: paymentType === 'advance' ? 'advance' : 'final', // <-- THIS IS THE FIX
            amount: paymentType === 'advance' ? booking.totalCost * 0.1 : booking.totalCost * 0.9,
            status: 'completed'
        });

        await payment.save();
        console.log("Payment record created successfully");

        res.json({
            success: true,
            message: 'Payment verified and booking updated successfully'
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment: ' + error.message
        });
    }
});
module.exports = router;