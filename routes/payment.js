// routes/payment.js
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const { isLoggedIn } = require('../middleware');

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create advance payment order (10%)
router.post('/create-advance-order', isLoggedIn, async (req, res) => {
    try {
        const { bookingId } = req.body;
        const booking = await Booking.findById(bookingId).populate('service');

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        const totalAmount = booking.service.cost;
        const advanceAmount = Math.round(totalAmount * 0.1 * 100); // 10% in paise

        const order = await razorpay.orders.create({
            amount: advanceAmount,
            currency: 'INR',
            receipt: `advance_${bookingId}`,
            notes: {
                bookingId: bookingId,
                type: 'advance'
            }
        });

        // Create payment record
        const payment = new Payment({
            booking: bookingId,
            razorpayOrderId: order.id,
            amount: advanceAmount / 100, // Convert back to rupees
            type: 'advance'
        });
        await payment.save();

        res.json({ order });
    } catch (error) {
        console.error('Payment order creation failed:', error);
        res.status(500).json({ error: 'Payment initialization failed' });
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
router.post('/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Verify signature
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // Update payment status
        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
        payment.status = 'completed';
        payment.razorpayPaymentId = razorpay_payment_id;

        if (payment.type === 'final') {
            // Calculate commission and provider amount
            const totalAmount = payment.amount;
            payment.commission = totalAmount * 0.15; // 15% commission
            payment.providerAmount = totalAmount - payment.commission;

            // Update booking status
            await Booking.findByIdAndUpdate(payment.booking, { status: 'completed' });

            // Here you would integrate with your payment gateway to transfer 
            // the providerAmount to the provider's account
        }

        await payment.save();
        res.json({ success: true });
    } catch (error) {
        console.error('Payment verification failed:', error);
        res.status(500).json({ error: 'Payment verification failed' });
    }
});

module.exports = router;