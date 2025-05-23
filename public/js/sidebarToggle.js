document.addEventListener("DOMContentLoaded", function () {
    // Get sidebar elements
    const sidebarToggle = document.getElementById("sidebarToggle");
    const sidebar = document.querySelector(".sidebar");
    const navLinks = document.querySelectorAll(".nav-link[data-section]");

    // Setup toggle functionality for mobile
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener("click", function (e) {
            e.preventDefault();
            sidebar.classList.toggle("active");

            // Toggle icon if present
            const icon = this.querySelector("i");
            if (icon) {
                icon.classList.toggle("fa-bars");
                icon.classList.toggle("fa-times");
            }
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener("click", function (e) {
            if (window.innerWidth <= 768 &&
                sidebar.classList.contains("active") &&
                !sidebar.contains(e.target) &&
                e.target !== sidebarToggle &&
                !sidebarToggle.contains(e.target)) {
                sidebar.classList.remove("active");

                // Reset icon
                const icon = sidebarToggle.querySelector("i");
                if (icon) {
                    icon.classList.remove("fa-times");
                    icon.classList.add("fa-bars");
                }
            }
        });
    }

    // Dashboard section navigation
    navLinks.forEach(link => {
        link.addEventListener("click", function (e) {
            e.preventDefault();
            const sectionId = this.getAttribute("data-section");

            // Try to find the section with multiple ID formats:
            // 1. Exact match with data-section value
            // 2. With -section suffix
            // 3. With dashboard-section class and matching id
            const targetSection =
                document.getElementById(sectionId) ||
                document.getElementById(`${sectionId}-section`) ||
                document.querySelector(`.dashboard-section#${sectionId}`);

            // Only proceed if we found the section
            if (targetSection) {
                // Update active state on navigation links
                navLinks.forEach(navLink => navLink.classList.remove("active"));
                this.classList.add("active");

                // Hide all sections and show the target section
                const sections = document.querySelectorAll(".dashboard-section");
                sections.forEach(section => {
                    section.style.display = "none";
                });
                targetSection.style.display = "block";

                // Update URL hash
                window.location.hash = sectionId;

                // Close sidebar on mobile after navigation
                if (window.innerWidth <= 768 && sidebar && sidebar.classList.contains("active")) {
                    sidebar.classList.remove("active");

                    // Reset icon
                    if (sidebarToggle) {
                        const icon = sidebarToggle.querySelector("i");
                        if (icon) {
                            icon.classList.remove("fa-times");
                            icon.classList.add("fa-bars");
                        }
                    }
                }

                // For locations section, trigger map initialization
                if (sectionId === "locations" && typeof google !== 'undefined' && google.maps) {
                    setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                        document.dispatchEvent(new CustomEvent('google-maps-loaded'));
                    }, 100);
                }
            } else {
                console.warn(`Section with id "${sectionId}" or "${sectionId}-section" not found`);

                // If it's a regular link like Register Service, let it navigate normally
                if (this.getAttribute("href").startsWith("/")) {
                    window.location.href = this.getAttribute("href");
                }
            }
        });
    });

    // Handle initial URL hash navigation
    function handleHashChange() {
        const hash = window.location.hash.substr(1);
        if (hash) {
            const targetLink = document.querySelector(`.nav-link[data-section="${hash}"]`);
            if (targetLink) {
                targetLink.click();
            }
        } else {
            // If no hash, activate the first section by default
            const firstLink = document.querySelector('.nav-link[data-section]');
            if (firstLink) {
                firstLink.click();
            }
        }
    }

    // Check hash on load
    handleHashChange();

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);
});