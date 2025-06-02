// routes/payment.js
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const ServiceProvider = require('../models/ServiceProvider');
const { isLoggedIn } = require('../middleware');
const crypto = require('crypto');
const { razorpay, createPayout } = require('../config/razorpay');

// Import automation functions
const {
    processDepositAutomation,
    setupProviderPayoutAutomation
} = require('../utils/paymentAutomation');

// Function to handle provider payouts
async function processProviderPayout(booking, paymentId) {
    try {
        // Load provider with bank details
        const provider = await ServiceProvider.findById(booking.provider);

        if (!provider) {
            console.error('Provider not found for payout');
            return { success: false, error: 'Provider not found' };
        }

        // Calculate provider amount (total - commission)
        const totalAmount = booking.totalCost;
        const commission = Math.round(totalAmount * 0.10); // 10% platform commission
        const providerAmount = totalAmount - commission;

        // Save commission details to booking
        booking.commission = commission;

        // Add to provider's pending payouts if they have bank details
        if (provider.bankDetails && provider.bankDetails.accountNumber) {
            // Create provider payout record in booking
            booking.providerPayout = {
                status: 'pending',
                amount: providerAmount,
                processingAt: new Date()
            };

            // Update provider's pending payouts amount
            provider.pendingPayouts += providerAmount;
            await provider.save();

            console.log(`Provider payout of ₹${providerAmount} scheduled for provider ${provider._id}`);

            return {
                success: true,
                commission,
                providerAmount,
                provider: provider._id,
                hasBankDetails: true
            };
        } else {
            // Provider doesn't have bank details
            // Still add to earnings but mark for attention
            provider.pendingPayouts += providerAmount;
            await provider.save();

            booking.providerPayout = {
                status: 'bank_details_required',
                amount: providerAmount,
                processingAt: new Date()
            };

            console.log(`Provider ${provider._id} missing bank details, marked for manual payout`);

            return {
                success: true,
                commission,
                providerAmount,
                provider: provider._id,
                hasBankDetails: false
            };
        }
    } catch (error) {
        console.error('Error processing provider payout:', error);
        return { success: false, error: error.message };
    }
}

// Helper function to verify payment signature
function verifyPaymentSignature(orderId, paymentId, signature) {
    const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    return generatedSignature === signature;
}


router.post('/create-advance-order', async (req, res) => {
    try {
        console.log('Received create-advance-order request:', req.body);

        const { amount, automation, bookingData, platformConfig } = req.body;

        // Validate required fields
        if (!amount || !automation || !bookingData) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: amount, automation, or bookingData'
            });
        }

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            receipt: `advance_${Date.now()}`,
            notes: {
                payment_type: 'advance',
                automation_enabled: 'true',
                deposit_to_platform: 'true',
                service_id: bookingData.serviceId,
                provider_id: bookingData.providerId
            }
        });

        console.log('Razorpay order created:', order.id);

        // Store automation settings in Payment model WITHOUT booking reference
        const paymentRecord = new Payment({
            // DO NOT include booking field - leave it undefined/null
            orderId: order.id,
            razorpayOrderId: order.id,
            amount: amount,
            type: 'advance',
            paymentType: 'advance',
            status: 'created',
            automation: automation,
            platformAccount: platformConfig?.accountId || 'default_platform_account',
            // Store booking data for later use
            bookingData: {
                serviceId: bookingData.serviceId,
                providerId: bookingData.providerId,
                date: new Date(bookingData.date),
                address: bookingData.address || bookingData.detailedAddress,
                detailedAddress: bookingData.detailedAddress,
                notes: bookingData.notes || "",
                cost: parseFloat(bookingData.cost),
                estimatedRange: bookingData.estimatedRange || ""
            }
        });

        await paymentRecord.save();
        console.log('Payment record saved:', paymentRecord._id);

        res.json({
            success: true,
            orderId: order.id,
            bookingId: null, // Will be created after payment verification
            automation: automation
        });

    } catch (error) {
        console.error('Create advance order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create automated advance order: ' + error.message
        });
    }
});

