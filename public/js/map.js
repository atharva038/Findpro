mapboxgl.accessToken = 'pk.eyJ1IjoiYXRoYXJ2YTA5MyIsImEiOiJjbTk3eXd5Y3kwYXpqMmlxdG1lbTRyM2VmIn0.ReIgxdxJ9BEe6zpAmdx0vA'; // Replace with your real token

function initMap(containerId, center, providers) {
    if (!mapboxgl || !Array.isArray(providers)) return;

    const map = new mapboxgl.Map({
        container: containerId,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: center,
        zoom: 12
    });

    const bounds = new mapboxgl.LngLatBounds();

    providers.forEach(provider => {
        if (!provider.coordinates || provider.coordinates.length !== 2) return;

        // Optional: custom marker element (replace with icon/image if needed)
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.width = '20px';
        el.style.height = '20px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = '#007bff';

        const marker = new mapboxgl.Marker(el)
            .setLngLat(provider.coordinates)
            .setPopup(
                new mapboxgl.Popup({ offset: 25 }).setHTML(`
                    <h5>${provider.name}</h5>
                    <p>${provider.address}</p>
                    <a href="/services/${provider.serviceId}/provider/${provider._id}" class="btn btn-sm btn-primary">View Profile</a>
                `)
            )
            .addTo(map);

        bounds.extend(provider.coordinates);
    });

    // Fit the map to show all markers
    if (providers.length > 0) {
        map.fitBounds(bounds, { padding: 50 });
    }

    // Add navigation controls (zoom, rotate, etc.)
    map.addControl(new mapboxgl.NavigationControl());
}
