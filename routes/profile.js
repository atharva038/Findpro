const express = require('express');
const router = express.Router();
const multer = require('multer');
const { cloudinary, storage } = require('../config/cloudinary');
const upload = multer({ storage });
const User = require('../models/User');
const { isLoggedIn } = require('../middleware');

router.post('/update', isLoggedIn, upload.single('profileImage'), async (req, res) => {
    try {

        console.log('Profile update request received');
        console.log('Request body:', req.body);
        console.log('File received:', req.file ? 'Yes' : 'No');

        const userId = req.user._id;
        const updateData = {
            name: req.body.name,
            phone: req.body.phone,
            address: req.body.address
        };

        // Add profileImage if a file was uploaded
        if (req.file) {
            updateData.profileImage = req.file.path;
            console.log('Setting profile image path:', req.file.path);
        }

        // Get old user data to delete old image if needed
        const oldUser = await User.findById(userId);

        // Update user with new data
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        );

        // If successful update and we have a new image and an old image to delete
        if (updatedUser && req.file && oldUser.profileImage && oldUser.profileImage.includes('cloudinary')) {
            try {
                // Extract the public_id from the old image URL
                const publicId = oldUser.profileImage
                    .split('/')
                    .slice(-1)[0]
                    .split('.')[0];

                // Delete the old image from Cloudinary
                await cloudinary.uploader.destroy(`profile-images/${publicId}`);
            } catch (deleteErr) {
                console.error('Error deleting old image:', deleteErr);
                // Continue anyway since user update was successful
            }
        }

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                name: updatedUser.name,
                address: updatedUser.address,
                phone: updatedUser.phone,
                profileImage: updatedUser.profileImage
            }
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update profile'
        });
    }
});

module.exports = router;