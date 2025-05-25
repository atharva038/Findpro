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
  serviceArea: {
    radius: { type: Number, default: 20 },
    city: { type: String },
    state: { type: String },
    pincode: { type: String }
  },

  // Specific service areas/locations
  serviceAreas: [
    {
      address: { type: String },
      lat: { type: Number },
      lng: { type: Number },
      radius: { type: Number, default: 10 }
    }
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
        startTime: { type: String, default: "07:00" },
        endTime: { type: String, default: "21:00" },
        isActive: { type: Boolean, default: true }
      }]
    },
    tuesday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: { type: String, default: "07:00" },
        endTime: { type: String, default: "21:00" },
        isActive: { type: Boolean, default: true }
      }]
    },
    wednesday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: { type: String, default: "07:00" },
        endTime: { type: String, default: "21:00" },
        isActive: { type: Boolean, default: true }
      }]
    },
    thursday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: { type: String, default: "07:00" },
        endTime: { type: String, default: "21:00" },
        isActive: { type: Boolean, default: true }
      }]
    },
    friday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: { type: String, default: "07:00" },
        endTime: { type: String, default: "21:00" },
        isActive: { type: Boolean, default: true }
      }]
    },
    saturday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: { type: String, default: "07:00" },
        endTime: { type: String, default: "21:00" },
        isActive: { type: Boolean, default: true }
      }]
    },
    sunday: {
      isAvailable: { type: Boolean, default: true },
      slots: [{
        startTime: { type: String, default: "07:00" },
        endTime: { type: String, default: "21:00" },
        isActive: { type: Boolean, default: true }
      }]
    }
  },
  travelFeeEnabled: {
    type: Boolean,
    default: false
  },
  travelFeeAmount: {
    type: Number,
    default: 5
  },
  // Provider can set their overall status
  isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);