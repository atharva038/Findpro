const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        // Remove the required constraint entirely for automated payments
        required: false
    },
    orderId: String, // For automated payments
    razorpayOrderId: {
        type: String,
        required: true
    },
    razorpayPaymentId: String,
    amount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['advance', 'final'],
        required: true
    },
    paymentType: { // For new automation system
        type: String,
        enum: ['advance', 'final']
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'created'],
        default: 'pending'
    },
    commission: {
        type: Number,
        default: 0
    },
    providerAmount: {
        type: Number,
        default: 0
    },

    // Temporary storage for booking data during payment processing
    bookingData: {
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
        providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider' },
        date: Date,
        address: String,
        detailedAddress: String,
        notes: String,
        cost: Number,
        estimatedRange: String
    },

    // Automation fields
    automation: {
        depositToPlatform: { type: Boolean, default: false },
        splitOnCompletion: { type: Boolean, default: false },
        autoProviderPayout: { type: Boolean, default: false },
        commissionDeduction: { type: Number, default: 0 },
        transferDelay: { type: Number, default: 0 }
    },

    // Split payment details
    splitDetails: {
        totalAmount: Number,
        platformCommission: Number,
        providerAmount: Number,
        providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'ServiceProvider' },
        providerBankDetails: Object,
        autoTransferEnabled: { type: Boolean, default: false },
        transferStatus: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending'
        },
        transferDate: Date
    },

    // Platform account details
    platformAccount: String,

    // Automation status
    automationStatus: {
        depositProcessed: { type: Boolean, default: false },
        splitConfigured: { type: Boolean, default: false },
        providerPayoutScheduled: { type: Boolean, default: false },
        automationCompleted: { type: Boolean, default: false }
    },

    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);