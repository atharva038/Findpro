const express = require('express');
const router = express.Router();
const Service = require('../models/Service');
const Category = require('../models/category');

const multer = require('multer');
const { storage } = require('../config/cloudinary');
const upload = multer({ storage });

// Show add service form
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('pages/add-service', { categories });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

router.post('/services', upload.single('image'), async (req, res) => {
    try {
        const { name, description, category } = req.body;
        if (!req.file) {
            req.flash('error', 'Please upload an image');
            return res.redirect('/admin');
        }
        
        
        const newService = new Service({
            name,
            description,
            category,
            img: req.file.path // Cloudinary URL
        });

        await newService.save();
        req.flash('success', 'Service added successfully');
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        req.flash('error', 'Error adding service');
        res.redirect('/admin');
    }
});

module.exports = router;