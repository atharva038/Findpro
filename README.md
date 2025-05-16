# KnockNFix

![KnockNFix Logo](public/img/icon.png)

## Home Service Booking Application

KnockNFix is a comprehensive platform that connects users with skilled service providers for various home services including plumbing, electrical work, cleaning, painting, and more. The application streamlines the process of finding, booking, and managing home services with a user-friendly interface and robust features.

## Table of Contents

- [Features](#features)
- [Technologies Used](#technologies-used)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Features

### For Customers
- **User Authentication**: Secure registration and login with email verification and "Remember Me" functionality
- **Service Discovery**: Browse and search for services by category, location, and ratings
- **Service Provider Profiles**: View detailed profiles, credentials, and customer reviews
- **Booking System**: Schedule services with preferred date, time, and additional requirements
- **Secure Payments**: Integrated Razorpay payment gateway for secure transactions
- **Booking Management**: Track, modify, or cancel bookings from dashboard
- **Review System**: Rate and review service providers after service completion
- **Complaint Management**: Submit and track complaints through a dedicated portal

### For Service Providers
- **Provider Dashboard**: Manage bookings, services, and profile information
- **Availability Management**: Set working hours and block unavailable dates
- **Service Catalog**: Add and manage offered services with pricing details
- **Booking Confirmation**: Accept or reject booking requests
- **Payment Tracking**: Monitor earnings and transaction history
- **Rating & Reviews**: View customer feedback and respond to reviews

### Administrative Features
- **Admin Dashboard**: Comprehensive analytics and platform management tools
- **User Management**: Approve service providers and manage user accounts
- **Service Management**: Add, edit or remove service categories and types
- **Content Management**: Modify website content and promotional materials
- **Support System**: Handle user complaints and support tickets

## Technologies Used

### Frontend
- EJS (Embedded JavaScript Templates)
- Bootstrap 5
- JavaScript / jQuery
- AJAX for dynamic content loading
- Chart.js for analytics visualization

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose ODM
- Passport.js for authentication

### Key Libraries
- Multer for file uploads
- Cloudinary for image storage
- Nodemailer for email notifications
- Socket.io for real-time notifications
- express-validator for form validation

### Payment Processing
- Razorpay payment gateway integration

### Deployment & DevOps
- Node.js environment
- PM2 process manager
- Nginx as reverse proxy

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/knocknfix.git
   cd knocknfix
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables (see Environment Variables section)

4. Start the development server:
   ```
   nodemon app.js
   ```

5. Access the application at `http://localhost:3000`


## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/knocknfix

# Authentication
SESSION_SECRET=yoursecretkey
JWT_SECRET=anothersecretkey

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_USER=youremail@domain.com
EMAIL_PASS=youremailpassword

# Razorpay
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Google Maps API (for location services)
GOOGLE_MAPS_API_KEY=your_api_key
```

## Project Structure

```
knocknfix/
│
├── config/             # Configuration files
│   ├── cloudinary.js   # Cloudinary setup
│   ├── database.js     # Database connection
│   └── passport.js     # Authentication config
│
├── controllers/        # Route handlers
│
├── middleware/         # Custom middleware
│   ├── auth.js         # Authentication middleware
│   └── validation.js   # Input validation
│
├── models/             # Database models
│
├── public/             # Static files
│   ├── css/
│   ├── js/
│   └── img/
│
├── routes/             # Route definitions
│
├── utils/              # Utility functions
│
├── views/              # EJS templates
│   ├── components/
│   ├── layouts/
│   └── pages/
│
├── app.js              # Application entry point
└── server.js           # Server setup
```

## API Documentation

### User Authentication
- **POST /auth/register** - Register new user
- **POST /auth/login** - User login
- **GET /auth/logout** - User logout
- **POST /auth/forgot-password** - Request password reset

### Services
- **GET /services** - List all services
- **GET /services/:id** - Get service details
- **GET /services/category/:categoryId** - Get services by category

### Bookings
- **POST /bookings** - Create a new booking
- **GET /bookings/:id** - Get booking details
- **PUT /bookings/:id** - Update booking
- **DELETE /bookings/:id** - Cancel booking

### Payments
- **POST /payment/create-order** - Create payment order
- **POST /payment/verify** - Verify payment
- **GET /payment/success** - Payment success page

### Reviews
- **POST /reviews** - Add review
- **GET /reviews/provider/:providerId** - Get reviews for provider

### Complaints
- **POST /complaints** - Submit complaint
- **GET /complaints** - List user's complaints
- **GET /complaints/:id** - View complaint details
