const express = require("express");
const { isLoggedIn } = require("../../middleware");
const User = require("../../models/User");

const router = express.Router();

// Import sub-routers
const customerRoutes = require("./customer");
const providerRoutes = require("./provider");
const serviceRoutes = require("./services");

// Main dashboard route - redirects to appropriate dashboard
router.get("/", isLoggedIn, async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findById(userId);

        if (!user) {
            req.flash("error", "User not found");
            return res.redirect("/login");
        }

        // Redirect based on user role
        if (user.role === "customer") {
            return res.redirect("/dashboard/customer");
        } else if (user.role === "provider") {
            return res.redirect("/dashboard/provider");
        } else {
            req.flash("error", "Invalid user role");
            return res.redirect("/");
        }
    } catch (err) {
        console.error("Dashboard error:", err);
        req.flash("error", "Error loading dashboard: " + err.message);
        return res.redirect("/");
    }
});

// Mount sub-routers
router.use("/customer", customerRoutes);
router.use("/provider", providerRoutes);
router.use("/service", serviceRoutes);

module.exports = router;