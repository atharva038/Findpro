const express = require('express');
const router = express.Router();
const User = require('../models/User');
const ServiceProvider = require('../models/ServiceProvider');
const axios = require('axios');
const isLoggedIn = require('../middleware').isLoggedIn;

// Add address route
router.post('/add-address', isLoggedIn, async (req, res) => {
    try {
        const { street, city, state, pincode, label, makeDefault } = req.body;

        // Validate required fields
        if (!city || !state || !pincode) {
            req.flash('error', 'City, state and pincode are required');
            return res.redirect('back');
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('back');
        }

        // Create new address object
        const newAddress = {
            street: street || '',
            city,
            state,
            pincode,
            label: label || 'Home',
            isDefault: makeDefault === 'true'
        };

        // Geocode the address to get coordinates
        const coordinates = await geocodeAddress(newAddress);
        if (coordinates) {
            newAddress.coordinates = coordinates;
        }

        // If this is the first address or makeDefault is true, update all others to not default
        if (makeDefault === 'true' || user.addresses.length === 0) {
            user.addresses.forEach(address => {
                address.isDefault = false;
            });
        }

        // Add the new address
        user.addresses.push(newAddress);

        await user.save();

        req.flash('success', 'Address added successfully');
        res.redirect('back');
    } catch (error) {
        console.error('Error adding address:', error);
        req.flash('error', 'Failed to add address');
        res.redirect('back');
    }
});

// Update address route
router.post('/update-address/:index', isLoggedIn, async (req, res) => {
    try {
        const { street, city, state, pincode, label, makeDefault } = req.body;
        const addressIndex = parseInt(req.params.index);

        // Validate required fields
        if (!city || !state || !pincode || isNaN(addressIndex)) {
            req.flash('error', 'Required fields missing or invalid address index');
            return res.redirect('back');
        }

        const user = await User.findById(req.user._id);

        if (!user || !user.addresses[addressIndex]) {
            req.flash('error', 'Address not found');
            return res.redirect('back');
        }

        // Update address fields
        user.addresses[addressIndex].street = street || '';
        user.addresses[addressIndex].city = city;
        user.addresses[addressIndex].state = state;
        user.addresses[addressIndex].pincode = pincode;
        user.addresses[addressIndex].label = label || 'Home';

        // If coordinates need to be updated, geocode again
        if (user.addresses[addressIndex].street !== street ||
            user.addresses[addressIndex].city !== city ||
            user.addresses[addressIndex].state !== state ||
            user.addresses[addressIndex].pincode !== pincode) {

            const coordinates = await geocodeAddress({
                street, city, state, pincode
            });

            if (coordinates) {
                user.addresses[addressIndex].coordinates = coordinates;
            }
        }

        // Handle default address
        if (makeDefault === 'true') {
            user.addresses.forEach((address, i) => {
                address.isDefault = (i === addressIndex);
            });
        }

        await user.save();

        req.flash('success', 'Address updated successfully');
        res.redirect('back');
    } catch (error) {
        console.error('Error updating address:', error);
        req.flash('error', 'Failed to update address');
        res.redirect('back');
    }
});

// Delete address route
router.post('/delete-address/:index', isLoggedIn, async (req, res) => {
    try {
        const addressIndex = parseInt(req.params.index);

        if (isNaN(addressIndex)) {
            req.flash('error', 'Invalid address index');
            return res.redirect('back');
        }

        const user = await User.findById(req.user._id);

        if (!user || !user.addresses[addressIndex]) {
            req.flash('error', 'Address not found');
            return res.redirect('back');
        }

        // If deleting default address, set another as default (if any)
        const wasDefault = user.addresses[addressIndex].isDefault;

        // Remove the address
        user.addresses.splice(addressIndex, 1);

        // If we deleted the default address and there are other addresses, set the first one as default
        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }

        await user.save();

        req.flash('success', 'Address deleted successfully');
        res.redirect('back');
    } catch (error) {
        console.error('Error deleting address:', error);
        req.flash('error', 'Failed to delete address');
        res.redirect('back');
    }
});

// Set default address route
router.post('/set-default-address/:index', isLoggedIn, async (req, res) => {
    try {
        const addressIndex = parseInt(req.params.index);

        if (isNaN(addressIndex)) {
            req.flash('error', 'Invalid address index');
            return res.redirect('back');
        }

        const user = await User.findById(req.user._id);

        if (!user || !user.addresses[addressIndex]) {
            req.flash('error', 'Address not found');
            return res.redirect('back');
        }

        // Set all addresses as non-default
        user.addresses.forEach((address, i) => {
            address.isDefault = (i === addressIndex);
        });

        await user.save();

        req.flash('success', 'Default address updated');
        res.redirect('back');
    } catch (error) {
        console.error('Error setting default address:', error);
        req.flash('error', 'Failed to update default address');
        res.redirect('back');
    }
});

// Update user's current location
router.post('/update-location', isLoggedIn, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (!latitude || !longitude) {
            return res.status(400).json({ success: false, error: 'Invalid coordinates provided' });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Update user's current location
        user.currentLocation = {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            lastUpdated: new Date()
        };

        await user.save();

        // Also store in session for quick access
        req.session.currentLocation = {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude)
        };

        return res.json({ success: true, message: 'Location updated successfully' });
    } catch (error) {
        console.error('Error updating location:', error);
        return res.status(500).json({ success: false, error: 'Error updating location' });
    }
});

// Geocoding helper function
async function geocodeAddress(address) {
    try {
        const searchAddress = `${address.street}, ${address.city}, ${address.state}, ${address.pincode}, India`;
        const encodedAddress = encodeURIComponent(searchAddress);

        // Using OpenStreetMap/Nominatim as it's free and doesn't require API key
        const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&addressdetails=1&limit=1`,
            {
                headers: {
                    'User-Agent': 'KnockNFix/1.0' // Required by Nominatim ToS
                }
            }
        );

        if (response.data && response.data.length > 0) {
            const result = response.data[0];
            return {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon)
            };
        }

        return null;
    } catch (error) {
        console.error('Geocoding error:', error);
        return null;
    }
}

// Export the router
module.exports = router;