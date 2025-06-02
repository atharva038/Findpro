const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const ServiceProvider = require('../models/ServiceProvider');

// Process deposit automation
async function processDepositAutomation(payment, razorpayPaymentId) {
    try {
        console.log(`Processing deposit automation for payment ${payment._id}`);

        // Update payment automation status
        await Payment.findByIdAndUpdate(payment._id, {
            'automationStatus.depositProcessed': true,
            razorpayPaymentId: razorpayPaymentId,
            status: 'completed'
        });

        console.log(`✅ Deposit automation completed for payment ${payment._id}`);
        return true;

    } catch (error) {
        console.error('Deposit automation failed:', error);
        throw error;
    }
}

// Setup provider payout automation
async function setupProviderPayoutAutomation(payment, razorpayPaymentId) {
    try {
        console.log(`Setting up provider payout automation for payment ${payment._id}`);

        // Update payment record
        await Payment.findByIdAndUpdate(payment._id, {
            'automationStatus.splitConfigured': true,
            'automationStatus.providerPayoutScheduled': true,
            razorpayPaymentId: razorpayPaymentId, // Fixed field name
            status: 'completed'
        });

        // Update booking with final payment if booking exists
        if (payment.booking) {
            await Booking.findByIdAndUpdate(payment.booking, {
                'finalPayment.paid': true,
                'finalPayment.paymentId': razorpayPaymentId,
                'finalPayment.amount': payment.amount,
                'paymentStatus': 'completed'
            });
        }

        console.log(`✅ Provider payout automation setup for payment ${payment._id}`);
        return true;

    } catch (error) {
        console.error('Provider payout automation setup failed:', error);
        throw error;
    }
}

// Process provider payout when work is completed
async function processProviderPayout(bookingId) {
    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) {
            throw new Error('Booking not found');
        }

        const finalPayment = await Payment.findOne({
            booking: bookingId,
            paymentType: 'final'
        });

        if (!finalPayment || !finalPayment.automation.autoProviderPayout) {
            return false;
        }

        // Calculate amounts
        const { platformCommission, providerAmount, providerId } = finalPayment.splitDetails;

        // Get provider bank details
        const provider = await ServiceProvider.findById(providerId).populate('user');

        if (!provider.bankDetails || !provider.bankDetails.verified) {
            throw new Error('Provider bank details not verified');
        }

        // Create transfer to provider (implement your preferred method)
        const transferResult = await createProviderTransfer({
            amount: providerAmount,
            bankDetails: provider.bankDetails,
            providerId: providerId,
            bookingId: bookingId
        });

        // Update payment record
        await Payment.findByIdAndUpdate(finalPayment._id, {
            'splitDetails.transferStatus': 'completed',
            'splitDetails.transferDate': new Date(),
            'automationStatus.automationCompleted': true
        });

        console.log(`✅ Provider payout completed: ₹${providerAmount} to ${provider.user.name}`);
        return transferResult;

    } catch (error) {
        console.error('Provider payout failed:', error);
        throw error;
    }
}

// Create transfer to provider account
async function createProviderTransfer({ amount, bankDetails, providerId, bookingId }) {
    // Implement your preferred transfer method (bank transfer, UPI, etc.)
    // This could be through Razorpay Fund Account or direct bank transfer

    console.log(`Processing transfer of ₹${amount} to provider ${providerId}`);
    console.log('Bank details:', bankDetails);

    // TODO: Implement actual bank transfer logic here
    // For now, returning a mock success response

    return {
        transferId: `transfer_${Date.now()}`,
        amount: amount,
        status: 'completed',
        providerId: providerId,
        bookingId: bookingId
    };
}

module.exports = {
    processDepositAutomation,
    setupProviderPayoutAutomation,
    processProviderPayout,
    createProviderTransfer
};