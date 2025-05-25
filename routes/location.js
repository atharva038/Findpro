const express = require('express');
const router = express.Router();
const { Client } = require('@googlemaps/google-maps-services-js');
const axios = require('axios');
const client = new Client({});

// Location suggestions route (Places Autocomplete)
router.get('/suggestions', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 3) {
            return res.json({
                status: 'error',
                message: 'Query must be at least 3 characters long',
                predictions: []
            });
        }

        const response = await client.placeAutocomplete({
            params: {
                input: query,
                key: process.env.GOOGLE_MAPS_API_KEY,
                components: ['country:in'], // Restrict to India
                language: 'en',
                types: ['geocode', 'establishment']
            }
        });

        res.json({
            status: 'success',
            data: response.data
        });

    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch location suggestions',
            error: error.message
        });
    }
});

// Reverse geocoding route
router.get('/reverse-geocode', async (req, res) => {
    try {
        const { lat, lng } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({
                status: 'error',
                message: 'Latitude and longitude are required'
            });
        }

        const response = await client.reverseGeocode({
            params: {
                latlng: { lat: parseFloat(lat), lng: parseFloat(lng) },
                key: process.env.GOOGLE_MAPS_API_KEY,
                language: 'en',
                region: 'in'
            }
        });

        res.json({
            status: 'success',
            data: response.data
        });

    } catch (error) {
        console.error('Error reverse geocoding:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to reverse geocode location',
            error: error.message
        });
    }
});
// Place autocomplete endpoint
router.get('/autocomplete', async (req, res) => {
    try {
        const { input } = req.query;
        if (!input || input.length < 3) {
            return res.json({
                status: 'error',
                message: 'Input must be at least 3 characters',
                predictions: []
            });
        }

        const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/autocomplete/json',
            {
                params: {
                    input,
                    key: process.env.GOOGLE_MAPS_API_KEY,
                    components: 'country:in',
                    language: 'en',
                    types: 'geocode|establishment'
                }
            }
        );

        res.json({
            status: 'success',
            data: response.data
        });
    } catch (error) {
        console.error('Error fetching places:', error);
        res.status(500).json({
            status: 'error',
            message: error.message
        });
    }
});

router.get('/current-location', async (req, res) => {
    try {
        const { lat, lng } = req.query;

        // Log incoming request for debugging
        console.log(`Received location request for: ${lat}, ${lng}`);

        if (!lat || !lng) {
            return res.status(400).json({
                status: 'error',
                message: 'Latitude and longitude are required'
            });
        }

        // Parse coordinates as floats
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);

        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude) ||
            latitude < -90 || latitude > 90 ||
            longitude < -180 || longitude > 180) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid coordinates provided'
            });
        }

        // Make reverse geocoding request with enhanced parameters
        const response = await client.reverseGeocode({
            params: {
                latlng: { lat: latitude, lng: longitude },
                key: process.env.GOOGLE_MAPS_API_KEY,
                language: 'en',
                region: 'in',
                locationTypes: ['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE'],
                resultType: ['street_address', 'premise', 'subpremise', 'route']
            }
        });

        // Log response status
        console.log('Google API response status:', response.data.status);

        if (!response.data.results || response.data.results.length === 0) {
            throw new Error('No results found for this location');
        }

        // Get the most accurate result - first result is typically the most precise
        const result = response.data.results[0];

        // Extract useful components for more detailed response
        let locality = '';
        let administrative_area_level_1 = '';
        let administrative_area_level_2 = '';
        let postal_code = '';
        let sublocality = '';
        let route = '';

        if (result.address_components) {
            for (const component of result.address_components) {
                if (component.types.includes('locality')) {
                    locality = component.long_name;
                }
                if (component.types.includes('administrative_area_level_1')) {
                    administrative_area_level_1 = component.long_name;
                }
                if (component.types.includes('administrative_area_level_2')) {
                    administrative_area_level_2 = component.long_name;
                }
                if (component.types.includes('postal_code')) {
                    postal_code = component.long_name;
                }
                if (component.types.includes('sublocality')) {
                    sublocality = component.long_name;
                }
                if (component.types.includes('route')) {
                    route = component.long_name;
                }
            }
        }

        res.json({
            status: 'success',
            data: {
                formatted_address: result.formatted_address,
                location: result.geometry.location,
                place_id: result.place_id,
                address_components: result.address_components,
                locality: locality,
                administrative_area_level_1: administrative_area_level_1,
                administrative_area_level_2: administrative_area_level_2,
                postal_code: postal_code,
                sublocality: sublocality,
                route: route,
                accuracy: result.geometry.location_type
            }
        });

    } catch (error) {
        console.error('Error fetching current location:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch current location details',
            error: error.message
        });
    }
});

module.exports = router;