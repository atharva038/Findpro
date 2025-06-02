const express = require('express');
const router = express.Router();
const ServiceProvider = require('../../models/ServiceProvider');

router.get('/service-count/:categoryId', async (req, res) => {
    try {
        const { categoryId } = req.params;
        const userId = req.session.userId;

        const serviceProvider = await ServiceProvider.findOne({ user: userId });
        let count = 0;

        if (serviceProvider) {
            const category = serviceProvider.servicesOffered.find(
                offered => offered.category.toString() === categoryId
            );
            count = category ? category.services.length : 0;
        }

        res.json({ count, limit: 5 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch service count' });
    }
});

module.exports = router;