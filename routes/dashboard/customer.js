const express = require("express");
const { isLoggedIn } = require("../../middleware");
const { getCustomerDashboardData } = require("../../utils/dashboardHelpers");

const router = express.Router();

router.get("/", isLoggedIn, async (req, res) => {
    try {
        const userId = req.session.userId;
        const data = await getCustomerDashboardData(userId);

        return res.render("pages/customerDashboard", {
            currUser: req.user,
            ...data
        });
    } catch (err) {
        console.error("Customer dashboard error:", err);
        req.flash("error", "Error loading customer dashboard: " + err.message);
        return res.redirect("/");
    }
});

// Add more customer-specific routes here

module.exports = router;