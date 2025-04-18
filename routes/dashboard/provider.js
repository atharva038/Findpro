const express = require("express");
const { isLoggedIn } = require("../../middleware");
const { getProviderDashboardData } = require("../../utils/dashboardHelpers");

const router = express.Router();

router.get("/", isLoggedIn, async (req, res) => {
    try {
        const userId = req.session.userId;
        const data = await getProviderDashboardData(userId);

        return res.render("pages/providerDashboard", {
            currUser: req.user,
            ...data
        });
    } catch (err) {
        console.error("Provider dashboard error:", err);
        req.flash("error", "Error loading provider dashboard: " + err.message);
        return res.redirect("/");
    }
});

// Add more provider-specific routes here

module.exports = router;