// Create final order with split payment automation
router.post('/create-final-order', async (req, res) => {
    try {
        console.log('Received create-final-order request:', req.body);

        const { amount, automation, splitDetails, platformConfig } = req.body;

        // Validate required fields
        if (!amount || !automation || !splitDetails) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: amount, automation, or splitDetails'
            });
        }

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: amount * 100, // Convert to paise
            currency: 'INR',
            receipt: `final_${Date.now()}`,
            notes: {
                payment_type: 'final',
                automation_enabled: 'true',
                auto_split: 'true',
                provider_id: splitDetails.providerId
            }
        });

        console.log('Razorpay final order created:', order.id);

        // Store automation and split settings
        const paymentRecord = new Payment({
            orderId: order.id,
            razorpayOrderId: order.id,
            amount: amount,
            type: 'final',
            paymentType: 'final',
            status: 'created',
            automation: automation,
            splitDetails: splitDetails,
            platformAccount: platformConfig?.accountId || 'default_platform_account'
        });

        await paymentRecord.save();
        console.log('Final payment record saved:', paymentRecord._id);

        res.json({
            success: true,
            orderId: order.id,
            automation: automation,
            splitDetails: splitDetails
        });

    } catch (error) {
        console.error('Create final order error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create automated final order: ' + error.message
        });
    }
});



// Update the verify-automated route

router.post('/verify-automated', async (req, res) => {
    try {
        console.log('Received verify-automated request:', req.body);

        const {
            orderId,
            razorpay_payment_id,
            razorpay_signature,
            automationSettings,
            paymentFlow
        } = req.body;

        // Verify signature
        const isValid = verifyPaymentSignature(orderId, razorpay_payment_id, razorpay_signature);

        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        // Find the payment record
        const payment = await Payment.findOne({
            $or: [
                { orderId: orderId },
                { razorpayOrderId: orderId }
            ]
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment record not found'
            });
        }

        // Update payment status
        payment.status = 'completed';
        payment.razorpayPaymentId = razorpay_payment_id;

        if (payment.paymentType === 'advance') {
            // Create the booking now that payment is verified
            const bookingData = payment.bookingData;

            if (bookingData) {
                const newBooking = new Booking({
                    customer: req.user._id,
                    service: bookingData.serviceId,
                    provider: bookingData.providerId,
                    date: bookingData.date,
                    address: bookingData.address || bookingData.detailedAddress,
                    notes: bookingData.notes || "",
                    totalCost: bookingData.cost,
                    cost: bookingData.cost, // Also set cost for backward compatibility
                    status: 'pending',
                    paymentStatus: 'partially_paid',
                    advancePayment: {
                        paid: true,
                        paymentId: razorpay_payment_id,
                        amount: payment.amount
                    },
                    finalPayment: {
                        paid: false,
                        amount: bookingData.cost - payment.amount
                    }
                });

                await newBooking.save();

                // Update payment with booking reference
                payment.booking = newBooking._id;
                console.log('Booking created:', newBooking._id);
            }

            // Process deposit automation
            await processDepositAutomation(payment, razorpay_payment_id);

            await payment.save();

            res.json({
                success: true,
                redirectUrl: '/booking/success',
                depositDetails: {
                    amount: payment.amount,
                    platformAccount: payment.platformAccount,
                    status: 'deposited'
                }
            });

        } else if (payment.paymentType === 'final') {
            // For final payments, booking should already exist
            if (payment.booking) {
                const booking = await Booking.findById(payment.booking);
                if (booking) {
                    booking.status = 'completed';
                    booking.paymentStatus = 'completed';
                    booking.finalPayment = {
                        paid: true,
                        paymentId: razorpay_payment_id,
                        amount: payment.amount
                    };
                    await booking.save();
                }
            }

            // Setup automatic split and provider payout
            await setupProviderPayoutAutomation(payment, razorpay_payment_id);
            await payment.save();

            res.json({
                success: true,
                redirectUrl: '/booking/success',
                automationSetup: {
                    totalAmount: payment.amount,
                    platformCommission: payment.splitDetails?.platformCommission || 0,
                    providerAmount: payment.splitDetails?.providerAmount || 0,
                    autoTransferScheduled: true
                }
            });
        }

    } catch (error) {
        console.error('Verify automated payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Automated payment verification failed: ' + error.message
        });
    }
});

// Add these routes before module.exports = router;

