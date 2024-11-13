const express = require("express");
const router = express.Router();

// Route for the About Us page
router.get("/about", (req, res) => {
  res.render("pages/aboutUs"); // This will render the about.ejs or about.pug file
});
router.get("/contact", (req, res) => {
  res.render("pages/contact"); // This will render the about.ejs or about.pug file
});


module.exports = router;
