const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const passportLocalMongoose = require("passport-local-mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  // email: {
  //   type: String,
  //   required: true,
  //   unique: true,
  // },
  role: {
    type: String,
    enum: ["customer", "provider"], // Distinguish between customer and service provider
    default: "customer",
  },
  addresses: [
    {
      type: String,
    },
  ],
  phone: String,
  // New fields for service providers
  serviceCategories: [
    {
      type: String, // The service categories the provider offers, e.g., 'Plumbing'
      required: function () {
        return this.role === "provider"; // Only required for providers
      },
    },
  ],
  servicesOffered: [
    {
      type: mongoose.Schema.Types.ObjectId, // Reference to the services offered by the provider
      ref: "Service",
      required: function () {
        return this.role === "provider"; // Only required for providers
      },
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
});

UserSchema.plugin(passportLocalMongoose);

[
  {
    type: String,
  },
]; // Hash password before saving the user
// UserSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     return next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

const User = mongoose.model("User", UserSchema);
module.exports = User;
