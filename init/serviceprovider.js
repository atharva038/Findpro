const mongoose = require("mongoose");

const User = require("../models/User");
const Service = require("../models/Service");
const ServiceProvider = require("../models/ServiceProvider");
const Category = require("../models/category"); // Ensure correct casing for the model

mongoose
  .connect("mongodb://localhost:27017/findpro", {})
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log("Database connection error", err);
  });

// Function to add service providers
const addServiceProviders = async () => {
  try {
    const providersList = await User.find({ role: "provider" });

    const plumbingCategory = await Category.findOne({ name: "Plumbing" });
    const electricalCategory = await Category.findOne({ name: "Electrical" });

    const plumbingServices = await Service.find({
      category: plumbingCategory._id,
    });
    const electricalServices = await Service.find({
      category: electricalCategory._id,
    });

    const providers = [
      {
        user: providersList[0]._id,
        servicesOffered: plumbingServices.map((service) => service._id), // Link service ObjectId
        serviceCategories: [plumbingCategory._id], // Use Category ObjectId
        experience: 8,
        portfolio: [
          {
            img: "https://static.vecteezy.com/system/resources/previews/036/385/324/non_2x/indian-plumber-installing-water-equipment-meter-filter-and-pressure-reducer-photo.jpg",
            description: "Expert plumbing work done for a luxury hotel.",
          },
        ],
      },
      {
        user: providersList[1]._id,
        servicesOffered: electricalServices.map((service) => service._id), // Link service ObjectId
        serviceCategories: [electricalCategory._id], // Use Category ObjectId
        experience: 5,
        portfolio: [
          {
            img: "https://st3.depositphotos.com/1005682/14753/i/450/depositphotos_147539081-stock-photo-electrician-working-with-switchboard.jpg",
            description: "Handled electrical setup for a housing project.",
          },
        ],
      },
    ];

    await ServiceProvider.insertMany(providers);
    console.log("Service providers added successfully");
  } catch (error) {
    console.error("Error adding providers:", error);
  } finally {
    mongoose.connection.close();
  }
};

addServiceProviders();
