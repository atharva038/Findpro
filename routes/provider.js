const express = require("express");
const ServiceProvider = require("../models/ServiceProvider");
const Service = require("../models/Service");
const router = express.Router();

// Route for service providers to view their services
router.get("/myservices", async (req, res) => {
  try {
    // Fix typo: getProviderDashboardDat -> removed
    const services = await Service.find({ provider: req.user.id });
    res.render("myservices", { services });
  } catch (err) {
    res.status(500).send("Server error");
  }
});

// Route for service providers to edit a service
router.post("/edit/:serviceId", async (req, res) => {
  const { name, description, cost, availability } = req.body;
  try {
    const service = await Service.findByIdAndUpdate(req.params.serviceId, {
      name,
      description,
      cost,
      availability,
    });
    res.redirect("/provider/myservices");
  } catch (err) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
