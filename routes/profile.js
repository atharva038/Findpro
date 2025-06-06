const express = require('express');
const router = express.Router();
const multer = require('multer');
const { cloudinary, storage } = require('../config/cloudinary');
const upload = multer({ storage });
const User = require('../models/User');
const { isLoggedIn } = require('../middleware');
const ServiceProvider = require('../models/ServiceProvider');
const { createContact, isInitialized } = require('../config/razorpay');


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

router.post('/travel-fee', isLoggedIn, async (req, res) => {
    try {
        const { enabled, amount } = req.body;

        // Validate input
        if (enabled === undefined || (enabled && (isNaN(amount) || amount <= 0))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid travel fee settings'
            });
        }

        // Find provider associated with current user
        const provider = await ServiceProvider.findOne({ user: req.user._id });

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider profile not found'
            });
        }

        // Update provider
        provider.travelFeeEnabled = enabled;
        provider.travelFeeAmount = enabled ? amount : 0;
        await provider.save();

        res.json({
            success: true,
            message: 'Travel fee settings updated successfully',
            travelFeeEnabled: provider.travelFeeEnabled,
            travelFeeAmount: provider.travelFeeAmount
        });

    } catch (error) {
        console.error('Error updating travel fee settings:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update travel fee settings'
        });
    }
});


// Enhanced bank details route
router.post('/bank-details', isLoggedIn, async (req, res) => {
    try {
        const provider = await ServiceProvider.findOne({ user: req.user._id }).populate('user');

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider profile not found'
            });
        }

        const { accountHolderName, accountNumber, ifscCode, bankName } = req.body;

        // Validate fields
        if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Format IFSC code
        const formattedIFSC = ifscCode.toUpperCase();

        // Create Razorpay contact
        try {
            if (isInitialized()) {
                const contactData = {
                    name: provider.user.name,
                    email: provider.user.email,
                    contact: provider.user.phone,
                    type: 'vendor',
                    reference_id: provider._id.toString()
                };

                console.log("Creating Razorpay contact:", contactData);

                const contact = await createContact(contactData);

                if (contact && contact.id) {
                    console.log("Razorpay contact created:", contact.id);
                    // Update provider with contact ID
                    provider.razorpayContactId = contact.id;
                } else {
                    console.log("Contact creation returned without ID");
                }
            } else {
                console.log("Skipping Razorpay integration - not initialized");
            }
        } catch (razorpayError) {
            console.error("Failed to create Razorpay contact:", razorpayError);
            // Continue without failing - we'll just store the bank details locally
        }

        // Save bank details regardless of Razorpay status
        provider.bankDetails = {
            accountHolderName,
            accountNumber,
            ifscCode: formattedIFSC,
            bankName,
            verified: false,
            updatedAt: new Date()
        };

        await provider.save();

        // Mask account number for response
        const maskedNumber = '•••••' + accountNumber.slice(-4);

        // Return success response
        return res.json({
            success: true,
            message: 'Bank details saved successfully',
            bankDetails: {
                accountHolderName,
                bankName,
                ifscCode: formattedIFSC,
                accountNumberMasked: maskedNumber,
                verified: false
            }
        });
    } catch (error) {
        console.error('Error saving bank details:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to save bank details'
        });
    }
});

// Get bank details
router.get('/bank-details', isLoggedIn, async (req, res) => {
    try {
        const provider = await ServiceProvider.findOne({ user: req.user._id });

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider profile not found'
            });
        }

        // Return bank details if they exist
        if (provider.bankDetails && provider.bankDetails.accountNumber) {
            res.json({
                success: true,
                hasBankDetails: true,
                bankDetails: {
                    accountHolderName: provider.bankDetails.accountHolderName,
                    bankName: provider.bankDetails.bankName,
                    ifscCode: provider.bankDetails.ifscCode,
                    accountNumberMasked: '•••••' + provider.bankDetails.accountNumber.slice(-4),
                    verified: provider.bankDetails.verified
                }
            });
        } else {
            res.json({
                success: true,
                hasBankDetails: false
            });
        }
    } catch (error) {
        console.error('Error fetching bank details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bank details'
        });
    }
});

// Get payout information
router.get('/payout-info', isLoggedIn, async (req, res) => {
    try {
        const provider = await ServiceProvider.findOne({ user: req.user._id });

        if (!provider) {
            return res.status(404).json({
                success: false,
                message: 'Provider profile not found'
            });
        }

        res.json({
            success: true,
            pendingPayouts: provider.pendingPayouts || 0,
            hasBankDetails: !!(provider.bankDetails && provider.bankDetails.accountNumber),
            bankDetailsVerified: !!(provider.bankDetails && provider.bankDetails.verified)
        });
    } catch (error) {
        console.error('Error fetching payout information:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payout information'
        });
    }
});

module.exports = router;