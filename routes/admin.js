const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware');
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const Service = require('../models/Service');
const Category = require('../models/category');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');

const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });


router.get('/dashboard', async (req, res) => {
    try {
        // Get stats for dashboard
        const statistics = {
            usersCount: await User.countDocuments(),
            servicesCount: await Service.countDocuments(),
            bookingsCount: await Booking.countDocuments(),
            revenue: await calculateTotalRevenue()
        };

        // Get recent activity
        const recentActivity = await getRecentActivity();

        // Get system notifications
        const notifications = await getSystemNotifications();

        res.render('pages/admin/dashboard', {
            statistics,
            recentActivity,
            notifications,
            recentBookings: [], // Add recent bookings or fetch them
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading admin dashboard');
        res.redirect('/');
    }
});

// Users Management
// Update this route
router.get('/users', async (req, res) => {
    try {
        // Fetch all users
        let users = await User.find().sort({ createdAt: -1 });

        // Ensure all users have a status
        users = users.map(user => {
            // Convert to plain object if it's a Mongoose document
            const u = user.toObject ? user.toObject() : { ...user };

            // Set default status if missing
            if (!u.status) {
                u.status = 'unverified';
            }

            return u;
        });

        // Filter users by role
        const customers = users.filter(user => user.role === 'customer');
        const providers = users.filter(user => user.role === 'provider');

        res.render('pages/admin/users', {
            users,
            customers,
            providers
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        req.flash('error', 'Failed to load users');
        res.redirect('/admin/dashboard');
    }
});

// Categories Management
router.get('/categories', async (req, res) => {
    try {
        const categories = await Category.find().lean();
        res.render('pages/admin/categories', {
            categories,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading categories');
        res.redirect('/admin/dashboard');
    }
});
// Add this after your 'router.get('/categories')' handler

// Add Category Form
router.get('/addCategory', (req, res) => {
    res.render('pages/admin/addCategory');
});

// Create new category
router.post('/categories', upload.single('image'), async (req, res) => {

    try {
        const { name, description } = req.body;
        const isActive = req.body.isActive === 'true' || req.body.isActive === true;

        // Create new category
        const newCategory = new Category({
            name,
            description,
            isActive
        });

        // Add image if uploaded
        if (req.file) {
            newCategory.img = req.file.path;  // Just save the path, not an object
        }

        await newCategory.save();

        req.flash('success', 'Category created successfully');
        res.redirect('/admin/categories');
    } catch (err) {
        console.error('Error creating category:', err);
        req.flash('error', 'Failed to create category: ' + err.message);
        res.redirect('/admin/addCategory');
    }
});

// Edit Category Form
router.get('/editCategory/:id', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            req.flash('error', 'Category not found');
            return res.redirect('/admin/categories');
        }

        res.render('pages/admin/editCategory', { category });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading category');
        res.redirect('/admin/categories');
    }
});

// Update Category
router.put('/categories/:id', upload.single('image'), async (req, res) => {
    try {
        const { name, description } = req.body;
        const isActive = req.body.isActive === 'true' || req.body.isActive === true;

        const updateData = {
            name,
            description,
            isActive
        };

        // Add image if uploaded
        if (req.file) {
            updateData.image = {
                url: req.file.path,
                filename: req.file.filename
            };
        }

        await Category.findByIdAndUpdate(req.params.id, updateData);

        req.flash('success', 'Category updated successfully');
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating category');
        res.redirect(`/admin/editCategory/${req.params.id}`);
    }
});

// Delete Category
router.delete('/categories/:id', async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        req.flash('success', 'Category deleted successfully');
        res.redirect('/admin/categories');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error deleting category');
        res.redirect('/admin/categories');
    }
});

// Toggle Category Status
router.post('/categories/:id/toggle', async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);

        if (!category) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }

        // Toggle the active status
        category.isActive = !category.isActive;
        await category.save();

        return res.json({
            success: true,
            isActive: category.isActive,
            message: `Category ${category.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Error updating category status' });
    }
});
// Services Management
router.get('/services', async (req, res) => {
    try {
        const services = await Service.find()
            .populate('category')
            .lean();

        res.render('pages/admin/services', {
            services,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading services');
        res.redirect('/admin/dashboard');
    }
});

// Add these routes for service management

// Delete service
router.delete('/services/:id', async (req, res) => {
    try {
        await Service.findByIdAndDelete(req.params.id);
        req.flash('success', 'Service deleted successfully');
        res.redirect('/admin/services');
    } catch (err) {
        console.error('Error deleting service:', err);
        req.flash('error', 'Error deleting service');
        res.redirect('/admin/services');
    }
});

// Toggle service status
router.post('/services/:id/toggle', async (req, res) => {
    try {
        const service = await Service.findById(req.params.id);

        if (!service) {
            return res.status(404).json({ success: false, message: 'Service not found' });
        }

        // Toggle the active status
        service.isActive = !service.isActive;
        await service.save();

        return res.json({
            success: true,
            isActive: service.isActive,
            message: `Service ${service.isActive ? 'activated' : 'deactivated'} successfully`
        });
    } catch (err) {
        console.error('Error toggling service status:', err);
        return res.status(500).json({ success: false, message: 'Error updating service status' });
    }
});
// Bookings Management
// Bookings Management
router.get('/bookings', async (req, res) => {
    try {
        // Check your Booking schema to confirm these field names
        const bookings = await Booking.find()
            .populate('customer') // If your schema uses 'customer' instead of 'user'
            .populate('service')
            .populate('provider')
            .populate({
                path: 'service',
                populate: { path: 'category' }
            })
            .sort({ createdAt: -1 });

        // Map the results to ensure safe access
        // Inside your router.get('/bookings') handler, update the safeBookings mapping:

        const safeBookings = bookings.map(booking => {
            // Create a plain object we can safely modify
            const plainBooking = booking.toObject();

            // Fix field name if needed (map 'customer' to 'user')
            if (plainBooking.customer && !plainBooking.user) {
                plainBooking.user = plainBooking.customer;
            }

            // Ensure all required nested properties exist
            if (!plainBooking.user) {
                plainBooking.user = {
                    name: 'Unknown User',
                    phone: 'No phone',
                    profileImage: null
                };
            }

            // Fix the totalAmount vs totalCost issue
            if (plainBooking.totalCost && !plainBooking.totalAmount) {
                plainBooking.totalAmount = plainBooking.totalCost;
            } else if (!plainBooking.totalAmount && !plainBooking.totalCost) {
                plainBooking.totalAmount = 0;
            }

            // Set default payment status if missing
            if (!plainBooking.paymentStatus) {
                plainBooking.paymentStatus = 'Unknown';
            }

            return plainBooking;
        });
        // Filter by status
        const pendingBookings = safeBookings.filter(booking => booking.status === 'pending');
        const confirmedBookings = safeBookings.filter(booking => booking.status === 'confirmed');
        const completedBookings = safeBookings.filter(booking => booking.status === 'completed');
        const cancelledBookings = safeBookings.filter(booking => booking.status === 'cancelled');

        res.render('pages/admin/bookings', {
            bookings: safeBookings,
            pendingBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings
        });
    } catch (err) {
        console.error('Error fetching bookings:', err);
        req.flash('error', 'Failed to load bookings');
        res.redirect('/admin/dashboard');
    }
});
// Reports
router.get('/reports', async (req, res) => {
    try {
        // Get reports data
        const revenueData = await getRevenueData();
        const serviceData = await getServiceData();
        const userGrowthData = await getUserGrowthData();

        res.render('pages/admin/reports', {
            revenueData,
            serviceData,
            userGrowthData,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading reports');
        res.redirect('/admin/dashboard');
    }
});

// Feedback Management
router.get('/feedback', async (req, res) => {
    try {
        // Get feedback data
        const feedback = await getFeedbackData();

        res.render('pages/admin/feedback', {
            feedback,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading feedback');
        res.redirect('/admin/dashboard');
    }
});

// Settings
router.get('/settings', async (req, res) => {
    try {
        // Get current settings
        const settings = await getSystemSettings();

        res.render('pages/admin/settings', {
            settings,
            currentPath: req.path
        });
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error loading settings');
        res.redirect('/admin/dashboard');
    }
});

// Update settings
router.post('/settings', async (req, res) => {
    try {
        // Update settings
        await updateSystemSettings(req.body);

        req.flash('success', 'Settings updated successfully');
        res.redirect('/admin/settings');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error updating settings');
        res.redirect('/admin/settings');
    }
});

// Helper functions
async function calculateTotalRevenue() {
    try {
        const payments = await Payment.find();
        return payments.reduce((total, payment) => total + payment.amount, 0);
    } catch (err) {
        console.error('Error calculating revenue:', err);
        return 0;
    }
}

async function getRecentActivity() {
    // This would typically come from a database of logged actions
    // For now, we'll return mock data
    return [
        {
            action: 'New Booking Created',
            user: 'John Smith',
            dateTime: '2023-05-15 14:30',
            status: 'Pending'
        },
        {
            action: 'Service Completed',
            user: 'Maria Rodriguez',
            dateTime: '2023-05-15 12:15',
            status: 'Completed'
        },
        {
            action: 'Payment Received',
            user: 'David Chen',
            dateTime: '2023-05-15 10:45',
            status: 'Completed'
        },
        {
            action: 'Booking Cancelled',
            user: 'Sarah Johnson',
            dateTime: '2023-05-14 16:20',
            status: 'Cancelled'
        },
        {
            action: 'New User Registered',
            user: 'Raj Patel',
            dateTime: '2023-05-14 09:10',
            status: 'Completed'
        }
    ];
}

async function getSystemNotifications() {
    // This would typically come from a notifications collection
    // For now, we'll return mock data
    return [
        {
            type: 'warning',
            message: 'System update scheduled for tonight at 2:00 AM',
            time: '2 hours ago'
        },
        {
            type: 'success',
            message: 'Backup completed successfully',
            time: '5 hours ago'
        },
        {
            type: 'info',
            message: '3 new service providers registered today',
            time: '1 day ago'
        }
    ];
}

async function getRevenueData() {
    // Mock data for revenue charts
    return {
        monthly: [5000, 7200, 8500, 9200, 7800, 10500, 12000, 11500, 13800, 15000, 14200, 16500],
        categories: {
            labels: ['Plumbing', 'Electrical', 'Cleaning', 'Painting', 'Carpentry'],
            data: [25, 30, 15, 18, 12]
        }
    };
}

async function getServiceData() {
    // Mock data for service statistics
    return {
        popularServices: [
            { name: 'Deep Home Cleaning', count: 156 },
            { name: 'Electrical Repairs', count: 143 },
            { name: 'Plumbing Services', count: 127 },
            { name: 'AC Service & Repair', count: 118 },
            { name: 'Interior Painting', count: 92 }
        ],
        serviceGrowth: [10, 15, 8, 12, 20, 18, 22, 25, 28, 30, 35, 38]
    };
}

async function getUserGrowthData() {
    // Mock data for user growth
    return {
        customers: [50, 80, 120, 160, 200, 250, 280, 310, 350, 400, 450, 500],
        providers: [10, 15, 22, 30, 35, 42, 48, 55, 62, 70, 78, 85]
    };
}

async function getFeedbackData() {
    // Mock feedback data
    return [
        {
            id: 1,
            customer: 'John Smith',
            service: 'Plumbing Services',
            provider: 'Mike Davis',
            rating: 5,
            comment: 'Excellent service, very professional and quick.',
            date: '2023-05-10'
        },
        {
            id: 2,
            customer: 'Emily Johnson',
            service: 'House Cleaning',
            provider: 'Clean Pro Services',
            rating: 4,
            comment: 'Good service overall, but arrived a bit late.',
            date: '2023-05-09'
        },
        {
            id: 3,
            customer: 'Robert Brown',
            service: 'Electrical Repair',
            provider: 'PowerFix',
            rating: 5,
            comment: 'Fixed the issue quickly and explained everything clearly.',
            date: '2023-05-08'
        },
        {
            id: 4,
            customer: 'Lisa Chen',
            service: 'Painting Service',
            provider: 'ColorMaster',
            rating: 3,
            comment: 'The work was satisfactory but there were some issues with cleanup.',
            date: '2023-05-07'
        },
        {
            id: 5,
            customer: 'Michael Wilson',
            service: 'Furniture Assembly',
            provider: 'AssemblyPro',
            rating: 5,
            comment: 'Perfect assembly, very efficient and professional.',
            date: '2023-05-06'
        }
    ];
}

async function getSystemSettings() {
    // Mock system settings
    return {
        siteName: 'KnockNFix',
        siteEmail: 'admin@knocknfix.com',
        bookingFee: 5,
        platformCommission: 10,
        maintenanceMode: false,
        emailNotifications: true,
        autoApproveProviders: false,
        currency: 'INR',
        timeZone: 'Asia/Kolkata'
    };
}
module.exports = router;