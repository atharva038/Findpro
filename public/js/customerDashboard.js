document.addEventListener("DOMContentLoaded", function () {
    // Set bookings section as active by default
    const defaultSection = document.getElementById('bookings');
    const defaultNavLink = document.querySelector('.nav-link[data-section="bookings"]');

    if (defaultSection && defaultNavLink) {
        // Activate bookings section
        document.querySelectorAll('.dashboard-section').forEach(section => {
            section.classList.remove('active');
        });
        defaultSection.classList.add('active');

        // Activate bookings nav link
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        defaultNavLink.classList.add('active');
    }

    // Handle section navigation
    const navLinks = document.querySelectorAll(".nav-link[data-section]");
    const sections = document.querySelectorAll(".dashboard-section");

    navLinks.forEach((link) => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            const targetSection = this.getAttribute("data-section");

            // Update active states
            navLinks.forEach((l) => l.classList.remove("active"));
            this.classList.add("active");

            // Show/hide sections
            sections.forEach((section) => {
                section.classList.remove('active');
                if (section.id === targetSection) {
                    section.classList.add('active');
                }
            });
        });
    });

    // Handle booking status filter
    const statusFilter = document.querySelector(".status-filter");
    if (statusFilter) {
        statusFilter.addEventListener("change", function () {
            const rows = document.querySelectorAll(".booking-table tbody tr");
            const selectedStatus = this.value.toLowerCase();

            rows.forEach((row) => {
                const status = row.querySelector(".status-badge").textContent.toLowerCase();
                row.style.display = selectedStatus === "all" || status === selectedStatus ? "" : "none";
            });
        });
    }

    // Initialize tooltips
    const tooltips = document.querySelectorAll("[title]");
    tooltips.forEach((el) => {
        new bootstrap.Tooltip(el);
    });

    // Handle view booking button clicks
    const viewButtons = document.querySelectorAll(".view-booking-btn");
    const cancelButtons = document.querySelectorAll(".cancel-booking-btn");

    // Initialize the booking details modal
    const bookingModal = document.getElementById('viewBookingModal');

    if (bookingModal) {
        viewButtons.forEach(button => {
            button.addEventListener("click", async function () {
                const bookingId = this.getAttribute("data-id");
                await fetchBookingDetails(bookingId);
            });
        });
    }

    if (cancelButtons) {
        cancelButtons.forEach(button => {
            button.addEventListener("click", async function () {
                const bookingId = this.getAttribute("data-id");
                if (confirm("Are you sure you want to cancel this booking?")) {
                    await cancelBooking(bookingId);
                }
            });
        });
    }

    async function fetchBookingDetails(bookingId) {
        try {
            // Show loading state
            document.getElementById('modal-service-name').textContent = "Loading...";
            document.getElementById('modal-provider-name').textContent = "Loading...";
            document.getElementById('modal-booking-date').textContent = "Loading...";
            document.getElementById('modal-booking-address').textContent = "Loading...";
            document.getElementById('modal-booking-notes').textContent = "Loading...";
            document.getElementById('modal-booking-cost').textContent = "Loading...";
            document.getElementById('modal-payment-status').textContent = "Loading...";
            document.getElementById('modal-booking-status').textContent = "Loading...";

            // Fetch booking details from the server
            const response = await fetch(`/api/bookings/${bookingId}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to fetch booking details");
            }

            // Update modal with booking details
            const booking = data.booking;

            // Basic info
            document.getElementById('modal-service-name').textContent = booking.service.name;
            document.getElementById('modal-provider-name').textContent = booking.provider.user.name;

            // Format date
            const bookingDate = new Date(booking.bookingDate);
            const dateStr = bookingDate.toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            const timeStr = bookingDate.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
            document.getElementById('modal-booking-date').textContent = `${dateStr} at ${timeStr}`;

            // Address and notes
            document.getElementById('modal-booking-address').textContent = booking.address || "Not specified";
            document.getElementById('modal-booking-notes').textContent = booking.notes || "No notes provided";

            // Cost and payment
            document.getElementById('modal-booking-cost').textContent = `₹${booking.totalCost}`;

            // Payment status
            let paymentStatusText = "Pending";
            if (booking.paymentStatus === "completed") {
                paymentStatusText = "Fully Paid";
            } else if (booking.paymentStatus === "partially_paid") {
                paymentStatusText = "Advance Paid";
            }
            document.getElementById('modal-payment-status').textContent = paymentStatusText;

            // Status badge
            const statusBadge = document.getElementById('modal-booking-status');
            statusBadge.textContent = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);
            statusBadge.className = `status-badge status-${booking.status.toLowerCase()}`;

            // Set payment information based on booking status
            const paymentInfoContainer = document.getElementById('payment-info-container');
            const actionButtonsContainer = document.getElementById('modal-action-buttons');

            paymentInfoContainer.innerHTML = '';
            actionButtonsContainer.innerHTML = '';

            // Add appropriate action buttons based on booking status
            if (booking.status === 'pending') {
                // If booking is pending and not cancelled
                actionButtonsContainer.innerHTML = `
                    <button type="button" class="btn btn-danger" onclick="cancelBooking('${booking._id}')">
                        <i class="fas fa-times me-2"></i>Cancel Booking
                    </button>
                `;

                // If advance payment is pending
                if (!booking.advancePayment || !booking.advancePayment.paid) {
                    const advanceAmount = (booking.totalCost * 0.1).toFixed(2);
                    paymentInfoContainer.innerHTML = `
                        <div class="alert alert-warning">
                            <i class="fas fa-info-circle me-2"></i>
                            Your booking is pending advance payment of ₹${advanceAmount} (10%)
                        </div>
                        <button class="btn btn-primary payment-action-btn" onclick="makeAdvancePayment('${booking._id}')">
                            <i class="fas fa-credit-card me-2"></i>
                            Pay Advance (10%)
                        </button>
                    `;
                }
            } else if (booking.status === 'confirmed') {
                // If booking is confirmed, show remaining payment option
                const remainingAmount = (booking.totalCost * 0.9).toFixed(2);

                paymentInfoContainer.innerHTML = `
                    <div class="alert alert-info">
                        <i class="fas fa-info-circle me-2"></i>
                        Service has been confirmed. Remaining payment: ₹${remainingAmount} (90%)
                    </div>
                    <button class="btn btn-success payment-action-btn" onclick="completePayment('${booking._id}')">
                        <i class="fas fa-check-circle me-2"></i>
                        Complete Payment & Mark as Done
                    </button>
                `;
            } else if (booking.status === 'completed') {
                // If booking is completed, offer rating option
                actionButtonsContainer.innerHTML = `
                    <button type="button" class="btn btn-outline-primary" onclick="rateService('${booking._id}')">
                        <i class="fas fa-star me-2"></i>
                        Rate Service
                    </button>
                `;

                paymentInfoContainer.innerHTML = `
                    <div class="alert alert-success">
                        <i class="fas fa-check-circle me-2"></i>
                        Payment completed. Thank you for using our service!
                    </div>
                `;
            } else if (booking.status === 'cancelled') {
                // If booking is cancelled
                paymentInfoContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="fas fa-exclamation-circle me-2"></i>
                        This booking has been cancelled.
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error fetching booking details:', error);
            alert('Failed to load booking details. Please try again.');
        }
    }
});

function completePayment(bookingId) {
    if (confirm('Proceed with the remaining payment for this booking?')) {
        fetch(`/payment/${bookingId}/complete-payment`, {
            method: 'POST'
        })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `HTTP error! Status: ${response.status}`);
                    }).catch(e => {
                        // If JSON parsing fails
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log("Payment API response:", data);

                if (!data.success) {
                    throw new Error(data.error || 'Failed to initiate payment');
                }

                if (!data.order || !data.key || !data.booking) {
                    console.error("Invalid payment response:", data);
                    throw new Error('Incomplete payment data received from server');
                }

                // Initialize Razorpay payment
                const options = {
                    key: data.key,
                    amount: data.order.amount,
                    currency: data.order.currency,
                    name: "KnockNFix",
                    description: `Payment for ${data.booking.service}`,
                    order_id: data.order.id,
                    handler: function (response) {
                        // Handle successful payment
                        verifyPayment(response, bookingId, 'final');
                    },
                    prefill: {
                        name: data.booking.customer.name || '',
                        email: data.booking.customer.email || '',
                        contact: data.booking.customer.phone || ''
                    },
                    theme: {
                        color: "#3399cc"
                    },
                    modal: {
                        ondismiss: function () {
                            console.log('Payment dismissed');
                        }
                    }
                };

                try {
                    const rzp = new Razorpay(options);
                    rzp.open();
                } catch (e) {
                    console.error("Error initializing Razorpay:", e);
                    alert("Error initializing payment gateway. Please ensure Razorpay is properly loaded.");
                }
            })
            .catch(error => {
                console.error('Error initiating payment:', error);
                alert('Failed to initiate payment: ' + error.message);
            });
    }
}
function makeAdvancePayment(bookingId) {
    if (confirm('Proceed with advance payment (10%) for this booking?')) {
        // Change this to use the payment route instead of the bookings route
        fetch(`/payment/${bookingId}/advance-payment`, {
            method: 'POST'
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Initialize Razorpay payment
                    const options = {
                        key: data.key,
                        amount: data.order.amount,
                        currency: data.order.currency,
                        name: "KnockNFix",
                        description: `Advance Payment for ${data.booking.service}`,
                        order_id: data.order.id,
                        handler: function (response) {
                            // Handle successful payment
                            verifyPayment(response, bookingId, 'advance');
                        },
                        prefill: {
                            name: data.booking.customer.name,
                            email: data.booking.customer.email,
                            contact: data.booking.customer.phone
                        },
                        theme: {
                            color: "#3399cc"
                        },
                        modal: {
                            ondismiss: function () {
                                console.log('Payment dismissed');
                            }
                        }
                    };

                    const rzp = new Razorpay(options);
                    rzp.open();
                } else {
                    throw new Error(data.error || 'Failed to initiate payment');
                }
            })
            .catch(error => {
                console.error('Error initiating advance payment:', error);
                alert('Failed to initiate payment. Please try again.');
            });
    }
}

function verifyPayment(response, bookingId, paymentType) {
    console.log("Verifying payment with data:", {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
        bookingId: bookingId,
        paymentType: paymentType
    });

    fetch('/payment/verify-payment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            bookingId: bookingId,
            paymentType: paymentType
        })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(errorData => {
                    console.error("Server returned error:", errorData);
                    throw new Error(errorData.error || `Server error: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {

                if (paymentType === 'final') {
                    // Redirect to feedback page after final payment
                    window.location.href = `/feedback/${bookingId}`;
                } else {
                    alert('Payment processed successfully!');
                    window.location.reload();
                }
            } else {
                throw new Error(data.error || 'Payment verification failed');
            }
        })
        .catch(error => {
            console.error('Error verifying payment:', error);
            alert('Payment verification failed. Please contact support.');
        });
}
function cancelBooking(bookingId) {
    if (confirm('Are you sure you want to cancel this booking?')) {
        fetch(`/api/bookings/${bookingId}/cancel`, {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Booking cancelled successfully.');
                    window.location.reload();
                } else {
                    throw new Error(data.error || 'Failed to cancel booking');
                }
            })
            .catch(error => {
                console.error('Error cancelling booking:', error);
                alert('Failed to cancel booking. Please try again.');
            });
    }
}

function rateService(bookingId) {
    window.location.href = `/feedback/${bookingId}`;
}