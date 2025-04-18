const express = require('express');
const router = express.Router();
const multer = require('multer');
const { cloudinary, storage } = require('../config/cloudinary');
const upload = multer({ storage });
const User = require('../models/User');
const { isLoggedIn } = require('../middleware');

router.post('/update', isLoggedIn, upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }

        const updates = {};

        // Handle image upload
        if (req.file) {
            try {
                // Get the current user to find their existing profile image
                const currentUser = await User.findById(req.user._id);

                // Delete the old image from Cloudinary if it exists
                if (currentUser.profileImage) {
                    const match = currentUser.profileImage.match(/KnockNFix\/[^.]+/);
                    if (match) {
                        const publicId = match[0];
                        await cloudinary.uploader.destroy(publicId);
                    }
                }

                // Update with the new image path
                updates.profileImage = req.file.path;
            } catch (cloudinaryError) {
                console.error('Cloudinary error:', cloudinaryError);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to update profile image'
                });
            }
        }

        // Handle other profile updates
        if (req.body.name) updates.name = req.body.name;
        if (req.body.address) updates.address = req.body.address;
        if (req.body.phone) updates.phone = req.body.phone;

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updates,
            { new: true, runValidators: true }
        );

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