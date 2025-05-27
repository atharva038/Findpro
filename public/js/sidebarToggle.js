/**
 * Enhanced Sidebar Toggle Script
 * Handles sidebar responsiveness, section navigation, and mobile/tablet interactions
 */
document.addEventListener("DOMContentLoaded", function () {
    // Get DOM elements
    const sidebar = document.querySelector('.sidebar');
    const toggle = document.getElementById('sidebarToggle');
    const overlay = document.querySelector('.sidebar-overlay');
    const body = document.body;
    const navLinks = document.querySelectorAll('.nav-link[data-section]');

    // Setup tooltip data attributes for all navigation links
    navLinks.forEach(link => {
        // Use the section data attribute for tooltip content if not already set
        if (!link.getAttribute('data-tooltip') && link.querySelector('.nav-text')) {
            const text = link.querySelector('.nav-text').textContent.trim();
            link.setAttribute('data-section', text);
        }
    });

    // Toggle sidebar visibility
    if (toggle && sidebar) {
        toggle.addEventListener('click', function (e) {
            e.preventDefault();

            sidebar.classList.toggle('active');
            body.classList.toggle('sidebar-open');

            // Toggle icon if present
            const icon = this.querySelector("i");
            if (icon) {
                icon.classList.toggle("fa-bars");
                icon.classList.toggle("fa-times");
            }
        });
    }

    // Close sidebar when clicking on overlay
    if (overlay && sidebar) {
        overlay.addEventListener('click', function () {
            sidebar.classList.remove('active');
            body.classList.remove('sidebar-open');

            // Reset toggle button icon
            const icon = toggle.querySelector('i');
            if (icon) {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Section navigation functionality
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const sectionId = this.getAttribute('data-section');

                // Find the target section
                const targetSection = document.getElementById(`${sectionId}-section`) ||
                    document.getElementById(sectionId);

                if (targetSection) {
                    // Update active link
                    navLinks.forEach(navLink => navLink.classList.remove('active'));
                    this.classList.add('active');

                    // Hide all sections, show target section
                    const sections = document.querySelectorAll('.dashboard-section');
                    sections.forEach(section => section.style.display = 'none');
                    targetSection.style.display = 'block';

                    // Update URL hash
                    window.location.hash = sectionId;

                    // Close sidebar on mobile
                    if (window.innerWidth <= 991 && sidebar) {
                        sidebar.classList.remove('active');
                        body.classList.remove('sidebar-open');

                        if (toggle) {
                            const icon = toggle.querySelector('i');
                            if (icon) {
                                icon.classList.remove('fa-times');
                                icon.classList.add('fa-bars');
                            }
                        }
                    }
                }
            }
        });
    });

    // Handle initial hash navigation
    const handleHashNavigation = () => {
        const hash = window.location.hash.substring(1);
        if (hash) {
            const targetLink = document.querySelector(`.nav-link[data-section="${hash}"]`);
            if (targetLink) {
                targetLink.click();
            }
        } else {
            const firstLink = document.querySelector('.nav-link[data-section]');
            if (firstLink) {
                firstLink.click();
            }
        }
    };

    // Run on load and when hash changes
    handleHashNavigation();
    window.addEventListener('hashchange', handleHashNavigation);

    // Responsive behavior for sidebar
    const handleResponsiveSidebar = () => {
        const windowWidth = window.innerWidth;

        // Show/hide toggle button based on screen size
        if (toggle) {
            toggle.style.display = windowWidth <= 768 ? 'block' : 'none';
        }

        // If returning to desktop size, reset sidebar state
        if (windowWidth > 991) {
            sidebar?.classList.remove('active');
            body.classList.remove('sidebar-open');

            // Reset toggle icon
            if (toggle) {
                const icon = toggle.querySelector('i');
                if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        }
    };

    // Run on resize
    window.addEventListener('resize', handleResponsiveSidebar);

    // Run on initial load
    handleResponsiveSidebar();

    console.log("Enhanced sidebar toggling initialized successfully");
});