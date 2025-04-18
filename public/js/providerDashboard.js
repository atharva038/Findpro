document.addEventListener('DOMContentLoaded', function () {
    // Section navigation
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    const sections = document.querySelectorAll('.dashboard-section');

    function showSection(sectionId) {
        sections.forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');

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

    // Booking actions
    const viewButtons = document.querySelectorAll('.view-booking');
    const acceptButtons = document.querySelectorAll('.accept-booking');
    const rejectButtons = document.querySelectorAll('.reject-booking');
    const completeButtons = document.querySelectorAll('.complete-booking');

    viewButtons.forEach(button => {
        button.addEventListener('click', function () {
            const bookingId = this.getAttribute('data-id');
            // Show booking details modal
            console.log('View booking:', bookingId);
        });
    });

    acceptButtons.forEach(button => {
        button.addEventListener('click', async function () {
            const bookingId = this.getAttribute('data-id');

            try {
                const response = await fetch(`/api/bookings/${bookingId}/accept`, {
                    method: 'POST',
                });

                const data = await response.json();
                if (data.success) {
                    // Update UI
                    window.location.reload();
                } else {
                    throw new Error(data.error || 'Failed to accept booking');
                }
            } catch (error) {
                console.error('Error accepting booking:', error);
                alert('Failed to accept booking. Please try again.');
            }
        });
    });

    rejectButtons.forEach(button => {
        button.addEventListener('click', async function () {
            const bookingId = this.getAttribute('data-id');

            if (confirm('Are you sure you want to reject this booking?')) {
                try {
                    const response = await fetch(`/api/bookings/${bookingId}/reject`, {
                        method: 'POST',
                    });

                    const data = await response.json();
                    if (data.success) {
                        // Update UI
                        window.location.reload();
                    } else {
                        throw new Error(data.error || 'Failed to reject booking');
                    }
                } catch (error) {
                    console.error('Error rejecting booking:', error);
                    alert('Failed to reject booking. Please try again.');
                }
            }
        });
    });

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
            document.getElementById('filterDropdown').textContent =
                status.charAt(0).toUpperCase() + status.slice(1);
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
});