const express = require("express");
const router = express.Router();
const { upload } = require("../../config/cloudinary");
const Service = require("../../models/Service");
const Category = require("../../models/category");


// ✅ Add Category Page (if needed)
router.get("/admin/addCategory", (req, res) => {
    console.log("✅ GET /admin/addCategory route hit");
    res.render("pages/admin/addCategory");
});

// ✅ Add Service Page
router.get("/admin/addService", async (req, res) => {
    const categories = await Category.find();
    res.render("pages/admin/addService", { categories });
});

// ✅ Create New Category
router.post("/admin/category/add", upload.single("image"), async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!req.file) {
            return res.status(400).send("Image is required");
        }

        const newCategory = new Category({
            name,
            description,
            img: req.file.path, // Cloudinary URL
        });

        await newCategory.save();
        res.redirect("/admin/categories");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error adding category");
    }
});
// ✅ Create New Service
router.post("/admin/service/add", upload.single("image"), async (req, res) => {
    try {
        const { category, serviceName, description, price, time, tags } = req.body;

        if (!req.file) {
            return res.status(400).send("Image is required");
        }

        const newService = new Service({
            category,
            name: serviceName,
            description,
            price,
            time,
            img: req.file.path, // Cloudinary URL
            tags: Array.isArray(tags) ? tags : [tags],
        });

        await newService.save();
        res.redirect("/admin/services");
    } catch (err) {
        console.error(err);
        res.status(500).send("Something went wrong");
    }
});

// ✅ Show All Categories
router.get("/admin/categories", async (req, res) => {
    try {
        const categories = await Category.find();
        res.render("pages/admin/category", { categories });
    } catch (err) {
        res.status(500).send("Error fetching categories");
    }
});

// ✅ Show Edit Category Page
router.get("/admin/category/edit/:id", async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        res.render("pages/admin/editCategory", { category });
    } catch (err) {
        res.status(500).send("Error fetching category");
    }
});

// ✅ Update Category
router.post("/admin/category/edit/:id", async (req, res) => {
    try {
        const { name, description, image } = req.body;
        await Category.findByIdAndUpdate(req.params.id, {
            name,
            description,
            image,
        });
        res.redirect("/admin/categories");
    } catch (err) {
        res.status(500).send("Error updating category");
    }
});

// ✅ Delete Category
router.post("/admin/category/delete/:id", async (req, res) => {
    try {
        await Category.findByIdAndDelete(req.params.id);
        res.redirect("/admin/categories");
    } catch (err) {
        res.status(500).send("Error deleting category");
    }
});

module.exports = router;