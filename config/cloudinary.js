const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'KnockNFix',
        allowedFormats: ['jpeg', 'png', 'jpg'],
        transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto:good' }
        ]
    }
});
const upload = multer({ storage: storage });


module.exports = {
    cloudinary,
    storage,
    upload
};