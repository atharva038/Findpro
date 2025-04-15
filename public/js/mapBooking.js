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

function getCurrentLocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    const button = document.getElementById('fetch-location-btn');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Fetching...';

    navigator.geolocation.getCurrentPosition(
        function (position) {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            map.setCenter(pos);
            map.setZoom(17);
            marker.setPosition(pos);
            updateFormFields(pos.lat, pos.lng);

            button.disabled = false;
            button.innerHTML = '<i class="fas fa-location-arrow me-2"></i>Use Current Location';
        },
        function () {
            alert('Could not get your location');
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-location-arrow me-2"></i>Use Current Location';
        }
    );
}