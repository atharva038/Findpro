let map;
let marker;
let autocomplete;

// Initialize map when document is loaded
document.addEventListener('DOMContentLoaded', function () {
    initMap();
});

function initMap() {
    const defaultLocation = { lat: 18.4088, lng: 76.5604 }; // Nanded coordinates
    const mapElement = document.getElementById('map');

    if (!mapElement) return;

    // Create map
    map = new google.maps.Map(mapElement, {
        center: defaultLocation,
        zoom: 13,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        mapTypeControl: true,
        streetViewControl: false
    });

    // Create marker
    marker = new google.maps.Marker({
        map: map,
        position: defaultLocation,
        draggable: true,
        animation: google.maps.Animation.DROP
    });

    // Initialize autocomplete
    const input = document.getElementById('address-input');
    autocomplete = new google.maps.places.Autocomplete(input, {
        componentRestrictions: { country: 'in' }
    });
    autocomplete.bindTo('bounds', map);

    // Add event listeners
    google.maps.event.addListener(marker, 'dragend', function () {
        const position = marker.getPosition();
        updateFormFields(position.lat(), position.lng());
    });

    autocomplete.addListener('place_changed', function () {
        const place = autocomplete.getPlace();
        if (!place.geometry) return;

        // Update map and marker
        map.setCenter(place.geometry.location);
        map.setZoom(17);
        marker.setPosition(place.geometry.location);
        updateFormFields(
            place.geometry.location.lat(),
            place.geometry.location.lng()
        );
    });

    // Add current location button handler
    document.getElementById('fetch-location-btn').addEventListener('click', getCurrentLocation);
}

function updateFormFields(lat, lng) {
    document.getElementById('latitude').value = lat;
    document.getElementById('longitude').value = lng;
}

async function getCurrentLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }

    const button = document.getElementById('fetch-location-btn');
    const addressInput = document.getElementById('address-input');

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Fetching...';

        // First check if we have permission
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });

        if (permissionStatus.state === 'denied') {
            showError('Location permission is denied. Please enable location access in your browser settings.');
            return;
        }

        // Improved geolocation options
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        };

        // Wrap getCurrentPosition in a promise
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });

        const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };

        // Verify location using reverse geocoding
        const response = await axios.get('/api/location/current-location', {
            params: pos
        });

        if (response.data.status === 'success') {
            // Update map and marker
            map.setCenter(pos);
            map.setZoom(17);
            marker.setPosition(pos);
            updateFormFields(pos.lat, pos.lng);

            // Update address inputs
            addressInput.value = response.data.data.formatted_address;
            const detailedAddress = document.getElementById('detailed-address');
            if (detailedAddress) {
                detailedAddress.value = response.data.data.formatted_address;
            }
        } else {
            throw new Error('Failed to verify location');
        }
    } catch (error) {
        console.error('Location Error:', error);

        let errorMessage = 'Could not get your location. ';
        if (error.code) {
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Please allow location access in your browser settings.';
                    // Show instructions for enabling location
                    showLocationEnableInstructions();
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out.';
                    break;
                default:
                    errorMessage += error.message || 'Unknown error occurred.';
            }
        }
        showError(errorMessage);
    } finally {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-location-arrow me-2"></i>Use Current Location';
    }
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.getElementById('map').parentElement.insertBefore(errorDiv, document.getElementById('map'));

    // Auto remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

function showLocationEnableInstructions() {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    let instructions = '';

    if (isMobile) {
        instructions = `
            <div class="alert alert-info mt-2">
                <h6>How to enable location:</h6>
                <ol class="mb-0">
                    <li>Go to your device Settings</li>
                    <li>Find Browser settings</li>
                    <li>Look for Site Settings or Permissions</li>
                    <li>Enable Location access</li>
                    <li>Refresh this page</li>
                </ol>
            </div>
        `;
    } else {
        instructions = `
            <div class="alert alert-info mt-2">
                <h6>How to enable location:</h6>
                <ol class="mb-0">
                    <li>Click the lock/info icon in your browser's address bar</li>
                    <li>Find Location permission</li>
                    <li>Allow access</li>
                    <li>Refresh this page</li>
                </ol>
            </div>
        `;
    }

    const instructionsDiv = document.createElement('div');
    instructionsDiv.innerHTML = instructions;
    document.getElementById('map').parentElement.insertBefore(instructionsDiv, document.getElementById('map'));
}