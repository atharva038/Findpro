const mongoose = require("mongoose");
const User = require("../models/User");
const Service = require("../models/Service");

mongoose
  .connect("mongodb://localhost:27017/findpro", {})
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log("Database connection error", err);
  });

// Sample user data
const users = [
  {
    name: "Ravi Kumar",
    email: "ravi.kumar@gmail.com",

    role: "customer",
    address: "A-45, Connaught Place, Delhi",
    phone: "9876543210",
    servicesOffered: [], // Customers usually won't have this field filled
  },
  {
    name: "Anjali Mehta",
    email: "anjali.mehta@gmail.com",

    role: "customer",
    address: "101, MG Road, Mumbai",
    phone: "9876543111",
    servicesOffered: [],
  },
  {
    name: "Suraj Sharma",
    email: "suraj.sharma@provider.com",

    role: "provider",
    address: "B-102, Jayanagar, Bengaluru",
    phone: "9876543222",
    serviceCategories: ["Plumbing"], // Example category
    servicesOffered: [
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b76c"), // Example service ID
    ],
  },
  {
    name: "Vinay Shinde",
    email: "vindayshinde@provider.com",

    role: "provider",
    address: "nd2 , Cidco , Nanded",
    phone: "9876543223",
    serviceCategories: ["Electrition"], // Example category
    servicesOffered: [
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b76d"), // Example service ID
    ],
  },
  {
    name: "Shweta Shinde",
    email: "shwetashinde@provider.com",

    role: "provider",
    address: "Bhagya Nagar , Nanded",
    phone: "9876543225",
    serviceCategories: ["Cleaning"], // Example category
    servicesOffered: [
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b76f"), // Example service ID
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b76e"), // Example service ID
    ],
  },
  {
    name: "Pramod Bandgar",
    email: "pramodbandgar@provider.com",

    role: "provider",
    address: "Bhagya Nagar , Nanded",
    phone: "9876543299",
    serviceCategories: ["Cleaning"], // Example category
    servicesOffered: [
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b76f"), // Example service ID
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b76e"), // Example service ID
    ],
  },

  {
    name: "Vinod Bandgar",
    email: "vinodbandgar@provider.com",

    role: "provider",
    address: " New monda , Nanded",
    phone: "9876543224",
    serviceCategories: ["Appliance Repair"], // Example category
    servicesOffered: [
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b770"), // Example service ID
    ],
  },
  {
    name: "Ram Kamble",
    email: "ramkamble@provider.com",

    role: "provider",
    address: " New monda , Nanded",
    phone: "98765432872",
    serviceCategories: ["Carpentry"], // Example category
    servicesOffered: [
      new mongoose.Types.ObjectId("66fee0b4ae2fe58e0c33b771"), // Example service ID
    ],
  },
];

const addNewUser = async () => {
  await User.insertMany(users); // This only adds new data, without deleting existing records
  console.log("New users added");
};

addNewUser().then(() => {
  mongoose.connection.close();
});
