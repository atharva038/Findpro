document.addEventListener("DOMContentLoaded", function () {
    // Handle language selection from dropdown items
    document.querySelectorAll('.dropdown-item[data-lang]').forEach(item => {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            const lang = this.getAttribute('data-lang');
            if (!lang) return;

            try {
                // Set the translation cookies
                const domain = window.location.hostname;
                const expDate = new Date();
                expDate.setTime(expDate.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 year

                // Set cookies for Google Translate
                document.cookie = `googtrans=/auto/${lang}; expires=${expDate.toUTCString()}; path=/; domain=${domain}`;
                document.cookie = `googtrans=/auto/${lang}; expires=${expDate.toUTCString()}; path=/;`;

                // Hide Google Translate toolbar
                document.cookie = "disableGTAutoTranslate=true; path=/";

                // Reload the page to apply translation
                window.location.reload();
            } catch (e) {
                console.error("Translation error:", e);
            }
        });
    });

    // Hide Google Translate toolbar if it appears
    function hideGoogleToolbar() {
        const gbar = document.querySelector('.goog-te-banner-frame');
        if (gbar) {
            gbar.style.display = 'none';
        }

        // Fix body positioning
        if (document.body.style.top) {
            document.body.style.top = '';
        }

        // Hide the skiptranslate div
        const skipTranslate = document.querySelector('.skiptranslate');
        if (skipTranslate) {
            skipTranslate.style.display = 'none';
        }
    }

    // Run on page load and periodically
    hideGoogleToolbar();
    setInterval(hideGoogleToolbar, 1000); // Check every second
});