// addNewServices();
const mongoose = require("mongoose");
const Service = require("../models/Service");
const Category = require("../models/category");

// Connect to MongoDB
mongoose
  .connect("mongodb://localhost:27017/findpro", {})
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log("Database connection error", err);
  });

const addNewServices = async () => {
  const serviceDataArray = [
    {
      name: "Chimney repair and service",
      description:
        "Industry grade chemicals used for better working in the long term",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.74,
      img: "https://www.shutterstock.com/image-photo/mans-hands-removing-filter-cooker-600nw-2287359873.jpg",
    },
    {
      name: "Gas Stove Repair and service",
      description: "Prevents gas leak on regular servicing",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.76,
      img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQOPALjIzxJd9oskkyPN4hbhC2kh21DSxIk3w&s",
    },
    {
      name: "Geyser repair and service",
      description:
        "standardised repair process, faster heating and electricity saving on servicing",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.77,
      img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZz0WE32o_USI6Ovn2r-Cq5KhcUpMcB6nfaw&s",
    },
    {
      name: "Inverter repair and service",
      description: "standardised repair process",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.67,
      img: "https://www.shutterstock.com/image-photo/instalation-control-inverters-solar-panel-260nw-2227360299.jpg",
    },
    {
      name: "TV repair",
      description: "we do not repair commercial appliances",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.76,
      img: "https://img.freepik.com/premium-photo/repairman-installing-tv-set_274689-11751.jpg?semt=ais_hybrid",
    },
    {
      name: "Refrigrator Repair",
      description: "standardised repair process",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.78,
      img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTNuL6J3AVwCMATocbEMob_L7ZJTQ652YyNwg&s",
    },
    {
      name: "AC Repair",
      description: "Ac repair using high quality spare parts and tools",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.45,
      img: "https://www.shutterstock.com/image-photo/air-conditioner-service-indoors-cleaning-600nw-2291045833.jpg",
    },
    {
      name: "Water purifier repair",
      description: "The repair quote will be provided after the checkup",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.78,
      img: "https://media.gettyimages.com/id/1313733527/video/smart-water-purifier-water-collection-from-filter.jpg?s=640x640&k=20&c=4PL2GZMujVPVtTp9ZRFaWY3-OhURJ1IOdapWOir0SMI=",
    },
    {
      name: "Mixer Grinder Repair",
      description: "standardised repair process",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.79,
      img: "https://electronicparadise.in/cdn/shop/files/1_e9a24de0-da3e-43e0-9f2f-4cd546c9af25.png?v=1702124625&width=679",
    },
    {
      name: "Washing Machine Repair",
      description: "repair cost will be provided after diagnosis",
      category: await Category.findOne({ name: "Appliance Repair" }),
      ratings: 4.76,
      img: "https://img.freepik.com/premium-photo/white-washing-machine-with-laundry-basket-top_93675-188237.jpg",
    },
  ];
  //   {
  //     name: "Book expert for chekup and other problems",
  //     description:
  //       "The expert will check the issues or solve issues which are not included here",
  //     category: await Category.findOne({ name: "Cleaning" }),
  //     ratings: 4.5,
  //     img: "https://icon2.cleanpng.com/20240328/oib/transparent-glasses-man-in-grey-hoodie-with-glasses6605742c05f420.64964225.webp"}
  // ];

  try {
    await Service.insertMany(serviceDataArray);
    console.log("Services added");
  } catch (error) {
    console.error("Error adding services:", error);
  } finally {
    mongoose.connection.close();
  }
};
addNewServices();