// Create order for manual payments (customer dashboard final payments)
router.post('/create-order', isLoggedIn, async (req, res) => {
    try {
        const { amount, bookingId, paymentType = 'final' } = req.body;

        if (!amount || !bookingId) {
            return res.status(400).json({
                success: false,
                error: 'Amount and booking ID are required'
            });
        }

        // Verify booking exists and user has access
        const booking = await Booking.findById(bookingId)
            .populate('service')
            .populate('customer');

        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        if (booking.customer._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        // Check if provider has confirmed the booking
        if (paymentType === 'final' && booking.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                error: 'Provider must confirm the booking before final payment'
            });
        }

        // Create Razorpay order
        const order = await razorpay.orders.create({
            amount: Math.round(amount * 100), // Convert to paise
            currency: 'INR',
            receipt: `${paymentType}_${bookingId}_${Date.now()}`,
            notes: {
                booking_id: bookingId,
                payment_type: paymentType,
                service_name: booking.service.name
            }
        });

        res.json({
            success: true,
            order: order,
            key: process.env.RAZORPAY_KEY_ID,
            prefill: {
                name: req.user.name,
                email: req.user.email,
                contact: req.user.phone
            }
        });

    } catch (error) {
        console.error('Error creating payment order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create payment order'
        });
    }
});

router.post('/verify-payment', isLoggedIn, async (req, res) => {
    try {
        const {
            razorpay_order_id,     // ✅ Match frontend parameter names
            razorpay_payment_id,   // ✅ Match frontend parameter names
            razorpay_signature,    // ✅ Match frontend parameter names
            bookingId,
            paymentType = 'final'
        } = req.body;

        console.log('Manual payment verification:', {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingId,
            paymentType
        });

        // Verify the payment signature using the correct parameter names
        const isValidSignature = verifyPaymentSignature(
            razorpay_order_id,     // orderId
            razorpay_payment_id,   // paymentId
            razorpay_signature     // signature
        );

        if (!isValidSignature) {
            console.error('Payment signature verification failed:', {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature
            });

            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        // Find the booking
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                error: 'Booking not found'
            });
        }

        // Verify user has access to this booking
        if (booking.customer.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        if (paymentType === 'advance') {
            // Handle advance payment
            const advanceAmount = Math.round(booking.totalCost * 0.15);

            booking.advancePayment = {
                paid: true,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                amount: advanceAmount,
                date: new Date()
            };

            booking.paymentStatus = 'partially_paid';
            booking.status = 'pending'; // Keep as pending until provider confirms

        } else if (paymentType === 'final') {
            // Handle final payment - check if provider confirmed first
            if (booking.status !== 'confirmed') {
                return res.status(400).json({
                    success: false,
                    error: 'Provider must confirm booking before final payment'
                });
            }

            const remainingAmount = booking.totalCost - (booking.advancePayment?.amount || 0);

            booking.finalPayment = {
                paid: true,
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                amount: remainingAmount,
                date: new Date()
            };

            booking.paymentStatus = 'completed';
            booking.status = 'completed';
            booking.completedAt = new Date();

            // Trigger automated provider payout
            try {
                await processProviderPayout(booking, razorpay_payment_id);
                console.log(`✅ Automated payout triggered for booking ${bookingId}`);
            } catch (payoutError) {
                console.error('Provider payout failed:', payoutError);
                // Don't fail the payment, just log the error
            }
        }

        await booking.save();

        // Create payment record
        const payment = new Payment({
            booking: booking._id,
            orderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            amount: paymentType === 'advance' ?
                Math.round(booking.totalCost * 0.15) :
                booking.totalCost - (booking.advancePayment?.amount || 0),
            status: 'completed',
            paymentType,
            type: paymentType,
            customer: req.user._id
        });

        await payment.save();

        res.json({
            success: true,
            message: 'Payment verified successfully',
            booking: {
                id: booking._id,
                status: booking.status,
                paymentStatus: booking.paymentStatus
            }
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Payment verification failed: ' + error.message
        });
    }
});
// Payment success page
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

        res.render('pages/success', {
            booking,
            service: booking.service,
            provider: booking.provider,
            payment,
            title: 'Payment Successful',
            user: req.user
        });
    } catch (error) {
        console.error('Error displaying payment success:', error);
        req.flash('error', 'Error loading payment details');
        res.redirect('/dashboard');
    }
});

