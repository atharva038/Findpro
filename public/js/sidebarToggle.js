document.addEventListener("DOMContentLoaded", function () {
    // Check if elements exist
    if (!sidebarToggle || !sidebar) {
        console.error("Sidebar elements not found:", {
            toggle: sidebarToggle,
            sidebar: sidebar
        });
        return;
    }

    // Toggle sidebar
    sidebarToggle.addEventListener("click", function (e) {
        e.stopPropagation(); // Prevent event bubbling
        sidebar.classList.toggle("active");
        const icon = this.querySelector("i");
        if (icon) {
            icon.classList.toggle("fa-bars");
            icon.classList.toggle("fa-times");
        }
    });

    // Close sidebar when clicking outside
    document.addEventListener("click", function (event) {
        if (!sidebar || !sidebarToggle) return;

        const isClickInside =
            sidebar.contains(event.target) ||
            sidebarToggle.contains(event.target);

        if (!isClickInside && sidebar.classList.contains("active")) {
            sidebar.classList.remove("active");
            const icon = sidebarToggle.querySelector("i");
            if (icon) {
                icon.classList.remove("fa-times");
                icon.classList.add("fa-bars");
            }
        }
    });

    // Close sidebar on window resize if wider than mobile breakpoint
    window.addEventListener("resize", function () {
        if (!sidebar || !sidebarToggle) return;

        if (window.innerWidth > 768 && sidebar.classList.contains("active")) {
            sidebar.classList.remove("active");
            const icon = sidebarToggle.querySelector("i");
            if (icon) {
                icon.classList.remove("fa-times");
                icon.classList.add("fa-bars");
            }
        }
    });
});