mapboxgl.accessToken = 'pk.eyJ1IjoiYXRoYXJ2YTA5MyIsImEiOiJjbTk3eXd5Y3kwYXpqMmlxdG1lbTRyM2VmIn0.ReIgxdxJ9BEe6zpAmdx0vA';

document.addEventListener('DOMContentLoaded', function () {
    // Initialize map with default India coordinates
    const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [77.321, 19.1383], // Default to center of India
        zoom: 5
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add user location control
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
    }), 'top-right');

    // Initialize marker
    const marker = new mapboxgl.Marker({
        draggable: true,
        color: '#0d6efd'
    }).setLngLat([77.321, 19.1383]).addTo(map);

    // Add address input handler with suggestions
    const addressInput = document.getElementById('address-input');
    const addressInputContainer = addressInput.parentNode;
    addressInputContainer.style.position = 'relative';

    let timeoutId;
    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.className = 'address-suggestions';
    addressInputContainer.appendChild(suggestionsContainer);

    addressInput.addEventListener('input', function (e) {
        clearTimeout(timeoutId);

        timeoutId = setTimeout(() => {
            const query = e.target.value;
            if (query.length < 3) {
                suggestionsContainer.innerHTML = '';
                suggestionsContainer.style.display = 'none';
                return;
            }

            map.getContainer().classList.add('map-loading');

            fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&country=in`)
                .then(response => response.json())
                .then(data => {
                    suggestionsContainer.innerHTML = '';

                    if (data.features && data.features.length > 0) {
                        suggestionsContainer.style.display = 'block';

                        data.features.forEach(feature => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            div.textContent = feature.place_name;

                            div.addEventListener('click', () => {
                                const coords = feature.center;
                                addressInput.value = feature.place_name;
                                marker.setLngLat(coords);

                                map.flyTo({
                                    center: coords,
                                    zoom: 15,
                                    essential: true
                                });

                                updateLocation({ lng: coords[0], lat: coords[1] });
                                suggestionsContainer.style.display = 'none';
                            });

                            suggestionsContainer.appendChild(div);
                        });
                    } else {
                        suggestionsContainer.style.display = 'none';
                    }
                })
                .catch(error => {
                    console.error('Error searching address:', error);
                    showFeedback('Error searching address. Please try again.', 'error');
                    suggestionsContainer.style.display = 'none';
                })
                .finally(() => {
                    map.getContainer().classList.remove('map-loading');
                });
        }, 500);
    });
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!suggestionsContainer.contains(e.target) && e.target !== addressInput) {
            suggestionsContainer.innerHTML = '';
        }
    });


    // Function to update coordinates and address
    const updateLocation = async (lngLat) => {
        try {
            document.getElementById('latitude').value = lngLat.lat.toFixed(6);
            document.getElementById('longitude').value = lngLat.lng.toFixed(6);

            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${lngLat.lng},${lngLat.lat}.json?access_token=${mapboxgl.accessToken}`
            );
            const data = await response.json();

            if (data.features && data.features.length > 0) {
                const address = data.features[0].place_name;
                document.getElementById('selectedAddress').value = address;
                document.getElementById('address-input').value = address;
                showFeedback('Location updated successfully!', 'success');
            }
        } catch (error) {
            console.error('Error updating location:', error);
            showFeedback('Error updating location. Please try again.', 'error');
        }
    };

    // Handle marker drag
    marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        updateLocation(lngLat);
    });

    // Initialize geocoder (search box)
    const geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        marker: false,
        placeholder: 'Search your location...',
        countries: 'in',
        language: 'en-IN'
    });

    // Add geocoder to the map
    document.getElementById('geocoder').appendChild(geocoder.onAdd(map));

    // Handle search result
    geocoder.on('result', function (e) {
        const coords = e.result.geometry.coordinates;
        marker.setLngLat(coords);

        map.flyTo({
            center: coords,
            zoom: 15,
            essential: true
        });

        updateLocation({ lng: coords[0], lat: coords[1] });
    });

    // Handle search error
    geocoder.on('error', function () {
        showFeedback('Location search failed. Please try again.', 'error');
    });

    // Feedback display function
    function showFeedback(message, type) {
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = `alert alert-${type === 'error' ? 'danger' : 'success'} mt-2`;
        feedbackDiv.textContent = message;

        const mapContainer = document.getElementById('map').parentElement;
        mapContainer.insertAdjacentElement('beforeend', feedbackDiv);

        setTimeout(() => feedbackDiv.remove(), 3000);
    }

    // Add loading indicator
    map.on('load', () => {
        document.getElementById('map').classList.remove('loading');
    });


    // Add CSS for loading state and feedback
    const style = document.createElement('style');
    style.textContent = `
.address-suggestions {
            position: absolute;
            top: calc(100% + 5px);
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            max-height: 250px;
            overflow-y: auto;
            z-index: 9999;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: none;
        }

        .suggestion-item {
            padding: 12px 15px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s;
        }

        .suggestion-item:last-child {
            border-bottom: none;
        }

        .suggestion-item:hover {
            background-color: #f8f9fa;
            color: #0d6efd;
        }

        #address-input {
            padding: 12px;
            font-size: 1rem;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            width: 100%;
        }

        #address-input:focus {
            border-color: #0d6efd;
            box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
            outline: none;
        }

    #map.loading {
        opacity: 0.5;
    }
    
    .mapboxgl-ctrl-geocoder {
        width: 100% !important;
        max-width: none !important;
        box-shadow: none !important;
        border: 1px solid #dee2e6;
        border-radius: 8px;
    }

    .mapboxgl-ctrl-geocoder input {
        padding: 0.75rem !important;
    }

    .alert {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        animation: fadeIn 0.3s ease-in-out;
    }

    @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, 20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }
`;
    document.head.appendChild(style);// Update click outside handler
    document.addEventListener('click', (e) => {
        if (!suggestionsContainer.contains(e.target) && e.target !== addressInput) {
            suggestionsContainer.style.display = 'none';
        }
    });
});