// Complete payment for existing booking
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

        // Calculate the remaining amount (85% of total)
        const amount = Math.round(booking.cost * 0.85);

        // Create automation settings for final payment
        const automation = {
            splitOnCompletion: true,
            autoProviderPayout: true,
            commissionDeduction: 10, // 10% platform commission
            transferDelay: 0
        };

        // Calculate split details
        const splitDetails = {
            totalAmount: amount,
            platformCommission: Math.round(amount * 0.10),
            providerAmount: Math.round(amount * 0.90),
            providerId: booking.provider,
            autoTransferEnabled: true
        };

        // Create final payment order
        const order = await razorpay.orders.create({
            amount: amount * 100, // Convert to paise
            currency: "INR",
            receipt: `final_${booking._id}`,
            notes: {
                bookingId: booking._id.toString(),
                serviceName: booking.service.name,
                paymentType: 'final_payment'
            }
        });

        // Store payment record
        const paymentRecord = new Payment({
            booking: booking._id,
            orderId: order.id,
            razorpayOrderId: order.id,
            amount: amount,
            type: 'final',
            paymentType: 'final',
            status: 'created',
            automation: automation,
            splitDetails: splitDetails
        });

        await paymentRecord.save();

        // Send order details to client
        res.json({
            success: true,
            order: order,
            key: process.env.RAZORPAY_KEY_ID,
            booking: {
                id: booking._id,
                service: booking.service.name,
                amount: amount,
                customer: {
                    name: req.user.name,
                    email: req.user.email,
                    phone: req.user.phone
                }
            },
            automation: automation
        });
    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate payment'
        });
    }
});

// Advance payment endpoint
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

        // Calculate the advance amount (15% of total)
        const amount = Math.round(booking.cost * 0.15);

        // Create automation settings for advance payment
        const automation = {
            depositToPlatform: true,
            splitOnCompletion: false,
            autoProviderPayout: false,
            commissionDeduction: 0,
            transferDelay: 0
        };

        // Create a Razorpay order
        const order = await razorpay.orders.create({
            amount: amount * 100, // Convert to paise
            currency: "INR",
            receipt: `advance_${booking._id}`,
            notes: {
                bookingId: booking._id.toString(),
                serviceName: booking.service.name,
                paymentType: 'advance_payment'
            }
        });

        // Store payment record
        const paymentRecord = new Payment({
            booking: booking._id,
            orderId: order.id,
            razorpayOrderId: order.id,
            amount: amount,
            type: 'advance',
            paymentType: 'advance',
            status: 'created',
            automation: automation
        });

        await paymentRecord.save();

        // Send order details to client
        res.json({
            success: true,
            order: order,
            key: process.env.RAZORPAY_KEY_ID,
            booking: {
                id: booking._id,
                service: booking.service.name,
                amount: amount,
                customer: {
                    name: req.user.name,
                    email: req.user.email,
                    phone: req.user.phone
                }
            },
            automation: automation
        });
    } catch (error) {
        console.error('Error initiating advance payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to initiate advance payment'
        });
    }
});

// Update the verify-automated route (around line 261)

