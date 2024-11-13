const mongoose = require("mongoose");

// Define the Service Schema
const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  ratings: {
    type: Number,
    default: 0,
  },
  reviews: {
    type: Number,
    default: 0,
  },
  img: {
    type: String,
    required: true,
  },
  providers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ServiceProvider",
    },
  ],
  duration: {
    type: Number, // Duration in minutes
    default: 60,  // Default value
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category", // Reference to Category
    required: true,
  },
});

const Service = mongoose.model("Service", serviceSchema);
module.exports = Service;
