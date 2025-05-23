// Global functions defined outside DOMContentLoaded to make them globally available
function openEditModal() {
    const editProfileModal = document.getElementById('editProfileModal');
    if (editProfileModal && typeof bootstrap !== 'undefined') {
        const profileModal = new bootstrap.Modal(editProfileModal);
        profileModal.show();
    }
}

function acceptBooking(bookingId) {
    if (confirm('Are you sure you want to accept this booking?')) {
        fetch(`/api/bookings/${bookingId}/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Booking accepted successfully.');
                    window.location.reload();
                } else {
                    throw new Error(data.error || 'Failed to accept booking');
                }
            })
            .catch(error => {
                console.error('Error accepting booking:', error);
                alert('Failed to accept booking. Please try again.');
            });
    }
}

function rejectBooking(bookingId) {
    if (confirm('Are you sure you want to reject this booking?')) {
        fetch(`/api/bookings/${bookingId}/reject`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Booking rejected successfully.');
                    window.location.reload();
                } else {
                    throw new Error(data.error || 'Failed to reject booking');
                }
            })
            .catch(error => {
                console.error('Error rejecting booking:', error);
                alert('Failed to reject booking. Please try again.');
            });
    }
}

function completeBooking(bookingId) {
    if (confirm('Are you sure you want to mark this booking as completed?')) {
        fetch(`/api/bookings/${bookingId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Booking marked as completed successfully.');
                    window.location.reload();
                } else {
                    throw new Error(data.error || 'Failed to complete booking');
                }
            })
            .catch(error => {
                console.error('Error completing booking:', error);
                alert('Failed to complete booking. Please try again.');
            });
    }
}

function saveProfileChanges() {

    try {
        const form = document.getElementById('editProfileForm');
        if (!form) {
            console.error('Edit profile form not found');
            return;
        }

        const formData = new FormData(form);
        // Show loading state
        const saveProfileBtn = document.getElementById('saveProfileBtn');
        saveProfileBtn.disabled = true;
        saveProfileBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        // Make the fetch request to update profile
        fetch('/profile/update', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                if (!data.success) {
                    throw new Error(data.error || 'Failed to update profile');
                }

                // Now update provider-specific info
                return updateProviderInfo(formData);
            })
            .then(() => {
                // Show success and close modal
                const editProfileModal = document.getElementById('editProfileModal');
                if (editProfileModal && typeof bootstrap !== 'undefined') {
                    const profileModal = bootstrap.Modal.getInstance(editProfileModal);
                    if (profileModal) profileModal.hide();
                }

                alert('Profile updated successfully!');
                window.location.reload();
            })
            .catch(error => {
                console.error('Error updating profile:', error);
                alert('Failed to update profile: ' + error.message);
            })
            .finally(() => {
                // Reset button state
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = 'Save Changes';
            });

    } catch (error) {
        console.error('Error in saveProfileChanges:', error);
        alert('An error occurred while updating profile: ' + error.message);
    }
}

// Helper function to update provider-specific information
function updateProviderInfo(formData) {
    const providerData = {
        experience: formData.get('experience') || undefined,
        specialization: formData.get('specialization') || undefined,
        bio: formData.get('bio') || undefined
    };

    // Only send request if we have data to update
    if (providerData.experience === undefined &&
        providerData.specialization === undefined &&
        providerData.bio === undefined) {
        return Promise.resolve(); // Nothing to update
    }

    return fetch('/dashboard/provider/update-info', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(providerData)
    })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error || 'Failed to update provider information');
            }
            return data;
        });
}

