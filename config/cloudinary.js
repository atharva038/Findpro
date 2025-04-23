/**
 * Cloudinary Configuration
 * This file sets up Cloudinary for image storage and processing in the application
 */

// Import required dependencies
const cloudinary = require('cloudinary').v2;  // Import Cloudinary SDK v2
const { CloudinaryStorage } = require('multer-storage-cloudinary');  // Import CloudinaryStorage for Multer
const multer = require('multer');  // Import Multer for file upload handling

/**
 * Configure Cloudinary with API credentials
 * These should be provided in environment variables for security
 */
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,  // Your Cloudinary cloud name
    api_key: process.env.CLOUDINARY_API_KEY,        // Your Cloudinary API key
    api_secret: process.env.CLOUDINARY_API_SECRET   // Your Cloudinary API secret
});

/**
 * Configure CloudinaryStorage to define how files should be stored
 * This determines folder structure, allowed file types, and image transformations
 */
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,  // Pass the configured cloudinary instance
    params: {
        folder: 'KnockNFix',  // Store all uploads in this folder on Cloudinary
        allowedFormats: ['jpeg', 'png', 'jpg'],  // Only allow these image formats
        transformation: [
            { width: 500, height: 500, crop: 'limit' },  // Resize large images but maintain aspect ratio
            { quality: 'auto:good' }  // Apply automatic quality optimization
        ]
    }
});

/**
 * Create Multer middleware with Cloudinary storage
 * This will be used to handle file uploads in route handlers
 */
const upload = multer({ storage: storage });

/**
 * Export the configured modules
 * These can be imported in other files to use Cloudinary functionality
 */
module.exports = {
    cloudinary,  // Export the configured Cloudinary instance for direct API calls
    storage,     // Export storage configuration for custom implementations
    upload       // Export the configured Multer middleware for route handlers
};