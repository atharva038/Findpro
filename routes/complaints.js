const express = require('express');
const router = express.Router();
const Complaint = require('../models/Complaint');
const { isLoggedIn } = require('../middleware');
const { upload } = require('../config/cloudinary');

// Get all complaints for a user
// Get all complaints for a user
// Add this to your dashboard or complaints route handler

router.get('/', isLoggedIn, async (req, res) => {
    try {
      // Find complaints for the current user
      const complaints = await Complaint.find({ user: req.user._id })
        .sort({ createdAt: -1 }) // Newest first
        .exec();
      
      // Render the complaints page with the complaints data
      res.render('pages/complaints', {
        complaints: complaints, // Make sure complaints is defined
        pageTitle: 'My Complaints',
        user: req.user
      });
    } catch (err) {
      console.error('Error fetching complaints:', err);
      req.flash('error', 'Failed to load complaints. Please try again.');
      res.redirect('/dashboard'); // Redirect to dashboard if error occurs
    }
  });

// Add new complaint
router.post('/add', isLoggedIn, upload.array('attachments'), async (req, res) => {
    try {
        const { subject, description } = req.body;
        const attachments = req.files ? req.files.map(file => file.path) : [];

        const complaint = new Complaint({
            user: req.user._id,
            subject,
            description,
            attachments
        });

        await complaint.save();
        res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error submitting complaint');
    }
});

module.exports = router;