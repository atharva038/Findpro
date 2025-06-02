const express = require("express");
const router = express.Router();
const serviceController = require("../Controllers/serviceController");
const { isLoggedIn } = require('../middleware');

// Get all services/categories
router.get("/", serviceController.getAllServices);

// Route to list services by specific category
router.get("/:id", serviceController.getServicesByCategory);

// Get providers for a specific service
router.get('/:serviceId/providers', serviceController.getProviders);

// Book service route
router.get("/:id/:provider/book", isLoggedIn, serviceController.bookService);

// Update location route
router.post('/update-location', serviceController.updateLocation);

module.exports = router;