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
});