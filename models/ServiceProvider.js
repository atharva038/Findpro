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
  }
});

module.exports = mongoose.model("ServiceProvider", serviceProviderSchema);
