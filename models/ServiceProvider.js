const mongoose = require("mongoose");

// Define the Service Provider Schema
const serviceProviderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Reference to User model
    required: true,
  },
  servicesOffered: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service", // Reference to Service
    },
  ],
  addresses:[
    {
      type:mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  experience: {
    type: Number,
    min: 0, // Ensure experience is non-negative
  },
  portfolio: [
    {
      img: {
        type: String,
        required: false, // Image is optional
      },
      description: {
        type: String,
        required: false, // Description is optional
      },
    },
  ],
  serviceCategories: [
    {
      type: mongoose.Schema.Types.ObjectId, // Reference to Category model
      ref: "Category",
      required: true,
    },
  ],
  cost: [
    {
      type: Number,
    },
  ],
});

const ServiceProvider = mongoose.model(
  "ServiceProvider",
  serviceProviderSchema
);
module.exports = ServiceProvider;
