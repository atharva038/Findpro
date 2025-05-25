(function () {
    // Global variables
    let map = null;
    let marker = null;
    let circle = null;
    let geocoder = null;
    let autocomplete = null;
    let autocompleteElement = null;
    let detectLocationBtn = null;
    let mapContainer = null;
    let addLocationBtn = null;
    let serviceAreaMarkers = [];

    // Initialize once DOM is ready
    document.addEventListener('DOMContentLoaded', function () {
        console.log('Provider Locations script initialized');

        // Get element references
        mapContainer = document.getElementById('location-map');
        detectLocationBtn = document.getElementById('detect-location-btn');
        addLocationBtn = document.getElementById('add-location-btn');


        // Set up travel fee toggle
        const travelFeeToggle = document.getElementById('travel-fee-toggle');
        const travelFeeOptions = document.getElementById('travel-fee-options');

        if (travelFeeToggle && travelFeeOptions) {
            travelFeeToggle.addEventListener('change', function () {
                travelFeeOptions.style.display = this.checked ? 'block' : 'none';
            });
        }

        // Set up location detection
        if (detectLocationBtn) {
            detectLocationBtn.addEventListener('click', detectCurrentLocation);
        }

        // Listen for Google Maps load event
        document.addEventListener('google-maps-loaded', initializeMap);

        // Also listen for provider data available event
        document.addEventListener('provider-data-available', function () {
            if (map && window.providerData && window.providerData.serviceAreas) {
                renderServiceAreas();
            }
        });

        // Also check if it's already loaded
        if (typeof google !== 'undefined' && google.maps) {
            initializeMap();
        }

        // Handle location section visibility changes
        setupVisibilityHandler();
    });

    // Set up visibility handler for the locations section
    function setupVisibilityHandler() {
        const locationsSection = document.getElementById('locations-section');
        if (!locationsSection) return;

        // Create a MutationObserver to watch for style changes
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.attributeName === 'style') {
                    const isVisible = locationsSection.style.display !== 'none';
                    if (isVisible && !map && typeof google !== 'undefined' && google.maps) {
                        console.log('Locations section is now visible, initializing map');
                        initializeMap();
                    } else if (isVisible && map) {
                        // Trigger a resize to ensure maps render correctly when section becomes visible
                        setTimeout(() => {
                            google.maps.event.trigger(map, 'resize');
                        }, 100);
                    }
                }
            });
        });

        // Start observing
        observer.observe(locationsSection, { attributes: true, attributeFilter: ['style'] });

        // Also check current visibility
        if (locationsSection.style.display !== 'none' && !map) {
            // Use waitForGoogleMaps from mapInit.js
            if (typeof window.waitForGoogleMaps === 'function') {
                window.waitForGoogleMaps(initializeMap);
            } else {
                // Fallback if waitForGoogleMaps is not available
                if (typeof google !== 'undefined' && google.maps) {
                    initializeMap();
                }
            }
        }
    }

    // Function to initialize the map
    function initializeMap() {
        // Don't initialize again if already done
        if (map || !mapContainer) return;

        console.log('Initializing Google Maps for provider locations');

        try {
            // Initialize geocoder
            geocoder = new google.maps.Geocoder();

            // Default location (center of India)
            const defaultLocation = { lat: 20.5937, lng: 78.9629 };
            // Create map with proper Map ID for Advanced Markers
            if (window.createAdvancedMap) {
                map = window.createAdvancedMap(mapContainer, {
                    center: defaultLocation,
                    zoom: 5,
                    mapTypeControl: false,
                    fullscreenControl: true,
                    streetViewControl: false
                });
            } else {
                // Fallback if our helper isn't available
                map = new google.maps.Map(mapContainer, {
                    center: defaultLocation,
                    zoom: 5,
                    mapTypeControl: false,
                    fullscreenControl: true,
                    streetViewControl: false
                });
            }

            // Create marker using the new AdvancedMarkerElement if available
            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                const markerView = new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: defaultLocation,
                    draggable: true,
                    title: 'Your location'
                });

                marker = markerView;

                // Add drag end event listener
                markerView.addListener('dragend', function () {
                    const position = markerView.position;
                    circle.setCenter(position);

                    // Update location input via reverse geocoding
                    const locationInput = document.getElementById('new-location');
                    if (geocoder && locationInput) {
                        geocoder.geocode({ location: position }, function (results, status) {
                            if (status === 'OK' && results[0]) {
                                locationInput.value = results[0].formatted_address;
                            }
                        });
                    }
                });
            } else {
                // Fallback to legacy Marker
                marker = new google.maps.Marker({
                    position: defaultLocation,
                    map: map,
                    draggable: true,
                    animation: google.maps.Animation.DROP
                });

                // Set up marker drag event
                google.maps.event.addListener(marker, 'dragend', function () {
                    const position = marker.getPosition();
                    circle.setCenter(position);

                    // Update location input via reverse geocoding
                    const locationInput = document.getElementById('new-location');
                    if (geocoder && locationInput) {
                        geocoder.geocode({ location: { lat: position.lat(), lng: position.lng() } }, function (results, status) {
                            if (status === 'OK' && results[0]) {
                                locationInput.value = results[0].formatted_address;
                            }
                        });
                    }
                });
            }

            // Create circle to represent service area
            circle = new google.maps.Circle({
                strokeColor: "#0d6efd",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#0d6efd",
                fillOpacity: 0.15,
                map: map,
                center: defaultLocation,
                radius: 10000 // 10km in meters
            });

            // Initialize place autocomplete
            const locationInput = document.getElementById('new-location');
            if (locationInput) {
                if (google.maps.places.PlaceAutocompleteElement) {
                    // Use the new PlaceAutocompleteElement
                    try {
                        // Remove any existing autocomplete elements first
                        const existingAutocomplete = document.querySelector('gmpx-place-autocomplete');
                        if (existingAutocomplete) {
                            existingAutocomplete.remove();
                        }

                        // Create container for autocomplete element
                        const autocompleteContainer = document.createElement('div');
                        autocompleteContainer.className = 'autocomplete-container';
                        locationInput.parentNode.appendChild(autocompleteContainer);

                        // Hide the original input temporarily
                        const originalInputDisplay = locationInput.style.display;
                        locationInput.style.display = 'none';

                        // Create the new autocomplete element
                        autocompleteElement = new google.maps.places.PlaceAutocompleteElement({
                            inputElement: locationInput,
                            componentRestrictions: { country: 'in' },
                            types: ['geocode']
                        });

                        autocompleteContainer.appendChild(autocompleteElement);

                        // Add event listener for place selection
                        autocompleteElement.addEventListener('gmp-placeselect', function (event) {
                            const place = event.detail.place;
                            if (place.geometry) {
                                // Update map and marker
                                const position = place.geometry.location;
                                map.setCenter(position);
                                map.setZoom(13);

                                if (marker.position) {
                                    // For AdvancedMarkerElement
                                    marker.position = position;
                                } else if (marker.setPosition) {
                                    // For legacy Marker
                                    marker.setPosition(position);
                                }

                                circle.setCenter(position);

                                // Update the original input with the selected place's formatted address
                                locationInput.value = place.formattedAddress || '';
                            }
                        });
                    } catch (e) {
                        console.error('Error creating PlaceAutocompleteElement:', e);
                        // Fall back to legacy Autocomplete
                        setupLegacyAutocomplete(locationInput);
                    }
                } else {
                    // Fall back to legacy Autocomplete
                    setupLegacyAutocomplete(locationInput);
                }
            }

            // Set up radius select
            const radiusSelect = document.getElementById('radius-select');
            if (radiusSelect) {
                radiusSelect.addEventListener('change', function () {
                    const radius = parseInt(this.value) * 1000; // Convert to meters
                    circle.setRadius(radius);
                });

                // Set initial radius
                const initialRadius = parseInt(radiusSelect.value) * 1000;
                circle.setRadius(initialRadius);
            }

            // Set up add location button
            if (addLocationBtn) {
                addLocationBtn.addEventListener('click', function () {
                    addLocation();
                });
            }

            // Set up location removal buttons
            const removeLocationBtns = document.querySelectorAll('.btn-remove-location');
            removeLocationBtns.forEach(btn => {
                btn.addEventListener('click', function () {
                    const locationId = this.dataset.id;
                    removeLocation(locationId, this);
                });
            });

            // Set up save location settings button
            const saveLocationSettingsBtn = document.getElementById('save-location-settings');
            if (saveLocationSettingsBtn) {
                saveLocationSettingsBtn.addEventListener('click', saveTravelFeeSettings);
            }

            // If we have service areas, show them on the map
            if (window.providerData && window.providerData.serviceAreas) {
                renderServiceAreas();
            }

            // Trigger a resize after initialization
            setTimeout(() => {
                google.maps.event.trigger(map, 'resize');
            }, 100);

            console.log('Map initialized successfully');
        } catch (error) {
            console.error('Error initializing map:', error);
            if (mapContainer) {
                mapContainer.innerHTML = `
                    <div class="alert alert-danger">
                        <strong>Error:</strong> Could not initialize Google Maps. 
                        <br><small>${error.message}</small>
                    </div>
                `;
            }
        }
    }

    // Setup legacy autocomplete as fallback
    function setupLegacyAutocomplete(inputElement) {
        if (!inputElement.placeholder) {
            inputElement.placeholder = "Enter a location or use 'Detect My Location'";
        }
        autocomplete = new google.maps.places.Autocomplete(inputElement, {
            types: ['geocode'],
            componentRestrictions: { country: 'in' }
        });

        autocomplete.addListener('place_changed', function () {
            const place = autocomplete.getPlace();
            if (!place.geometry) return;

            // Update map and marker
            map.setCenter(place.geometry.location);
            map.setZoom(13);

            if (marker.position) {
                // For AdvancedMarkerElement
                marker.position = place.geometry.location;
            } else if (marker.setPosition) {
                // For legacy Marker
                marker.setPosition(place.geometry.location);
            }

            circle.setCenter(place.geometry.location);
        });
    }

    // Function to render service areas on the map
    function renderServiceAreas() {
        if (!map || !window.providerData || !window.providerData.serviceAreas) return;

        // Clear existing markers first
        serviceAreaMarkers.forEach(item => {
            if (item.marker) {
                if (item.marker.map) {
                    item.marker.setMap(null);
                }
            }
            if (item.circle) {
                if (item.circle.map) {
                    item.circle.setMap(null);
                }
            }
        });
        serviceAreaMarkers = [];

        const bounds = new google.maps.LatLngBounds();
        let hasValidAreas = false;

        window.providerData.serviceAreas.forEach(area => {
            if (!area.lat || !area.lng) return;

            hasValidAreas = true;
            const areaPosition = { lat: area.lat, lng: area.lng };

            // Add marker for each service area
            let areaMarker;

            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                // Use new AdvancedMarkerElement
                areaMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: areaPosition,
                    title: area.name
                });
            } else {
                // Fallback to legacy Marker
                areaMarker = new google.maps.Marker({
                    position: areaPosition,
                    map: map,
                    title: area.name,
                    icon: {
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    }
                });
            }

            // Add circle for service area
            const areaCircle = new google.maps.Circle({
                strokeColor: "#3498db",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#3498db",
                fillOpacity: 0.1,
                map: map,
                center: areaPosition,
                radius: area.radius * 1000 // Convert km to meters
            });

            // Store references to clean up later
            serviceAreaMarkers.push({
                marker: areaMarker,
                circle: areaCircle
            });

            bounds.extend(areaPosition);
        });

        if (hasValidAreas) {
            map.fitBounds(bounds);
        }
    }

    // Function to add a location
    function addLocation() {
        const locationInput = document.getElementById('new-location');
        const radiusSelect = document.getElementById('radius-select');

        if (!locationInput || !locationInput.value || !radiusSelect) {
            showToast('error', 'Please enter a location and select a radius');
            return;
        }

        // Disable the button to prevent multiple clicks
        addLocationBtn.disabled = true;
        addLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Adding...';

        // Get location coordinates - either from stored data attributes or from geocoding
        let lat = locationInput.dataset.lat ? parseFloat(locationInput.dataset.lat) : null;
        let lng = locationInput.dataset.lng ? parseFloat(locationInput.dataset.lng) : null;
        const radius = parseInt(radiusSelect.value);
        const address = locationInput.value;

        const processLocationData = (position) => {
            // Send to server
            fetch('/dashboard/api/provider/locations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: address,  // Add this line - use the address as the name
                    address: address,
                    lat: position.lat,
                    lng: position.lng,
                    radius: radius
                })
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        showToast('success', 'Location added successfully');
                        updateLocationsList(data, position);

                        // Clear form
                        locationInput.value = '';
                        locationInput.dataset.lat = '';
                        locationInput.dataset.lng = '';
                    } else {
                        throw new Error(data.message || 'Failed to add location');
                    }
                })
                .catch(error => {
                    console.error('Error adding location:', error);
                    showToast('error', error.message || 'Error adding location');
                })
                .finally(() => {
                    // Reset button
                    addLocationBtn.disabled = false;
                    addLocationBtn.innerHTML = 'Add';
                });
        };

        // If we already have coordinates (from detect location), use them directly
        if (lat && lng) {
            processLocationData({ lat, lng });
        }
        // Otherwise geocode the address
        else if (geocoder) {
            geocoder.geocode({ address: address })
                .then(response => {
                    if (response.results && response.results[0]) {
                        const position = {
                            lat: response.results[0].geometry.location.lat(),
                            lng: response.results[0].geometry.location.lng()
                        };
                        processLocationData(position);
                    } else {
                        throw new Error('No results found for this location');
                    }
                })
                .catch(error => {
                    console.error('Geocoding error:', error);
                    addLocationBtn.disabled = false;
                    addLocationBtn.innerHTML = 'Add';
                    showToast('error', 'Could not find coordinates for this location');
                });
        } else {
            addLocationBtn.disabled = false;
            addLocationBtn.innerHTML = 'Add';
            showToast('error', 'Geocoding service not available');
        }
    }

    // Function to update the locations list after adding a new one
    function updateLocationsList(data, position) {
        const existingAreas = document.getElementById('existing-service-areas');
        if (!existingAreas) return;

        // If this is the first location, clear the "no locations" message
        if (existingAreas.querySelector('.alert')) {
            existingAreas.innerHTML = '<div class="location-tags"></div>';
        }

        // Get or create the location tags container
        let locationTags = existingAreas.querySelector('.location-tags');
        if (!locationTags) {
            locationTags = document.createElement('div');
            locationTags.className = 'location-tags';
            existingAreas.appendChild(locationTags);
        }

        // Create the new location tag
        const locationTag = document.createElement('div');
        locationTag.className = 'location-tag';
        locationTag.dataset.id = data.locationId;
        locationTag.dataset.lat = position.lat;
        locationTag.dataset.lng = position.lng;
        locationTag.dataset.radius = document.getElementById('radius-select').value;
        locationTag.dataset.name = data.name || document.getElementById('new-location').value;

        locationTag.innerHTML = `
            ${data.name || document.getElementById('new-location').value}
            <button class="btn-remove-location" data-id="${data.locationId}">
                <i class="fas fa-times-circle"></i>
            </button>
        `;

        locationTags.appendChild(locationTag);

        // Add event listener to the remove button
        const removeBtn = locationTag.querySelector('.btn-remove-location');
        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                const locationId = this.dataset.id;
                removeLocation(locationId, this);
            });
        }

        // Also add to the map
        if (map && position) {
            let areaMarker;

            if (google.maps.marker && google.maps.marker.AdvancedMarkerElement) {
                // Use new AdvancedMarkerElement
                areaMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: map,
                    position: position,
                    title: data.name || document.getElementById('new-location').value
                });
            } else {
                // Fallback to legacy Marker
                areaMarker = new google.maps.Marker({
                    position: position,
                    map: map,
                    title: data.name || document.getElementById('new-location').value,
                    icon: {
                        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    }
                });
            }

            const radius = parseInt(document.getElementById('radius-select').value) * 1000;
            const areaCircle = new google.maps.Circle({
                strokeColor: "#3498db",
                strokeOpacity: 0.8,
                strokeWeight: 2,
                fillColor: "#3498db",
                fillOpacity: 0.1,
                map: map,
                center: position,
                radius: radius
            });

            // Store references to clean up later
            serviceAreaMarkers.push({
                marker: areaMarker,
                circle: areaCircle
            });
        }

        // Add this area to the provider data so it's available for re-renders
        if (!window.providerData) {
            window.providerData = { serviceAreas: [] };
        } else if (!window.providerData.serviceAreas) {
            window.providerData.serviceAreas = [];
        }

        window.providerData.serviceAreas.push({
            _id: data.locationId,
            name: data.name || document.getElementById('new-location').value,
            lat: position.lat,
            lng: position.lng,
            radius: parseInt(document.getElementById('radius-select').value)
        });
    }

    // In the removeLocation function, update the fetch URL:

    function removeLocation(locationId, buttonElement) {
        if (!locationId) {
            showToast('error', 'Invalid location ID');
            return;
        }

        if (confirm('Are you sure you want to remove this location?')) {
            // Show loading state
            buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            buttonElement.disabled = true;

            // Fix the URL to match your backend route structure
            fetch(`/dashboard/api/provider/locations/${locationId}`, {  // Changed from /api/provider/locations/
                method: 'DELETE'
            })
                .then(response => {
                    // Add proper error handling for non-JSON responses
                    if (!response.ok) {
                        if (response.headers.get('content-type')?.includes('text/html')) {
                            return Promise.reject(new Error(`Server returned status ${response.status}`));
                        }
                    }
                    return response.json();
                })
                .then(data => {
                    if (data.success) {
                        // Remove from UI
                        const locationTag = buttonElement.closest('.location-tag');
                        if (locationTag) {
                            locationTag.remove();
                        }

                        // Remove from provider data
                        if (window.providerData && window.providerData.serviceAreas) {
                            window.providerData.serviceAreas = window.providerData.serviceAreas.filter(
                                area => area._id !== locationId
                            );
                        }

                        // Re-render service areas
                        renderServiceAreas();

                        // Check if we have any locations left
                        const locationTags = document.querySelector('.location-tags');
                        if (locationTags && !locationTags.children.length) {
                            const existingAreas = document.getElementById('existing-service-areas');
                            if (existingAreas) {
                                existingAreas.innerHTML = `
                            <div class="alert alert-info">
                                <i class="fas fa-info-circle me-2"></i>
                                You haven't added any specific service areas yet. Add locations below to appear in those areas.
                            </div>
                        `;
                            }
                        }

                        showToast('success', 'Location removed successfully');
                    } else {
                        throw new Error(data.message || 'Failed to remove location');
                    }
                })
                .catch(error => {
                    console.error('Error removing location:', error);
                    showToast('error', error.message || 'Failed to remove location');

                    // Reset button
                    buttonElement.innerHTML = '<i class="fas fa-times-circle"></i>';
                    buttonElement.disabled = false;
                });
        }
    }

    // Function to save travel fee settings
    function saveTravelFeeSettings() {
        const travelFeeToggle = document.getElementById('travel-fee-toggle');
        const travelFeeAmount = document.getElementById('travel-fee-amount');

        if (!travelFeeToggle || !travelFeeAmount) {
            showToast('error', 'Travel fee form elements not found');
            return;
        }

        const travelFeeEnabled = travelFeeToggle.checked;
        const amount = parseFloat(travelFeeAmount.value);

        if (travelFeeEnabled && (isNaN(amount) || amount <= 0)) {
            showToast('error', 'Please enter a valid travel fee amount');
            return;
        }

        // Show loading state
        const button = document.getElementById('save-location-settings');
        button.disabled = true;
        button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        // Save to server
        fetch('/profile/travel-fee', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                enabled: travelFeeEnabled,
                amount: amount
            })
        })
            .then(response => {
                // Check if response is OK before parsing JSON
                if (!response.ok) {
                    if (response.headers.get('content-type')?.includes('text/html')) {
                        // Handle HTML response (likely an error page)
                        return Promise.reject(new Error(`Server returned status ${response.status}`));
                    }
                    return response.json().then(data => Promise.reject(new Error(data.message || `Server returned status ${response.status}`)));
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Update provider data
                    if (window.providerData) {
                        window.providerData.travelFeeEnabled = travelFeeEnabled;
                        window.providerData.travelFeeAmount = amount;
                    }

                    showToast('success', 'Travel fee settings saved successfully');
                } else {
                    throw new Error(data.message || 'Failed to save travel fee settings');
                }
            })
            .catch(error => {
                console.error('Error saving travel fee settings:', error);
                showToast('error', error.message || 'Failed to save travel fee settings');
            })
            .finally(() => {
                // Reset button
                button.disabled = false;
                button.innerHTML = 'Save Fee Settings';
            });
    }

    // Function to detect current location
    function detectCurrentLocation() {
        // Check if geolocation is available
        if (navigator.geolocation) {
            // Show loading state
            detectLocationBtn.disabled = true;
            detectLocationBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Detecting...';

            navigator.geolocation.getCurrentPosition(async function (position) {
                try {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const locationInput = document.getElementById('new-location');

                    // Update map to show current position
                    if (map) {
                        const currentLocation = { lat, lng };
                        map.setCenter(currentLocation);
                        map.setZoom(14);

                        // Add or update marker
                        if (marker) {
                            if (marker.setMap) marker.setMap(null);
                        }

                        marker = new google.maps.Marker({
                            position: currentLocation,
                            map: map,
                            animation: google.maps.Animation.DROP
                        });

                        // Add or update circle for radius
                        const radiusSelect = document.getElementById('radius-select');
                        const radius = radiusSelect ? parseInt(radiusSelect.value) * 1000 : 10000; // Convert to meters

                        if (circle) {
                            if (circle.setMap) circle.setMap(null);
                        }

                        circle = new google.maps.Circle({
                            strokeColor: '#FF6347',
                            strokeOpacity: 0.8,
                            strokeWeight: 2,
                            fillColor: '#FF6347',
                            fillOpacity: 0.2,
                            map: map,
                            center: currentLocation,
                            radius: radius
                        });

                        // Reverse geocode to get address
                        if (geocoder) {
                            console.log("Geocoding current location:", currentLocation);
                            const response = await geocoder.geocode({ location: currentLocation });

                            if (response && response.results && response.results[0]) {
                                const address = response.results[0].formatted_address;
                                console.log("Found address:", address);

                                // Update the location input field with the detected address
                                // Make the original input visible and update its value
                                if (locationInput) {
                                    // If using the new autocomplete element, might need to handle differently
                                    if (autocompleteElement) {
                                        // Display the original input again if it was hidden
                                        locationInput.style.display = '';

                                        // For Google's autocomplete, we need to force a value update
                                        locationInput.value = address;

                                        // Also update any container element that might be showing the value
                                        const autocompleteContainer = document.querySelector('.autocomplete-container');
                                        if (autocompleteContainer) {
                                            const visibleInput = autocompleteContainer.querySelector('input');
                                            if (visibleInput) {
                                                visibleInput.value = address;
                                            }
                                        }
                                    } else {
                                        // Simple case - just update the input value
                                        locationInput.value = address;
                                    }

                                    // Store the coordinates for later use when adding location
                                    locationInput.dataset.lat = lat;
                                    locationInput.dataset.lng = lng;
                                }
                            } else {
                                console.warn("No address found in geocoding response:", response);
                                throw new Error('No address found for this location');
                            }
                        }
                    }

                    showToast('success', 'Current location detected successfully');
                } catch (error) {
                    console.error('Error getting address:', error);
                    showToast('error', 'Failed to get address for current location: ' + error.message);
                } finally {
                    // Reset button state
                    detectLocationBtn.disabled = false;
                    detectLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Detect My Location';
                }
            }, function (error) {
                console.error('Geolocation error:', error);
                detectLocationBtn.disabled = false;
                detectLocationBtn.innerHTML = '<i class="fas fa-location-arrow"></i> Detect My Location';

                let errorMessage = 'Failed to detect your location';

                // More specific error messages based on the error code
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = 'Location access denied. Please allow location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage = 'The request to get user location timed out.';
                        break;
                }

                showToast('error', errorMessage);
            }, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        } else {
            showToast('error', 'Geolocation is not supported by this browser');
        }
    }

    // Utility function to show a toast notification
    function showToast(type, message) {
        // Create toast container if it doesn't exist
        let toastContainer = document.querySelector('.toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
            document.body.appendChild(toastContainer);
        }

        // Create the toast
        const toastId = 'toast-' + Date.now();
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-white bg-${type === 'success' ? 'success' : 'danger'} border-0`;
        toast.id = toastId;
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

        // Initialize and show the toast
        if (typeof bootstrap !== 'undefined') {
            const bsToast = new bootstrap.Toast(toast, {
                autohide: true,
                delay: 3000
            });
            bsToast.show();
        } else {
            // Fallback if Bootstrap is not available
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }
})();