router.post('/verify-automated', async (req, res) => {
    try {
        console.log('Received verify-automated request:', req.body);

        const {
            orderId,
            razorpay_payment_id,
            razorpay_signature,
            automationSettings,
            paymentFlow
        } = req.body;

        // Verify signature
        const isValid = verifyPaymentSignature(orderId, razorpay_payment_id, razorpay_signature);

        if (!isValid) {
            return res.status(400).json({
                success: false,
                error: 'Invalid payment signature'
            });
        }

        // Find the payment record
        const payment = await Payment.findOne({
            $or: [
                { orderId: orderId },
                { razorpayOrderId: orderId }
            ]
        });

        if (!payment) {
            return res.status(404).json({
                success: false,
                error: 'Payment record not found'
            });
        }

        // Update payment status
        payment.status = 'completed';
        payment.razorpayPaymentId = razorpay_payment_id;

        if (payment.paymentType === 'advance') {
            // Create the booking now that payment is verified
            const bookingData = payment.bookingData;

            if (bookingData) {
                console.log('Creating booking with data:', bookingData);

                const newBooking = new Booking({
                    customer: req.user._id,
                    service: bookingData.serviceId,
                    provider: bookingData.providerId,
                    date: new Date(bookingData.date),
                    bookingDate: new Date(bookingData.date), // Add this for compatibility
                    address: bookingData.detailedAddress || bookingData.address,
                    notes: bookingData.notes || "",
                    totalCost: parseFloat(bookingData.cost),
                    cost: parseFloat(bookingData.cost), // For backward compatibility
                    status: 'confirmed',
                    paymentStatus: 'partially_paid',
                    advancePayment: {
                        paid: true,
                        paymentId: razorpay_payment_id,
                        amount: payment.amount
                    },
                    finalPayment: {
                        paid: false,
                        amount: parseFloat(bookingData.cost) - payment.amount
                    },
                    // Add location if available
                    location: {
                        type: 'Point',
                        coordinates: [0, 0] // Default coordinates
                    }
                });

                await newBooking.save();
                console.log('✅ Booking created successfully:', newBooking._id);

                // Update payment with booking reference
                payment.booking = newBooking._id;

                // Process deposit automation
                await processDepositAutomation(payment, razorpay_payment_id);
                await payment.save();

                res.json({
                    success: true,
                    redirectUrl: '/booking/success',
                    bookingId: newBooking._id,
                    depositDetails: {
                        amount: payment.amount,
                        platformAccount: payment.platformAccount,
                        status: 'deposited'
                    }
                });

            } else {
                console.error('No booking data found in payment record');
                await payment.save();

                res.json({
                    success: true,
                    redirectUrl: '/booking/success',
                    error: 'Booking data missing but payment processed'
                });
            }

        } else if (payment.paymentType === 'final') {
            // For final payments, booking should already exist
            if (payment.booking) {
                const booking = await Booking.findById(payment.booking);
                if (booking) {
                    booking.status = 'completed';
                    booking.paymentStatus = 'completed';
                    booking.finalPayment = {
                        paid: true,
                        paymentId: razorpay_payment_id,
                        amount: payment.amount
                    };
                    await booking.save();
                    console.log('✅ Booking updated for final payment:', booking._id);
                }
            }

            // Setup automatic split and provider payout
            await setupProviderPayoutAutomation(payment, razorpay_payment_id);
            await payment.save();

            res.json({
                success: true,
                redirectUrl: '/booking/success',
                automationSetup: {
                    totalAmount: payment.amount,
                    platformCommission: payment.splitDetails?.platformCommission || 0,
                    providerAmount: payment.splitDetails?.providerAmount || 0,
                    autoTransferScheduled: true
                }
            });
        }

    } catch (error) {
        console.error('Verify automated payment error:', error);
        res.status(500).json({
            success: false,
            error: 'Automated payment verification failed: ' + error.message
        });
    }
});
// Payment success handling route
router.post('/payment-success', isLoggedIn, async (req, res) => {
    try {
        const {
            bookingId,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature
        } = req.body;

        // Verify payment signature
        const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

        if (!isValid) {
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

            // Process provider payout
            await processProviderPayout(booking, razorpay_payment_id);
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

// Get provider payout history
router.get('/provider-payout/:providerId', isLoggedIn, async (req, res) => {
    try {
        // Ensure user is accessing their own data
        const provider = await ServiceProvider.findById(req.params.providerId);
        if (!provider || !provider.user.equals(req.user._id)) {
            return res.status(403).json({
                success: false,
                error: 'Unauthorized access'
            });
        }

        // Get bookings with payout information
        const bookings = await Booking.find({
            provider: provider._id,
            'providerPayout.status': { $exists: true }
        }).sort({ 'providerPayout.processedAt': -1 }).limit(20);

        // Format data for display
        const recentPayouts = bookings.map(booking => ({
            date: booking.providerPayout.processedAt || booking.updatedAt,
            amount: booking.providerPayout.amount || 0,
            status: booking.providerPayout.status || 'pending',
            bookingId: booking._id,
            reference: booking.providerPayout.transactionId || ''
        }));

        res.json({
            success: true,
            recentPayouts
        });
    } catch (error) {
        console.error('Error fetching payout history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payout history'
        });
    }
});

module.exports = router;