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
    // {
    //   name: "Ceiling fan installation",
    //   description:
    //     "Installaion of 1 ceiling/ exhaust/ wall/ decorative/ fan only",
    //   category: await Category.findOne({ name: "Electrical" }),
    //   ratings: 4.5,
    //   img: "https://purepng.com/public/uploads/large/purepng.com-three-blade-ceiling-fanelectronics-ceiling-fan-fan-941524666109p5xsx.png",
    // },

    // {
    //   name: "Doorbell installation",
    //   description: "Installation of 1 doorbell",
    //   category: await Category.findOne({ name: "Electrical" }),
    //   ratings: 4.5,
    //   img: "https://w7.pngwing.com/pngs/295/820/png-transparent-intercom-video-door-phone-door-bells-chimes-smart-doorbell-door-phone-smartphone-electronics-electronic-device-camera.png",
    // },

    // {
    //   name: "Single-pole MCB installation",
    //   description: "Installation of 1 single-pole MCB",
    //   category: await Category.findOne({ name: "Electrical" }),
    //   ratings: 4.5,
    //   img: "https://5.imimg.com/data5/SELLER/Default/2023/12/371821111/FA/RV/CK/185460948/havells-single-pole-mcb.png",
    // },
    // {
    //   name: "Double-pole MCB installation",
    //   description: "Installation of 1 double-pole MCB",
    //   category: await Category.findOne({ name: "Electrical" }),
    //   ratings: 4.5,
    //   img: "https://5.imimg.com/data5/MS/YT/LZ/SELLER-46652879/havells-40a-2-pole-isolator-500x500.png",
    // },
    // {
    //   name: "Inverter installation",
    //   description: "Installation of 1 inverter",
    //   category: await Category.findOne({ name: "Electrical" }),
    //   ratings: 4.5,
    //   img: "https://e7.pngegg.com/pngimages/477/471/png-clipart-solar-inverter-power-inverters-grid-tie-inverter-electric-power-solar-power-energy-solar-cell-solar-inverter.png",
    // },
    // {
    //   name: "Book expert for chekup and other problems",
    //   description:
    //     "The expert will check the issues or solve issues which are not included here",
    //   category: await Category.findOne({ name: "Plumbing" }),
    //   ratings: 4.5,
    //   img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWn35ih1A5gL2IaZ_sOAsOppPVY2IhucV2Uw&s",
    // },
    // {
    //   name: "Book expert for chekup and other problems",
    //   description:
    //     "The expert will check the issues or solve issues which are not included here",
    //   category: await Category.findOne({ name: "Electrical" }),
    //   ratings: 4.5,
    //   img: "https://w7.pngwing.com/pngs/497/821/png-transparent-electrician-electricity-free-content-cartoon-painted-lamp-electrician-occupation-watercolor-painting-cartoon-character-hand.png",
    {
      name: "2 BHK apartment cleaning",
      description: "2 bedroom 1 hall and 1 kitchen cleaning included",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.83,
      img: "https://media.istockphoto.com/id/1263684705/photo/gorgeous-shower-with-no-step-up.jpg?s=612x612&w=0&k=20&c=NXNtafaAl0cZArXAoc1eII4JTWErK1SM5ikpH_Kyyh4=",
    },
    {
      name: "Classic cleaning (2 bathrooms)",
      description: "Cleaning of all areas and surfaces",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.5,
      img: "https://scubeinterior.com/wp-content/uploads/2022/02/1bhk-apartment-bedroom-design-with-classy-interiors.jpg",
    },
    {
      name: "Intense cleaning (2 bathrooms)",
      description: "Cleaning of hard to reach spots , floor deep cleaning",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.7,
      img: "https://www.shutterstock.com/image-photo/woman-cleaning-bathroom-sink-she-600nw-2496886565.jpg",
    },
    {
      name: "Chimney & stove cleaning",
      description:
        "Cleaning and repairing of chimney motor is excluded , provide a stool/ladder if required",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.5,
      img: "https://img.etimg.com/thumb/width-1200,height-900,imgsize-18978,resizemode-75,msid-95510689/top-trending-products/kitchen-dining/chimney/best-kitchen-chimneys-for-small-kitchen.jpg",
    },
    {
      name: "Complete kitchen cleaning including cabinet interiors",
      description:
        "We do not clean commercial kitchen , wet wiping of walls is excluded",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.74,
      img: "https://media.istockphoto.com/id/1163763269/photo/its-never-too-late-to-spring-clean-your-home.jpg?s=612x612&w=0&k=20&c=eGJFl33RtQtXXJLpNvxSOS_Ea-NgYR13U8PUcOkg48o=",
    },
    {
      name: "Sofa & cushions cleaning",
      description: "Wet shampooing of leathe/rexin/wooden sofa is excluded",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.5,
      img: "https://st4.depositphotos.com/10614052/40209/i/450/depositphotos_402094676-stock-photo-woman-removing-dirt-sofa-home.jpg",
    },
    {
      name: "Dining table & chairs cleaning",
      description: "Dry dusting, wet wiping, dry vacuuming of cushioned chairs",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.5,
      img: "https://thumbs.dreamstime.com/b/young-positive-afro-american-house-maid-apron-cleaning-table-modern-kitchen-services-concept-housework-female-cleaner-174355373.jpg",
    },
    {
      name: "<1200 sq ft bungalow cleaning",
      description: "only for residential properties",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.75,
      img: "https://t3.ftcdn.net/jpg/02/36/57/44/360_F_236574451_PEWIZf5I085uy6Ipnad736dYvULBOU8e.jpg",
    },
    {
      name: "2000-3000 sq ft bungalow cleaning",
      description: "terrace and inaccessible areas cleaning are excluded",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.77,
      img: "https://static9.depositphotos.com/1362922/1086/i/450/depositphotos_10860945-stock-photo-vacuum-cleaner.jpg",
    },
  ];

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
