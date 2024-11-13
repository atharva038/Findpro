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
    ref: "ServiceProvider", // Reference to the service provider
    required: true,
  },
  address: { type: String, required: true },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "cancelled"],
    default: "pending",
  },
  notes: { type: String },
});

module.exports = mongoose.model("Booking", bookingSchema);
