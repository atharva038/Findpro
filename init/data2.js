const addNewServices = async () => {
  const serviceDataArray = [
    {
      name: "1 BHK apartment cleaning",
      description: "1 bedroom 1 hall and 1 kitchen cleaning included",
      category: await Category.findOne({ name: "Cleaning" }),
      ratings: 4.5,
      img: "https://scubeinterior.com/wp-content/uploads/2022/02/1bhk-apartment-bedroom-design-with-classy-interiors.jpg",
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
