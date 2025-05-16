const mongoose = require("mongoose");

const serviceProviderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Group services category-wise
  servicesOffered: [
    {
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true,
      },
      services: [
        {
          service: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Service",
            required: true,
          },
          customCost: { type: Number },
          experience: { type: String }, // e.g. "2 years"
        },
      ],
    },
  ],

  addresses: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],

  portfolio: [
    {
      img: String,
      description: String,
    },
  ],

  // Optional general experience field
  experience: {
    type: Number,
    min: 0,
  },
  earnings: {
    type: Number,
    default: 0
  },

  // Add availability schema
  availability: {
    monday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: String,  // Format: "HH:MM" (24-hour)
        endTime: String,    // Format: "HH:MM" (24-hour)
        isActive: { type: Boolean, default: true }
      }]
    },
    tuesday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: String,
        endTime: String,
        isActive: { type: Boolean, default: true }
      }]
    },
    wednesday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: String,
        endTime: String,
        isActive: { type: Boolean, default: true }
      }]
    },
    thursday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: String,
        endTime: String,
        isActive: { type: Boolean, default: true }
      }]
    },
    friday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: String,
        endTime: String,
        isActive: { type: Boolean, default: true }
      }]
    },
    saturday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: String,
        endTime: String,
        isActive: { type: Boolean, default: true }
      }]
    },
    sunday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: String,
        endTime: String,
        isActive: { type: Boolean, default: true }
      }]
    }
  },

  // Provider can set their overall status
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);