const Razorpay = require('razorpay');

// Initialize Razorpay
let razorpay = null;

// Log package version
try {
    console.log("Razorpay package version:", require('razorpay/package.json').version);
} catch (err) {
    console.log("Could not determine Razorpay package version");
}

// Log environment variables
console.log("Environment variables check:");
console.log("RAZORPAY_KEY_ID:", process.env.RAZORPAY_KEY_ID ? "exists" : "missing");
console.log("RAZORPAY_KEY_SECRET:", process.env.RAZORPAY_KEY_SECRET ? "exists" : "missing");
console.log("RAZORPAY_ACCOUNT_NUMBER:", process.env.RAZORPAY_ACCOUNT_NUMBER ? "exists" : "missing");

try {
    // Only initialize if keys are available
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        // Print out the structure of the razorpay object for debugging
        console.log("Razorpay object structure check:");
        console.log("Object keys:", Object.keys(razorpay));

        // Check for nested resources
        if (razorpay.resources) {
            console.log("Resources keys:", Object.keys(razorpay.resources));

            // If contacts is under resources, adapt our code to use that path
            if (razorpay.resources.contacts) {
                console.log("Found contacts API in resources.contacts");
                razorpay.contacts = razorpay.resources.contacts;
            }
        }

        // Check if specific APIs exist
        console.log("APIs available check:");
        console.log("- contacts exists:", !!razorpay.contacts);
        console.log("- fundAccount exists:", !!razorpay.fundAccount);
        console.log("- payout exists:", !!razorpay.payout);

        // Check if methods exist on the contacts API if it exists
        if (razorpay.contacts) {
            console.log("- contacts.create exists:", typeof razorpay.contacts.create === 'function');
        }

        // Verify Razorpay instance is working correctly
        if (!razorpay.contacts) {
            console.error("Razorpay instance missing 'contacts' API - will try to adapt");

            // Try to find contacts API in a different location based on SDK structure
            if (razorpay.customers) {
                console.log("Found customers API, will try that path instead");
                razorpay.contacts = razorpay.customers;
            } else if (razorpay.resources && razorpay.resources.contacts) {
                console.log("Using resources.contacts path");
                razorpay.contacts = razorpay.resources.contacts;
            } else {
                console.error("Could not find contacts API in any expected location");
                razorpay = null;
            }
        } else {
            console.log("Razorpay initialized successfully");
        }
    } else {
        console.warn("Razorpay credentials not found in environment variables");
    }
} catch (error) {
    console.error("Error initializing Razorpay:", error);
    razorpay = null;
}

// Helper function to validate Razorpay initialization
const isInitialized = () => {
    if (!razorpay) {
        console.warn("Razorpay is not initialized");
        return false;
    }
    return true;
};

// Utility functions for common Razorpay operations
const createContact = async (userData) => {
    if (!isInitialized()) {
        console.error("Skipping Razorpay contact creation - not initialized");
        return null;
    }

    try {
        // Fallback for missing email to prevent API errors
        if (!userData.email) {
            userData.email = `user-${userData.reference_id}@example.com`;
        }

        console.log("Attempting to create contact with:", userData);

        // Try to create contact using the available API path
        if (razorpay.contacts && typeof razorpay.contacts.create === 'function') {
            console.log("Using standard contacts.create path");
            return await razorpay.contacts.create(userData);
        } else if (razorpay.customers && typeof razorpay.customers.create === 'function') {
            console.log("Using customers.create as fallback");
            return await razorpay.customers.create(userData);
        } else {
            throw new Error("No valid contact creation method found in Razorpay SDK");
        }
    } catch (error) {
        console.error("Razorpay contact creation error:", error);
        throw error;
    }
};

const createFundAccount = async (contactId, bankDetails) => {
    if (!isInitialized()) {
        console.error("Skipping Razorpay fund account creation - not initialized");
        return null;
    }

    try {
        console.log("Creating fund account for contact:", contactId);

        // Check if fundAccount API exists
        if (razorpay.fundAccount && typeof razorpay.fundAccount.create === 'function') {
            return await razorpay.fundAccount.create({
                contact_id: contactId,
                account_type: "bank_account",
                bank_account: {
                    name: bankDetails.accountHolderName,
                    ifsc: bankDetails.ifscCode,
                    account_number: bankDetails.accountNumber
                }
            });
        } else if (razorpay.fund_accounts && typeof razorpay.fund_accounts.create === 'function') {
            // Alternative API path
            return await razorpay.fund_accounts.create({
                contact_id: contactId,
                account_type: "bank_account",
                bank_account: {
                    name: bankDetails.accountHolderName,
                    ifsc: bankDetails.ifscCode,
                    account_number: bankDetails.accountNumber
                }
            });
        } else {
            throw new Error("Fund account API not available in Razorpay SDK");
        }
    } catch (error) {
        console.error("Razorpay fund account creation error:", error);
        throw error;
    }
};

const createPayout = async (fundAccountId, amount, purpose, reference) => {
    if (!isInitialized()) {
        console.error("Skipping Razorpay payout creation - not initialized");
        return null;
    }

    try {
        console.log("Creating payout for fund account:", fundAccountId);

        // Razorpay v2.9.6 might use different API paths for payouts
        if (razorpay.payouts && typeof razorpay.payouts.create === 'function') {
            return await razorpay.payouts.create({
                account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
                fund_account_id: fundAccountId,
                amount: Math.round(amount * 100), // Convert to paise
                currency: "INR",
                mode: "IMPS",
                purpose: purpose,
                queue_if_low_balance: true,
                reference_id: reference
            });
        } else if (razorpay.payments && typeof razorpay.payments.payout === 'function') {
            // Alternative API path
            return await razorpay.payments.payout({
                account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
                fund_account_id: fundAccountId,
                amount: Math.round(amount * 100), // Convert to paise
                currency: "INR",
                mode: "IMPS",
                purpose: purpose,
                queue_if_low_balance: true,
                reference_id: reference
            });
        } else if (razorpay.transfers && typeof razorpay.transfers.create === 'function') {
            // Another alternative - transfers API
            return await razorpay.transfers.create({
                account: process.env.RAZORPAY_ACCOUNT_NUMBER,
                amount: Math.round(amount * 100),
                currency: "INR",
                notes: {
                    purpose: purpose,
                    reference_id: reference
                }
            });
        } else {
            console.error("Could not find a suitable payout API in Razorpay SDK");
            return null;
        }
    } catch (error) {
        console.error("Razorpay payout creation error:", error);
        throw error;
    }
};

module.exports = {
    razorpay,
    createContact,
    createFundAccount,
    createPayout,
    isInitialized
};