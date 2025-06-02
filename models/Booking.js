const mongoose = require("mongoose");

// Define the Booking Schema
const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to the customer (User model)
    required: true,
  },
  providerUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider",
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service", // Reference to the service
    required: true,
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ServiceProvider", // Reference to the service providerge
    required: true,
  },
  address: {
    type: String,
    required: true
  },
  // Add both date fields for compatibility
  date: {
    type: Date,
    required: true
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      default: [0, 0]
    }
  },
  notes: {
    type: String
  },
  // Add both cost fields for compatibility
  totalCost: {
    type: Number,
    required: true
  },
  cost: {
    type: Number // For backward compatibility
  },
  providerConfirmation: {
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    confirmedAt: Date,
    rejectionReason: String
  },
  advancePayment: {
    amount: Number,
    paymentId: String,
    orderId: String,
    paid: {
      type: Boolean,
      default: false
    },
    date: Date // Add payment date
  },
  finalPayment: {
    amount: Number,
    paymentId: String,
    orderId: String,
    paid: {
      type: Boolean,
      default: false
    },
    date: Date // Add payment date
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partially_paid', 'completed', 'refunded'],
    default: 'pending'
  },
  feedback: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      maxLength: 1000
    },
    recommend: {
      type: Boolean,
      default: null
    },
    submittedAt: {
      type: Date,
      default: Date.now
    }
  },
  providerPayout: {
    id: String,
    status: {
      type: String,
      enum: ['pending', 'processing', 'processed', 'failed', 'success', 'bank_details_required'],
      default: 'pending'
    },
    amount: Number,
    paidAt: Date,
    processingAt: Date,
    transactionId: String
  },
  commission: {
    type: Number,
    default: 0
  },
  // Add automation tracking fields
  automationStatus: {
    depositProcessed: { type: Boolean, default: false },
    splitConfigured: { type: Boolean, default: false },
    providerPayoutScheduled: { type: Boolean, default: false },
    automationCompleted: { type: Boolean, default: false }
  },
  // Add completion tracking
  completedAt: Date,
  cancelledAt: Date,
  cancellationReason: String
}, {
  timestamps: true // Add createdAt and updatedAt automatically
});

// Pre-save middleware to ensure field consistency
bookingSchema.pre('save', function (next) {
  // Ensure cost and totalCost are synchronized
  if (this.totalCost && !this.cost) {
    this.cost = this.totalCost;
  } else if (this.cost && !this.totalCost) {
    this.totalCost = this.cost;
  }

  // Ensure date and bookingDate are synchronized
  if (this.date && !this.bookingDate) {
    this.bookingDate = this.date;
  } else if (this.bookingDate && !this.date) {
    this.date = this.bookingDate;
  }

  // Set completion timestamp
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }

  // Set cancellation timestamp
  if (this.status === 'cancelled' && !this.cancelledAt) {
    this.cancelledAt = new Date();
  }

  next();
});

// Add indexes for better query performance
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ provider: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });

module.exports = mongoose.model("Booking", bookingSchema);