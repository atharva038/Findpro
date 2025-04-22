const mongoose = require("mongoose");

// Define the Category Schema
const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  img: {
    type: String, // Field for the category image URL
    required: true, // Ensure an image is provided
  },
  isActive: {
    type: Boolean,
    default: true
  },
  services: [
    {
      type: mongoose.Schema.Types.ObjectId, // Change to ObjectId
      ref: "Service", // Reference to Service
    },
  ],
});

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
