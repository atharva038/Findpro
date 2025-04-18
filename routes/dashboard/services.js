const express = require("express");
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const ServiceProvider = require("../../models/ServiceProvider");
const Service = require("../../models/Service");
const Category = require("../../models/category");
const User = require("../../models/User");
const { isLoggedIn } = require("../../middleware");

const router = express.Router();

// Get service registration page
router.get('/registerService', async (req, res) => {
    try {
        const categories = await Category.find().lean();
        const services = await Service.find().populate('category').lean();

        res.render('pages/registerService', {
            categories,
            services,
            title: 'Register Service'
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Unable to load categories and services');
        res.redirect('/dashboard');
    }
});

// Register a new service
router.post(
    "/registerService",
    [
        body("serviceCategories").notEmpty().withMessage("Service category is required."),
        body("services").notEmpty().withMessage("Service is required."),
        body("cost").notEmpty().withMessage("Cost is required."),
        body("experience").notEmpty().withMessage("Experience is required.")
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                const errorMessages = errors.array().map((err) => err.msg);
                req.flash("error", errorMessages.join(", "));
                return res.redirect("/dashboard/registerService");
            }

            const userId = req.session.userId;
            const user = await User.findById(userId);
            if (!user) {
                req.flash("error", "User not found.");
                return res.redirect("/login");
            }

            const { serviceCategories, services, cost, experience } = req.body;

            // Find existing service provider or create new one
            let serviceProvider = await ServiceProvider.findOne({ user: userId });

            if (serviceProvider) {
                // Check if this service is already registered
                const isDuplicate = serviceProvider.servicesOffered.some(offered =>
                    offered.services.some(s => s.service.toString() === services)
                );

                if (isDuplicate) {
                    req.flash("error", "You have already registered for this service");
                    return res.redirect("/dashboard/registerService");
                }

                // Check if category already exists in servicesOffered
                const existingCategoryIndex = serviceProvider.servicesOffered.findIndex(
                    offered => offered.category.toString() === serviceCategories
                );

                if (existingCategoryIndex !== -1) {
                    // Category exists, add service to existing category
                    await ServiceProvider.findOneAndUpdate(
                        {
                            user: userId,
                            "servicesOffered.category": serviceCategories
                        },
                        {
                            $push: {
                                "servicesOffered.$.services": {
                                    service: services,
                                    customCost: Number(cost),
                                    experience: `${experience} years`
                                }
                            },
                            experience: Number(experience)
                        },
                        { new: true }
                    );
                } else {
                    // Category doesn't exist, create new category entry
                    await ServiceProvider.findOneAndUpdate(
                        { user: userId },
                        {
                            $push: {
                                servicesOffered: {
                                    category: serviceCategories,
                                    services: [{
                                        service: services,
                                        customCost: Number(cost),
                                        experience: `${experience} years`
                                    }]
                                }
                            },
                            experience: Number(experience)
                        },
                        { new: true }
                    );
                }
            } else {
                // Create new service provider
                serviceProvider = await ServiceProvider.create({
                    user: userId,
                    servicesOffered: [{
                        category: serviceCategories,
                        services: [{
                            service: services,
                            customCost: Number(cost),
                            experience: `${experience} years`
                        }]
                    }],
                    experience: Number(experience)
                });
            }

            // Add this provider to the Service
            await Service.findByIdAndUpdate(
                services,
                { $addToSet: { providers: serviceProvider._id } }
            );

            req.flash("success", "Service added successfully!");
            res.redirect("/dashboard");
        } catch (err) {
            console.error("Error registering service:", err);
            req.flash("error", "Failed to register service. Please try again.");
            res.redirect("/dashboard/registerService");
        }
    }
);

// Delete a service
router.post('/delete/:id', async (req, res) => {
    try {
        const serviceId = req.params.id;
        const { categoryId } = req.body;
        const userId = req.session.userId;

        if (!serviceId || !categoryId) {
            return res.status(400).json({ success: false, message: 'Missing service or category ID' });
        }

        const serviceProvider = await ServiceProvider.findOne({ user: userId });

        if (!serviceProvider) {
            return res.status(404).json({ success: false, message: 'Service provider not found' });
        }

        const categoryIndex = serviceProvider.servicesOffered.findIndex(
            category => category.category.toString() === categoryId
        );

        if (categoryIndex === -1) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        serviceProvider.servicesOffered[categoryIndex].services =
            serviceProvider.servicesOffered[categoryIndex].services.filter(
                service => service._id.toString() !== serviceId
            );

        await serviceProvider.save();

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting service:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get service by ID (for AJAX)
router.get('/:id', async (req, res) => {
    try {
        const serviceId = req.params.id;

        // Check if ID is valid before querying
        if (!serviceId || serviceId === 'undefined' || serviceId === 'null' ||
            serviceId === '[object Object]' || !mongoose.Types.ObjectId.isValid(serviceId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid service ID format'
            });
        }

        const service = await Service.findById(serviceId);

        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        res.json({
            success: true,
            service: {
                name: service.name,
                img: service.img,
                price: service.price,
                description: service.description
            }
        });
    } catch (err) {
        console.error('Error fetching service:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;