// Main event listener for when DOM is fully loaded
document.addEventListener('DOMContentLoaded', function () {
    // Connect save profile button to the saveProfileChanges function
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfileChanges);
    } else {
        console.log('Save Profile button not found');
    }

    // SECTION 1: DASHBOARD NAVIGATION
    // ---------------------------------------------
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.dashboard-section');

    function showSection(sectionId) {
        // Look for both possibilities: with and without -section suffix
        const targetSection = document.getElementById(sectionId + '-section') ||
            document.getElementById(sectionId);

        if (!targetSection) {
            console.warn(`Section "${sectionId}" or "${sectionId}-section" not found`);
            return;
        }

        // Hide all sections first
        sections.forEach(section => {
            section.style.display = 'none';
            section.classList.remove('active');
        });

        // Show the target section
        targetSection.style.display = 'block';
        targetSection.classList.add('active');

        // Update active state in navigation
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('data-section') === sectionId) {
                link.classList.add('active');
            }
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            showSection(sectionId);
            history.pushState(null, null, '#' + sectionId);
        });
    });

    // Show section based on URL hash or default to overview
    const defaultSection = window.location.hash.slice(1) || 'overview';
    showSection(defaultSection);


    // SECTION 2: PROFILE MANAGEMENT
    // ---------------------------------------------
    // Profile image preview functionality
    const profileImage = document.getElementById('profileImage');
    const modalProfileImage = document.getElementById('modalProfileImage');
    const profilePreview = document.getElementById('profilePreview');
    const modalProfilePreview = document.getElementById('modalProfilePreview');

    function previewImage(input, imgElement) {
        if (input.files && input.files[0] && imgElement) {
            const reader = new FileReader();
            reader.onload = function (e) {
                imgElement.src = e.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    if (profileImage) {
        profileImage.addEventListener('change', function () {
            previewImage(this, profilePreview);
        });
    }

    if (modalProfileImage) {
        modalProfileImage.addEventListener('change', function () {
            previewImage(this, modalProfilePreview);
            // Also update the main profile preview
            if (profilePreview) {
                previewImage(this, profilePreview);
            }
        });
    }

    // SECTION 3: BOOKING MANAGEMENT
    // ---------------------------------------------
    // Booking actions
    const viewButtons = document.querySelectorAll('.view-booking');
    const acceptButtons = document.querySelectorAll('.accept-booking');
    const rejectButtons = document.querySelectorAll('.reject-booking');
    const completeButtons = document.querySelectorAll('.complete-booking');

    const bookingModalElement = document.getElementById('viewBookingModal');
    let bookingModal = null;

    if (bookingModalElement && typeof bootstrap !== 'undefined') {
        bookingModal = new bootstrap.Modal(bookingModalElement);
    }

    // View booking details
    viewButtons.forEach(button => {
        button.addEventListener('click', async function () {
            const bookingId = this.getAttribute('data-id');
            try {
                await fetchBookingDetails(bookingId);
                if (bookingModal) {
                    bookingModal.show();
                }
            } catch (error) {
                console.error('Error showing booking details:', error);
                alert('Failed to load booking details. Please try again.');
            }
        });
    });

    async function fetchBookingDetails(bookingId) {
        try {
            // Define required and optional elements
            const requiredModalElements = [
                'modal-service-name',
                'modal-customer-name',
                'modal-booking-date',
                'modal-booking-address',
                'modal-booking-notes',
                'modal-booking-cost',
                'modal-payment-status',
                'modal-booking-status',
                'modal-action-buttons'
            ];

            const optionalModalElements = [
                'modal-customer-phone',
                'modal-customer-email'
            ];

            // Check if required modal elements exist
            let missingElements = [];
            for (const elementId of requiredModalElements) {
                if (!document.getElementById(elementId)) {
                    missingElements.push(elementId);
                }
            }

            if (missingElements.length > 0) {
                console.error(`Missing modal elements: ${missingElements.join(', ')}`);
                throw new Error(`Modal element ${missingElements[0]} not found in the DOM`);
            }

            // Show loading state
            document.getElementById('modal-service-name').textContent = "Loading...";
            document.getElementById('modal-customer-name').textContent = "Loading...";
            document.getElementById('modal-booking-date').textContent = "Loading...";
            document.getElementById('modal-booking-address').textContent = "Loading...";
            document.getElementById('modal-booking-notes').textContent = "Loading...";
            document.getElementById('modal-booking-cost').textContent = "Loading...";
            document.getElementById('modal-payment-status').textContent = "Loading...";
            document.getElementById('modal-booking-status').textContent = "Loading...";

            // Set loading for optional elements if they exist
            optionalModalElements.forEach(elementId => {
                const element = document.getElementById(elementId);
                if (element) {
                    element.textContent = elementId.includes('phone') || elementId.includes('email')
                        ? "Not provided"
                        : "Loading...";
                }
            });

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
            document.getElementById('modal-customer-name').textContent = booking.customer.name;

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

            // Set customer information
            const customerPhone = document.getElementById('modal-customer-phone');
            const customerEmail = document.getElementById('modal-customer-email');

            if (customerPhone && booking.customer && booking.customer.phone) {
                customerPhone.textContent = booking.customer.phone;
            }

            if (customerEmail && booking.customer && booking.customer.email) {
                customerEmail.textContent = booking.customer.email;
            }

            // Update action buttons based on booking status
            const actionButtonsContainer = document.getElementById('modal-action-buttons');
            actionButtonsContainer.innerHTML = '';

            if (booking.status === 'pending') {
                actionButtonsContainer.innerHTML = `
                    <button type="button" class="btn btn-success accept-booking-modal" data-id="${booking._id}">
                        <i class="fas fa-check me-2"></i>Accept Booking
                    </button>
                    <button type="button" class="btn btn-danger reject-booking-modal" data-id="${booking._id}">
                        <i class="fas fa-times me-2"></i>Reject Booking
                    </button>
                `;

                // Add event listeners to the newly created buttons
                const acceptModalBtn = actionButtonsContainer.querySelector('.accept-booking-modal');
                const rejectModalBtn = actionButtonsContainer.querySelector('.reject-booking-modal');

                if (acceptModalBtn) {
                    acceptModalBtn.addEventListener('click', function () {
                        acceptBooking(this.getAttribute('data-id'));
                    });
                }

                if (rejectModalBtn) {
                    rejectModalBtn.addEventListener('click', function () {
                        rejectBooking(this.getAttribute('data-id'));
                    });
                }

            } else if (booking.status === 'confirmed') {
                actionButtonsContainer.innerHTML = `
                    <button type="button" class="btn btn-primary complete-booking-modal" data-id="${booking._id}">
                        <i class="fas fa-check-circle me-2"></i>Mark as Completed
                    </button>
                `;

                const completeModalBtn = actionButtonsContainer.querySelector('.complete-booking-modal');
                if (completeModalBtn) {
                    completeModalBtn.addEventListener('click', function () {
                        completeBooking(this.getAttribute('data-id'));
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching booking details:', error);
            throw error;
        }
    }

    // Handle existing table buttons
    if (acceptButtons && acceptButtons.length > 0) {
        acceptButtons.forEach(button => {
            button.addEventListener('click', function () {
                const bookingId = this.getAttribute('data-id');
                acceptBooking(bookingId);
            });
        });
    }

    if (rejectButtons && rejectButtons.length > 0) {
        rejectButtons.forEach(button => {
            button.addEventListener('click', function () {
                const bookingId = this.getAttribute('data-id');
                rejectBooking(bookingId);
            });
        });
    }

    if (completeButtons && completeButtons.length > 0) {
        completeButtons.forEach(button => {
            button.addEventListener('click', function () {
                const bookingId = this.getAttribute('data-id');
                completeBooking(bookingId);
            });
        });
    }

    // SECTION 4: BOOKING FILTERING & SEARCH
    // ---------------------------------------------
    // Filter bookings by status
    const filterItems = document.querySelectorAll('.filter-item');

    filterItems.forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const status = this.getAttribute('data-status');

            const bookingRows = document.querySelectorAll('.booking-table tbody tr');

            bookingRows.forEach(row => {
                if (status === 'all' || row.getAttribute('data-status') === status) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });

            // Update filter button text
            const filterDropdown = document.getElementById('filterDropdown');
            if (filterDropdown) {
                filterDropdown.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            }
        });
    });

    // Search bookings
    const searchInput = document.getElementById('bookingSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();
            const bookingRows = document.querySelectorAll('.booking-table tbody tr');

            bookingRows.forEach(row => {
                const text = row.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    }

    // AVAILABILITY MANAGEMENT
    const saveAvailabilityBtn = document.getElementById('saveAvailabilityBtn');
    const dayToggles = document.querySelectorAll('.day-toggle');
    const addSlotBtns = document.querySelectorAll('.add-slot-btn');

    if (!saveAvailabilityBtn) {
        // Add a save button if it doesn't exist
        const settingsHeader = document.querySelector('#settings .section-header');
        if (settingsHeader) {
            const saveBtn = document.createElement('button');
            saveBtn.type = 'button';
            saveBtn.className = 'btn btn-primary';
            saveBtn.id = 'saveAvailabilityBtn';
            saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
            settingsHeader.appendChild(saveBtn);
        }
    }

    // Toggle day availability
    dayToggles.forEach(toggle => {
        toggle.addEventListener('change', function () {
            const day = this.getAttribute('data-day');
            const slotsContainer = document.getElementById(`${day}-slots`);

            if (this.checked) {
                slotsContainer.style.display = 'block';
            } else {
                slotsContainer.style.display = 'none';
            }
        });
    });

    // Update the addSlotBtns event listener to set the default time slots from 7 AM to 9 PM
    addSlotBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const day = this.getAttribute('data-day');
            const slotsContainer = document.getElementById(`${day}-slots`);
            const slotRows = slotsContainer.querySelectorAll('.slot-row');
            const newIndex = slotRows.length;

            // Create new slot HTML with default times from 7 AM to 9 PM
            const slotRow = document.createElement('div');
            slotRow.className = 'slot-row d-flex align-items-center mb-2';
            slotRow.setAttribute('data-index', newIndex);

            slotRow.innerHTML = `
            <div class="time-range flex-grow-1">
                <div class="input-group">
                    <input type="time" class="form-control slot-start" value="07:00" name="${day}-start-${newIndex}" required>
                    <span class="input-group-text">to</span>
                    <input type="time" class="form-control slot-end" value="21:00" name="${day}-end-${newIndex}" required>
                </div>
            </div>
            <div class="form-check form-switch ms-3 me-2">
                <input class="form-check-input slot-active" type="checkbox" id="${day}-slot-${newIndex}-active" checked>
                <label class="form-check-label" for="${day}-slot-${newIndex}-active">Active</label>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger remove-slot-btn">
                <i class="fas fa-trash"></i>
            </button>
        `;

            slotsContainer.appendChild(slotRow);

            // Add event listener to new remove button
            const removeBtn = slotRow.querySelector('.remove-slot-btn');
            removeBtn.addEventListener('click', removeSlot);
        });
    });

    // Remove time slot
    const removeSlotBtns = document.querySelectorAll('.remove-slot-btn');
    removeSlotBtns.forEach(btn => {
        btn.addEventListener('click', removeSlot);
    });

    function removeSlot() {
        if (confirm('Are you sure you want to remove this time slot?')) {
            this.closest('.slot-row').remove();
        }
    }

    // Add event listeners to all slot toggles
    document.querySelectorAll('.slot-active').forEach(toggle => {
        toggle.addEventListener('change', function () {
            // Save changes automatically when toggling a slot's active status
            saveAvailability();
        });
    });

    // Save all availability settings
    const saveAvailBtn = document.getElementById('saveAvailabilityBtn');
    if (saveAvailBtn) {
        saveAvailBtn.addEventListener('click', saveAvailability);
    }

    function saveAvailability() {
        const saveBtn = document.getElementById('saveAvailabilityBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
        saveBtn.classList.add('saving');

        // Prepare availability data
        const availabilityData = {
            isActive: document.getElementById('overall-availability').checked,
            availability: {}
        };

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        days.forEach(day => {
            const isAvailable = document.getElementById(`${day}-available`).checked;
            const slots = [];

            if (isAvailable) {
                const slotRows = document.querySelectorAll(`#${day}-slots .slot-row`);

                slotRows.forEach(row => {
                    const startTime = row.querySelector('.slot-start').value;
                    const endTime = row.querySelector('.slot-end').value;
                    const isActive = row.querySelector('.slot-active').checked;

                    // Validate times before adding
                    if (startTime && endTime) {
                        slots.push({
                            startTime,
                            endTime,
                            isActive
                        });
                    }
                });
            }

            // Always ensure at least one slot per day with new default times
            if (slots.length === 0 && isAvailable) {
                slots.push({
                    startTime: "07:00",  // Updated from 09:00
                    endTime: "21:00",    // Updated from 17:00
                    isActive: true
                });
            }

            availabilityData.availability[day] = {
                isAvailable,
                slots
            };
        });

        // Send to server
        fetch('/dashboard/provider/update-availability', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(availabilityData)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    const successToast = document.createElement('div');
                    successToast.className = 'toast align-items-center text-white bg-success border-0 position-fixed bottom-0 end-0 m-3';
                    successToast.setAttribute('role', 'alert');
                    successToast.setAttribute('aria-live', 'assertive');
                    successToast.setAttribute('aria-atomic', 'true');
                    successToast.style.zIndex = '9999';
                    successToast.innerHTML = `
                    <div class="d-flex">
                      <div class="toast-body">
                        <i class="fas fa-check-circle me-2"></i> Availability settings saved successfully!
                      </div>
                      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                `;

                    document.body.appendChild(successToast);

                    // Show the toast
                    if (typeof bootstrap !== 'undefined') {
                        const toast = new bootstrap.Toast(successToast, { delay: 5000 });
                        toast.show();
                        // Remove after hiding
                        successToast.addEventListener('hidden.bs.toast', function () {
                            document.body.removeChild(successToast);
                        });
                    } else {
                        // Fallback
                        setTimeout(() => {
                            successToast.classList.add('show');
                            setTimeout(() => {
                                successToast.classList.remove('show');
                                setTimeout(() => {
                                    document.body.removeChild(successToast);
                                }, 300);
                            }, 5000);
                        }, 100);
                    }
                } else {
                    throw new Error(data.error || 'Failed to save availability settings');
                }
            })
            .catch(error => {
                console.error('Error saving availability:', error);
                alert('Failed to save availability settings. Please try again.');
            })
            .finally(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
                saveBtn.classList.remove('saving');
            });
    }
});
// Add this to your providerDashboard.js file
document.addEventListener('DOMContentLoaded', function () {
    // Service area form handling
    const saveServiceAreaBtn = document.getElementById('saveServiceAreaBtn');
    if (saveServiceAreaBtn) {
        saveServiceAreaBtn.addEventListener('click', saveServiceArea);
    }

    function saveServiceArea() {
        const saveBtn = document.getElementById('saveServiceAreaBtn');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        // Get form data
        const serviceAreaData = {
            radius: parseInt(document.getElementById('service-radius').value) || 20,
            city: document.getElementById('service-city').value,
            state: document.getElementById('service-state').value,
            pincode: document.getElementById('service-pincode').value
        };

        // Send to server
        fetch('/dashboard/provider/update-service-area', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(serviceAreaData)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Show success message
                    showToast('success', 'Service area updated successfully');
                } else {
                    throw new Error(data.error || 'Failed to update service area');
                }
            })
            .catch(error => {
                console.error('Error saving service area:', error);
                showToast('error', 'Failed to update service area. Please try again.');
            })
            .finally(() => {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Service Area';
            });
    }

    function showToast(type, message) {
        const toastContainer = document.getElementById('toast-container') || createToastContainer();

        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');

        toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

        toastContainer.appendChild(toast);

        // Use Bootstrap's toast functionality if available
        if (typeof bootstrap !== 'undefined') {
            const bsToast = new bootstrap.Toast(toast, { delay: 5000 });
            bsToast.show();
        } else {
            // Manual fallback
            toast.style.display = 'block';
            setTimeout(() => {
                toast.remove();
            }, 5000);
        }
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        container.style.zIndex = '1080';
        document.body.appendChild(container);
        return container;
    }
});