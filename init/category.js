const mongoose = require("mongoose");
const Category = require("../models/category"); // Adjust path as needed

mongoose
  .connect("mongodb://localhost:27017/findpro")
  .then(async () => {
    // Add categories with images
    const categories = [
      // {
      //   name: "Plumbing",
      //   img: "https://png.pngtree.com/png-vector/20240208/ourmid/pngtree-plumber-working-and-fixing-png-image_11719587.png",
      // },
      // {
      //   name: "Electrical",
      //   img: "https://static.vecteezy.com/system/resources/previews/022/484/734/original/skillful-3d-electrician-with-tools-perfect-for-electrical-or-construction-related-designs-transparent-background-free-png.png",
      // },
      // {
      //   name: "Cleaning",
      //   img: "https://png.pngtree.com/png-vector/20240208/ourmid/pngtree-housekeeping-and-cleaning-service-png-image_11719477.png",
      // },

      // {
      //   name: "Gardening",
      //   img: "https://static.vecteezy.com/system/resources/previews/033/303/092/original/gardening-with-ai-generated-free-png.png",
      // },
      // {
      //   name:"Carpentry",
      //   img: "https://png.pngtree.com/png-vector/20240309/ourmid/pngtree-carpenter-carton-man-clip-art-png-image_11921016.png"
      // }
      {
        name: "Gas Stove",
        img: "https://cdn3d.iconscout.com/3d/premium/thumb/technician-repairing-gas-stove-3d-illustration-download-in-png-blend-fbx-gltf-file-formats--repair-burner-oven-range-repairman-pack-services-illustrations-8737621.png",
      },
      {
        name: "Appliance Repair",
        img: "https://static.vecteezy.com/system/resources/thumbnails/036/603/177/small_2x/3d-illustration-of-technician-repairing-refrigerator-refrigerator-repair-service-3d-illustration-png.png",
      },
    ];

    await Category.insertMany(categories);
    console.log("Categories added!");

    mongoose.connection.close();
  })
  .catch((err) => console.error(err));
