// script.js - ZoneAware AI frontend definitivo
const CRITICAL_LAT = 41.395;
const CRITICAL_LON = 2.180;
const CRITICAL_RADIUS = 300;

// Colores únicos por drone
const droneColors = {
    "DR-001": "blue",
    "DR-002": "green",
    "DR-003": "purple"
};

const map = L.map("map").setView([CRITICAL_LAT, CRITICAL_LON], 15);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Zona crítica
L.circle([CRITICAL_LAT, CRITICAL_LON], {
    radius: CRITICAL_RADIUS,
    color: "red",
    fillColor: "red",
    fillOpacity: 0.25
}).addTo(map);

const markers = {};

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; 
    const toRad = deg => deg * Math.PI / 180;
    lat1 = toRad(lat1); lon1 = toRad(lon1);
    lat2 = toRad(lat2); lon2 = toRad(lon2);
    const dlat = lat2 - lat1;
    const dlon = lon2 - lon1;
    const a = Math.sin(dlat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function fetchDrones() {
    try {
        const response = await fetch("http://127.0.0.1:8000/drones");
        const drones = await response.json();
        const tableBody = document.querySelector("#droneTable tbody");
        tableBody.innerHTML = "";

        drones.forEach(drone => {
            const distance = calculateDistance(drone.lat, drone.lon, CRITICAL_LAT, CRITICAL_LON);
            const insideCriticalZone = distance < CRITICAL_RADIUS;
            const battery = Math.round(drone.battery);

            const baseColor = droneColors[drone.id] || "lime";
            let markerColor = battery === 0 ? "darkred" : baseColor; // SAFE o OFFLINE

            // Crear o actualizar marker
            if (!markers[drone.id]) {
                markers[drone.id] = L.circleMarker([drone.lat, drone.lon], {
                    radius: 8,
                    color: markerColor,
                    fillColor: markerColor,
                    fillOpacity: 0.8
                })
                .bindPopup(`<b>${drone.id}</b>`)
                .bindTooltip(drone.id, {permanent: true, direction: "top", className: "drone-label"})
                .addTo(map);
            } else {
                // Actualizamos posición, pero no color base
                markers[drone.id].setLatLng([drone.lat, drone.lon]);
            }

            // Tabla y barra de batería
            let batteryClass = battery > 50 ? "battery-high" :
                               battery > 20 ? "battery-medium" : "battery-low";

            let statusText = "SAFE";
            let statusClass = "safe";
            let rowClass = "";
            if (battery === 0) { statusText = "OFFLINE"; statusClass = "alert"; }
            else if (insideCriticalZone) { statusText = "ALERT"; statusClass = "alert"; rowClass="alert-row"; }

            const row = document.createElement("tr");
            row.className = rowClass;
            row.innerHTML = `
                <td>${drone.id}</td>
                <td>${drone.lat.toFixed(6)}</td>
                <td>${drone.lon.toFixed(6)}</td>
                <td>${Math.round(distance)}</td>
                <td>
                    <div class="battery-bar">
                        <div class="battery-fill ${batteryClass}" data-percent="${battery}" style="width:${battery}%"></div>
                    </div>
                </td>
                <td class="${statusClass}">${statusText}</td>
            `;
            tableBody.appendChild(row);

            // Marker pulsante y glow si ALERT
            const marker = markers[drone.id];
            if (insideCriticalZone && battery > 0) {
                clearInterval(marker.pulseInterval);
                let grow = 0;
                marker.pulseInterval = setInterval(() => {
                    grow = grow === 0 ? 1 : 0;
                    marker.setRadius(grow ? 12 : 8);
                }, 500);
                if (marker.getElement()) marker.getElement().classList.add("marker-glow");
            } else {
                clearInterval(marker.pulseInterval);
                marker.setRadius(8);
                if (marker.getElement()) marker.getElement().classList.remove("marker-glow");
            }
        });

        // FitBounds seguro
        const bounds = Object.values(markers)
            .map(m => m.getLatLng())
            .filter(latlng => !isNaN(latlng.lat) && !isNaN(latlng.lng));
        if (bounds.length > 0) map.fitBounds(bounds, {padding: [50,50]});

    } catch (error) {
        console.error("Error fetching drones:", error);
    }
}

setInterval(fetchDrones, 2000);
fetchDrones();