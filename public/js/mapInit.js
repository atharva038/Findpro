/**
 * Map initialization script
 * Centralized Google Maps API loader
 */

// Global variables to track API state
window.googleMapsLoaded = false;
window.mapsCallbacks = [];
window.googleMapsApiKey = null;
window.googleMapsId = null; // This will store the Map ID needed for Advanced Markers

// Callback function for Google Maps API
function initGoogleMapsAPI() {
    console.log('Google Maps API loaded');
    window.googleMapsLoaded = true;

    // Execute any callbacks that were registered before the API loaded
    while (window.mapsCallbacks.length > 0) {
        const callback = window.mapsCallbacks.shift();
        try {
            callback();
        } catch (error) {
            console.error('Error executing maps callback:', error);
        }
    }

    // Dispatch an event that other scripts can listen for
    document.dispatchEvent(new CustomEvent('google-maps-loaded'));
}

// Register a callback to execute when maps API is loaded
window.waitForGoogleMaps = function (callback) {
    if (window.googleMapsLoaded) {
        // If API is already loaded, execute callback immediately
        callback();
    } else {
        // Otherwise, queue the callback
        window.mapsCallbacks.push(callback);
    }
};

// Update the loadGoogleMapsAPI function
window.loadGoogleMapsAPI = function (apiKey, mapId) {
    // Save these globally
    window.googleMapsApiKey = apiKey;
    window.googleMapsId = mapId || null;

    // Check if API is already loaded or being loaded
    if (document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
        console.log('Google Maps API is already being loaded');
        return;
    }

    // Create the script element with optimized loading pattern
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&callback=initGoogleMapsAPI&loading=async`;
    script.async = true;
    script.defer = true;

    // Add error handling
    script.onerror = function () {
        console.error('Failed to load Google Maps API');
    };

    // Add to document
    document.head.appendChild(script);
    console.log('Google Maps API script added to document head with async loading');
};
// Helper function to create a map with proper settings for Advanced Markers
window.createAdvancedMap = function (element, options = {}) {
    // Make sure we have required options
    const mapOptions = {
        ...options,
        mapId: window.googleMapsId || options.mapId
    };

    // If no mapId is provided, create a map without Advanced Markers capability
    if (!mapOptions.mapId) {
        console.warn('Creating map without Map ID. Advanced Markers will not work properly.');
        // If no Map ID is available, use standard maps instead
        return new google.maps.Map(element, options);
    }

    // Create and return the map with proper Map ID
    return new google.maps.Map(element, mapOptions);
};

// Initialize empty callbacks array
if (!window.mapsCallbacks) {
    window.mapsCallbacks = [];
}