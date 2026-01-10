// =====================================================
// Database Wajib Pajak Daerah - SIDRAP
// Main Application JavaScript
// =====================================================

// Data Storage
let wajibPajak = [];
let users = [];
let currentUser = null;
let wpMap, blockMap;
let currentMapType = 'street';
let blockCurrentMapType = 'street';
let realisasiPajak = [];
let taxChart, realisasiChart, persenChart;

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    await loadDataFromJSON();
    
    // Check for existing session
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
    }
    
    // Setup event listeners
    setupEventListeners();
}

async function loadDataFromJSON() {
    try {
        // Load data.json
        const response = await fetch('data.json');
        const data = await response.json();
        
        wajibPajak = data.wajibPajak || [];
        users = data.users || [];
        realisasiPajak = data.realisasiPajak || [];
        
        // Try to load from localStorage as backup
        const localWP = localStorage.getItem('wajibPajak');
        const localUsers = localStorage.getItem('users');
        const localRealisasi = localStorage.getItem('realisasiPajak');
        
        if (localWP) wajibPajak = JSON.parse(localWP);
        if (localUsers) users = JSON.parse(localUsers);
        if (localRealisasi) realisasiPajak = JSON.parse(localRealisasi);
        
        console.log('Data loaded successfully');
        console.log('Wajib Pajak:', wajibPajak.length);
        console.log('Users:', users.length);
        console.log('Realisasi:', realisasiPajak.length);
        
    } catch (error) {
        console.error('Error loading data:', error);
        // Fallback to localStorage
        wajibPajak = JSON.parse(localStorage.getItem('wajibPajak')) || [];
        users = JSON.parse(localStorage.getItem('users')) || [
            { id: 1, username: 'admin', password: 'admin123', nama: 'Administrator', role: 'admin' },
            { id: 2, username: 'petugas', password: 'petugas123', nama: 'Petugas Pajak', role: 'petugas' }
        ];
        realisasiPajak = JSON.parse(localStorage.getItem('realisasiPajak')) || [];
    }
}

function setupEventListeners() {
    // Login Form
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    
    // WP Form
    document.getElementById('wpForm').addEventListener('submit', handleWPSubmit);
    
    // Add User Form
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    
    // Realisasi Forms
    document.getElementById('realisasiForm').addEventListener('submit', handleRealisasiSubmit);
    document.getElementById('editRealisasiForm').addEventListener('submit', handleEditRealisasiSubmit);
    
    // Search and Filter
    document.getElementById('searchWp').addEventListener('keyup', searchWp);
    document.getElementById('filterPajak').addEventListener('change', filterWp);
    
    // Realisasi Year Filter
    document.getElementById('realisasiTahun').addEventListener('change', updateRealisasi);
}

// =====================================================
// AUTHENTICATION
// =====================================================

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        showMainApp();
        showNotification('Berhasil', 'Login berhasil!', 'success');
    } else {
        showNotification('Gagal', 'Username atau password salah!', 'error');
    }
}

function logout() {
    Swal.fire({
        title: 'Konfirmasi',
        text: 'Apakah Anda yakin ingin logout?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Logout',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            currentUser = null;
            sessionStorage.removeItem('currentUser');
            document.getElementById('mainApp').classList.add('hidden');
            document.getElementById('loginPage').classList.remove('hidden');
        }
    });
}

function showMainApp() {
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    showPage('dashboard');
    updateDashboard();
    generateYears();
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(page) {
    document.querySelectorAll('[id^="page-"]').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

    document.getElementById(`page-${page}`).classList.remove('hidden');
    document.getElementById(`nav-${page}`).classList.add('active');

    if (page === 'data-wp') renderWPTable();
    if (page === 'users') renderUserList();
    if (page === 'dashboard') updateDashboard();
    if (page === 'realisasi') updateRealisasi();
    if (page === 'peta-blok') {
        setTimeout(() => {
            initBlockMap();
            updateBlockMapButtonStates();
        }, 100);
    }
}

// =====================================================
// TAX FIELDS TOGGLE
// =====================================================

function showTaxFields(taxType) {
    const fieldId = `fields-${taxType}`;
    const isChecked = document.querySelector(`input[value="${taxType}"]`).checked;
    const field = document.getElementById(fieldId);
    
    if (isChecked) {
        field.classList.remove('hidden');
    } else {
        field.classList.add('hidden');
    }
}

// =====================================================
// MAP FUNCTIONS - INPUT PAGE
// =====================================================

function initWPMaps() {
    if (wpMap) return;

    wpMap = L.map('wpMap').setView([-3.9848, 120.2008], 13);

    // Street View Layer
    streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    });

    // Satellite View Layer
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    });

    streetLayer.addTo(wpMap);
    currentMapType = 'street';

    wpMap.markers = [];
    
    wpMap.on('click', function(e) {
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);

        document.getElementById('latitude').value = lat;
        document.getElementById('longitude').value = lng;

        wpMap.markers.forEach(m => wpMap.removeLayer(m));
        wpMap.markers = [];

        const marker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(wpMap);
        marker.bindPopup(`
            <div style="text-align: center;">
                <strong>Lokasi Wajib Pajak</strong><br>
                <span style="color: #666; font-size: 12px;">
                    Lat: ${lat}, Lng: ${lng}
                </span>
            </div>
        `).openPopup();

        wpMap.markers.push(marker);
        document.getElementById('addressFromCoord').value = `Koordinat: ${lat}, ${lng} - ${getLocationDescription(e.latlng)}`;
    });

    updateMapButtonStates();
}

function switchMapView(type) {
    if (!wpMap) return;

    if (type === 'satellite') {
        wpMap.removeLayer(streetLayer);
        satelliteLayer.addTo(wpMap);
        currentMapType = 'satellite';
    } else {
        wpMap.removeLayer(satelliteLayer);
        streetLayer.addTo(wpMap);
        currentMapType = 'street';
    }

    updateMapButtonStates();
}

function updateMapButtonStates() {
    const streetBtn = document.getElementById('btnStreetView');
    const satelliteBtn = document.getElementById('btnSatelliteView');

    if (currentMapType === 'street') {
        streetBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded-lg text-sm flex items-center';
        satelliteBtn.className = 'px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm flex items-center';
    } else {
        streetBtn.className = 'px-3 py-1 bg-gray-300 text-gray-700 rounded-lg text-sm flex items-center';
        satelliteBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded-lg text-sm flex items-center';
    }
}

function clearMapLocation() {
    document.getElementById('latitude').value = '';
    document.getElementById('longitude').value = '';
    document.getElementById('addressFromCoord').value = '';

    if (wpMap && wpMap.markers) {
        wpMap.markers.forEach(m => wpMap.removeLayer(m));
        wpMap.markers = [];
    }
}

function getCurrentLocation() {
    if (navigator.geolocation) {
        Swal.fire({
            title: 'Mendapatkan Lokasi',
            text: 'Mohon tunggu...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            document.getElementById('latitude').value = lat.toFixed(6);
            document.getElementById('longitude').value = lng.toFixed(6);
            document.getElementById('addressFromCoord').value = `Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)} - Lokasi Saat Ini (GPS)`;

            Swal.close();
            wpMap.setView([lat, lng], 16);

            if (wpMap.markers) {
                wpMap.markers.forEach(m => wpMap.removeLayer(m));
                wpMap.markers = [];
            }

            const marker = L.marker([lat, lng]).addTo(wpMap);
            marker.bindPopup(`
                <div style="text-align: center;">
                    <strong>Lokasi Anda</strong><br>
                    <span style="color: #666; font-size: 12px;">
                        Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}
                    </span>
                </div>
            `).openPopup();

            wpMap.markers.push(marker);
            showNotification('Berhasil', 'Lokasi berhasil ditentukan!', 'success');
        }, (error) => {
            Swal.fire('Gagal', 'Tidak dapat mendapatkan lokasi. Pastikan GPS aktif.', 'error');
        });
    } else {
        showNotification('Gagal', 'Browser tidak mendukung geolocation', 'error');
    }
}

function getLocationDescription(latlng) {
    const lat = latlng.lat;
    const lng = latlng.lng;

    if (lat >= -4.1 && lat <= -3.9 && lng >= 120.1 && lng <= 120.3) {
        return 'Kecamatan Sidenreng Rappang';
    }
    return 'Kabupaten Sidenreng Rappang';
}

// =====================================================
// MAP FUNCTIONS - BLOCK MAP
// =====================================================

function initBlockMap() {
    if (blockMap) {
        blockMap.invalidateSize();
        updateImportedLayersList();
        return;
    }

    blockMap = L.map('blockMap').setView([-3.9848, 120.2008], 13);

    blockStreetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    });

    blockSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri'
    });

    blockStreetLayer.addTo(blockMap);
    blockCurrentMapType = 'street';

    blockMap.importedLayers = L.layerGroup().addTo(blockMap);

    // Add WP markers
    wajibPajak.forEach(wp => {
        if (wp.latitude && wp.longitude) {
            const color = getTaxColor(wp.jenisPajak);
            const marker = L.circleMarker([wp.latitude, wp.longitude], {
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                radius: 8
            }).addTo(blockMap);

            marker.bindPopup(`
                <strong>${wp.nama}</strong><br>
                ${wp.alamat}<br>
                Jenis: ${wp.jenisPajak.join(', ')}
            `);
        }
    });

    document.getElementById('totalTitik').textContent = wajibPajak.filter(wp => wp.latitude && wp.longitude).length;

    addBlockMapControls();
    updateImportedLayersList();
}

function addBlockMapControls() {
    const mapDiv = document.getElementById('blockMap');
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'mb-2 flex items-center gap-2';
    controlsDiv.innerHTML = `
        <button type="button" id="btnBlockStreet" onclick="switchBlockMapView('street')" class="px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center">
            <i class="fas fa-road mr-1"></i> Peta Jalan
        </button>
        <button type="button" id="btnBlockSatellite" onclick="switchBlockMapView('satellite')" class="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm flex items-center">
            <i class="fas fa-satellite mr-1"></i> Satelit
        </button>
    `;
    mapDiv.parentNode.insertBefore(controlsDiv, mapDiv);
}

function switchBlockMapView(type) {
    if (!blockMap) return;

    if (type === 'satellite') {
        blockMap.removeLayer(blockStreetLayer);
        blockSatelliteLayer.addTo(blockMap);
        blockCurrentMapType = 'satellite';
    } else {
        blockMap.removeLayer(blockSatelliteLayer);
        blockStreetLayer.addTo(blockMap);
        blockCurrentMapType = 'street';
    }

    updateBlockMapButtonStates();
}

function updateBlockMapButtonStates() {
    const streetBtn = document.getElementById('btnBlockStreet');
    const satelliteBtn = document.getElementById('btnBlockSatellite');

    if (blockCurrentMapType === 'street') {
        streetBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center';
        satelliteBtn.className = 'px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm flex items-center';
    } else {
        streetBtn.className = 'px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm flex items-center';
        satelliteBtn.className = 'px-3 py-1 bg-blue-600 text-white rounded text-sm flex items-center';
    }
}

function getTaxColor(taxTypes) {
    const colors = {
        reklame: '#3b82f6',
        airtanah: '#06b6d4',
        walet: '#8b5cf6',
        mineral: '#f59e0b',
        pbbp2: '#eab308',
        bphtb: '#22c55e',
        pbjt_makanan: '#ec4899',
        pbjt_listrik: '#f97316',
        pbjt_perhotelan: '#14b8a6',
        pbjt_parkir: '#6366f1',
        pbjt_hiburan: '#a855f7',
        opsen_pkb: '#ef4444',
        opsen_bbnkb: '#dc2626'
    };
    
    if (Array.isArray(taxTypes)) {
        return colors[taxTypes[0]] || '#6b7280';
    }
    return colors[taxTypes] || '#6b7280';
}

// =====================================================
// IMPORT SHAPEFILE / KMZ / KML
// =====================================================

function importShapeFile() {
    const shpFile = document.getElementById('shpFile').files[0];
    const kmzFile = document.getElementById('kmzFile').files[0];
    
    if (!shpFile && !kmzFile) {
        showNotification('Peringatan', 'Pilih file SHP atau KMZ/KML terlebih dahulu!', 'warning');
        return;
    }
    
    Swal.fire({
        title: 'Memproses',
        text: 'Sedang memproses file...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });
    
    if (shpFile) {
        processShapefile(shpFile);
    } else if (kmzFile) {
        processKMZFile(kmzFile);
    }
}

function processShapefile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            
            if (file.name.endsWith('.zip')) {
                shp(arrayBuffer).then(function(geojson) {
                    displayGeojsonOnMap(geojson, 'Shapefile');
                }).catch(function(err) {
                    console.error('Error parsing shapefile:', err);
                    Swal.fire('Gagal', 'Gagal memproses file shapefile: ' + err.message, 'error');
                });
            } else {
                shp(arrayBuffer).then(function(geojson) {
                    displayGeojsonOnMap(geojson, 'Shapefile');
                }).catch(function(err) {
                    console.error('Error parsing shapefile:', err);
                    Swal.fire('Gagal', 'Gagal memproses file shapefile: ' + err.message, 'error');
                });
            }
        } catch (err) {
            console.error('Error reading file:', err);
            Swal.fire('Gagal', 'Gagal membaca file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function processKMZFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const arrayBuffer = e.target.result;
            
            if (file.name.endsWith('.kmz')) {
                JSZip.loadAsync(arrayBuffer).then(function(zip) {
                    const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml') || name.endsWith('.kml.d'));
                    if (kmlFile) {
                        return zip.file(kmlFile).async('string');
                    } else {
                        throw new Error('File KML tidak ditemukan dalam KMZ');
                    }
                }).then(function(kmlContent) {
                    parseKMLAndDisplay(kmlContent, 'KMZ');
                }).catch(function(err) {
                    console.error('Error processing KMZ:', err);
                    Swal.fire('Gagal', 'Gagal memproses file KMZ: ' + err.message, 'error');
                });
            } else if (file.name.endsWith('.kml')) {
                const kmlContent = new TextDecoder('utf-8').decode(arrayBuffer);
                parseKMLAndDisplay(kmlContent, 'KML');
            }
        } catch (err) {
            console.error('Error reading KMZ/KML file:', err);
            Swal.fire('Gagal', 'Gagal memproses file: ' + err.message, 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function parseKMLAndDisplay(kmlContent, fileType) {
    try {
        const parser = new DOMParser();
        const kmlDoc = parser.parseFromString(kmlContent, 'text/xml');
        
        const geojson = {
            type: 'FeatureCollection',
            features: []
        };
        
        const placemarks = kmlDoc.getElementsByTagName('Placemark');
        
        for (let i = 0; i < placemarks.length; i++) {
            const placemark = placemarks[i];
            const name = placemark.getElementsByTagName('name')[0]?.textContent || '';
            const description = placemark.getElementsByTagName('description')[0]?.textContent || '';
            
            const point = placemark.getElementsByTagName('Point')[0];
            if (point) {
                const coords = point.getElementsByTagName('coordinates')[0]?.textContent.trim().split(',');
                if (coords && coords.length >= 2) {
                    geojson.features.push({
                        type: 'Feature',
                        properties: { name, description },
                        geometry: {
                            type: 'Point',
                            coordinates: [parseFloat(coords[0]), parseFloat(coords[1])]
                        }
                    });
                }
            }
            
            const polygon = placemark.getElementsByTagName('Polygon')[0];
            if (polygon) {
                const outerCoords = polygon.getElementsByTagName('outerBoundaryIs')[0]?.getElementsByTagName('coordinates')[0]?.textContent.trim();
                if (outerCoords) {
                    const coords = outerCoords.split(/\s+/).map(c => {
                        const parts = c.split(',');
                        return [parseFloat(parts[0]), parseFloat(parts[1])];
                    });
                    geojson.features.push({
                        type: 'Feature',
                        properties: { name, description },
                        geometry: {
                            type: 'Polygon',
                            coordinates: [coords]
                        }
                    });
                }
            }
            
            const lineString = placemark.getElementsByTagName('LineString')[0];
            if (lineString) {
                const coordsStr = lineString.getElementsByTagName('coordinates')[0]?.textContent.trim();
                if (coordsStr) {
                    const coords = coordsStr.split(/\s+/).map(c => {
                        const parts = c.split(',');
                        return [parseFloat(parts[0]), parseFloat(parts[1])];
                    });
                    geojson.features.push({
                        type: 'Feature',
                        properties: { name, description },
                        geometry: {
                            type: 'LineString',
                            coordinates: coords
                        }
                    });
                }
            }
        }
        
        displayGeojsonOnMap(geojson, fileType);
    } catch (err) {
        console.error('Error parsing KML:', err);
        Swal.fire('Gagal', 'Gagal memparsing file KML: ' + err.message, 'error');
    }
}

function displayGeojsonOnMap(geojson, fileType) {
    if (!blockMap) {
        initBlockMap();
    }
    
    if (blockMap.importedLayers) {
        blockMap.importedLayers.clearLayers();
    } else {
        blockMap.importedLayers = L.layerGroup().addTo(blockMap);
    }
    
    function getStyle(feature) {
        const geometryType = feature.geometry.type;
        let style = {
            color: '#3b82f6',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.3
        };
        
        if (geometryType.includes('Point')) {
            style.radius = 8;
            style.fillColor = '#ef4444';
            style.fillOpacity = 0.8;
        } else if (geometryType.includes('Polygon')) {
            style.fillColor = '#22c55e';
        } else if (geometryType.includes('LineString')) {
            style.color = '#f59e0b';
            style.fillOpacity = 0;
        }
        
        return style;
    }
    
    const geojsonLayer = L.geoJSON(geojson, {
        style: getStyle,
        pointToLayer: function(feature, latlng) {
            return L.circleMarker(latlng, getStyle(feature));
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties && feature.properties.name) {
                const popupContent = `
                    <div class="p-2">
                        <strong>${feature.properties.name}</strong>
                        ${feature.properties.description ? `<p class="text-sm text-gray-600 mt-1">${feature.properties.description}</p>` : ''}
                        <p class="text-xs text-gray-400 mt-1">Tipe: ${feature.geometry.type}</p>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        }
    });
    
    geojsonLayer.addTo(blockMap.importedLayers);
    
    if (geojsonLayer.getBounds().isValid()) {
        blockMap.fitBounds(geojsonLayer.getBounds(), { padding: [50, 50] });
    }
    
    updateBlockStatistics(geojson);
    
    Swal.fire({
        title: 'Berhasil',
        text: `Data ${fileType} berhasil diimport! ${geojson.features.length} fitur ditemukan.`,
        icon: 'success',
        timer: 3000,
        showConfirmButton: true
    });
    
    document.getElementById('shpFile').value = '';
    document.getElementById('kmzFile').value = '';
}

function updateBlockStatistics(geojson) {
    let totalPoints = 0;
    let totalArea = 0;

    geojson.features.forEach(feature => {
        const geomType = feature.geometry.type;

        if (geomType.includes('Point') || geomType.includes('MultiPoint')) {
            totalPoints++;
        } else if (geomType.includes('Polygon') || geomType.includes('MultiPolygon')) {
            const coords = feature.geometry.coordinates;
            if (coords && coords.length > 0) {
                let area = 0;
                const polygon = Array.isArray(coords[0][0]) ? coords[0] : coords;

                for (let i = 0; i < polygon.length; i++) {
                    const j = (i + 1) % polygon.length;
                    area += polygon[i][0] * polygon[j][1];
                    area -= polygon[j][0] * polygon[i][1];
                }
                area = Math.abs(area) / 2;
                const areaInHectares = area * 111.32 * 111.32 * 0.0001;
                totalArea += areaInHectares;
            }
        } else if (geomType.includes('LineString') || geomType.includes('MultiLineString')) {
            totalPoints++;
        }
    });

    const existingPoints = wajibPajak.filter(wp => wp.latitude && wp.longitude).length;
    document.getElementById('totalTitik').textContent = existingPoints + totalPoints;
    document.getElementById('totalLuas').textContent = totalArea.toFixed(2);

    updateImportedLayersList();
}

function updateImportedLayersList() {
    const listContainer = document.getElementById('importedLayersList');
    if (!listContainer) return;

    if (blockMap && blockMap.importedLayers) {
        const layerCount = blockMap.importedLayers.getLayers().length;
        if (layerCount > 0) {
            listContainer.innerHTML = `
                <div class="flex items-center justify-between p-2 bg-blue-50 rounded">
                    <div class="flex items-center gap-2">
                        <i class="fas fa-layer-group text-blue-600"></i>
                        <span class="text-sm">Data Import (${layerCount} layer)</span>
                    </div>
                    <span class="text-xs text-green-600">Aktif</span>
                </div>
            `;
        } else {
            listContainer.innerHTML = '<p class="text-xs text-gray-400">Belum ada data yang diimport</p>';
        }
    } else {
        listContainer.innerHTML = '<p class="text-xs text-gray-400">Belum ada data yang diimport</p>';
    }
}

function clearImportedLayers() {
    if (blockMap && blockMap.importedLayers) {
        blockMap.importedLayers.clearLayers();
        updateImportedLayersList();
        document.getElementById('totalLuas').textContent = '0';

        Swal.fire({
            title: 'Berhasil',
            text: 'Data import telah dihapus dari peta',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
    }
}

// =====================================================
// WP FORM SUBMIT
// =====================================================

function handleWPSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const selectedPajak = Array.from(document.querySelectorAll('input[name="jenisPajak"]:checked')).map(cb => cb.value);
    
    if (selectedPajak.length === 0) {
        showNotification('Peringatan', 'Pilih minimal satu jenis pajak!', 'warning');
        return;
    }
    
    const wpData = {
        id: Date.now(),
        nik: formData.get('nik'),
        npwp: formData.get('npwp'),
        nama: formData.get('nama'),
        namaUsaha: formData.get('namaUsaha'),
        email: formData.get('email'),
        telepon: formData.get('telepon'),
        jenisKelamin: formData.get('jenisKelamin'),
        status: formData.get('status'),
        statusKeaktifan: formData.get('statusKeaktifan'),
        kepatuhan: formData.get('kepatuhan'),
        alamat: formData.get('alamat'),
        kecamatan: formData.get('kecamatan'),
        kelurahan: formData.get('kelurahan'),
        kodePos: formData.get('kodePos'),
        latitude: formData.get('latitude'),
        longitude: formData.get('longitude'),
        jenisPajak: selectedPajak,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.nama
    };
    
    // Collect tax-specific data
    selectedPajak.forEach(pajak => {
        const prefix = pajak.replace('_', '');
        wpData[pajak] = {};
        
        const inputs = document.querySelectorAll(`[name^="${prefix}_"]`);
        inputs.forEach(input => {
            wpData[pajak][input.name.replace(`${prefix}_`, '')] = input.value;
        });
    });
    
    wajibPajak.push(wpData);
    saveData();
    
    showNotification('Berhasil', 'Data wajib pajak berhasil disimpan!', 'success');
    e.target.reset();
    document.querySelectorAll('[id^="fields-"]').forEach(f => f.classList.add('hidden'));
    
    if (wpMap) {
        wpMap.setView([-3.9848, 120.2008], 13);
        if (wpMap.markers) {
            wpMap.markers.forEach(m => wpMap.removeLayer(m));
            wpMap.markers = [];
        }
    }
}

function resetForm() {
    document.getElementById('wpForm').reset();
    document.querySelectorAll('[id^="fields-"]').forEach(f => f.classList.add('hidden'));
    document.getElementById('addressFromCoord').value = '';
    if (wpMap) {
        wpMap.setView([-3.9848, 120.2008], 13);
        if (wpMap.markers) {
            wpMap.markers.forEach(m => wpMap.removeLayer(m));
            wpMap.markers = [];
        }
    }
}

// =====================================================
// DATA TABLE FUNCTIONS
// =====================================================

function renderWPTable() {
    const tbody = document.getElementById('wpTableBody');
    const search = document.getElementById('searchWp')?.value.toLowerCase() || '';
    const filter = document.getElementById('filterPajak')?.value || '';
    
    let filtered = wajibPajak.filter(wp => {
        const matchSearch = wp.nama.toLowerCase().includes(search) || 
                           wp.nik.includes(search) || 
                           wp.alamat.toLowerCase().includes(search);
        const matchFilter = !filter || wp.jenisPajak.includes(filter);
        return matchSearch && matchFilter;
    });
    
    tbody.innerHTML = filtered.map(wp => `
        <tr class="border-b hover:bg-gray-50">
            <td class="px-4 py-3 text-sm">${wp.nik}</td>
            <td class="px-4 py-3 text-sm font-medium">${wp.nama}</td>
            <td class="px-4 py-3 text-sm text-gray-600">${wp.alamat}</td>
            <td class="px-4 py-3 text-sm">
                <div class="flex flex-wrap gap-1">
                    ${wp.jenisPajak.map(p => `<span class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">${getTaxName(p)}</span>`).join('')}
                </div>
            </td>
            <td class="px-4 py-3 text-sm">
                <span class="px-2 py-1 ${wp.statusKeaktifan === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-xs rounded-full">${wp.statusKeaktifan || 'Aktif'}</span>
            </td>
            <td class="px-4 py-3 text-sm">
                <button onclick="viewWpDetail(${wp.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="deleteWp(${wp.id})" class="text-red-600 hover:text-red-800">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500">Tidak ada data</td></tr>';
}

function getTaxName(code) {
    const names = {
        reklame: 'Reklame',
        airtanah: 'Air Tanah',
        walet: 'Walet',
        mineral: 'Mineral',
        pbbp2: 'PBB-P2',
        bphtb: 'BPHTB',
        pbjt_makanan: 'PBJT M&M',
        pbjt_listrik: 'PBJT Listrik',
        pbjt_perhotelan: 'PBJT Hotel',
        pbjt_parkir: 'PBJT Parkir',
        pbjt_hiburan: 'PBJT Hiburan',
        opsen_pkb: 'Opsen PKB',
        opsen_bbnkb: 'Opsen BBNKB'
    };
    return names[code] || code;
}

function viewWpDetail(id) {
    const wp = wajibPajak.find(w => w.id === id);
    if (!wp) return;
    
    let html = `
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div><strong>NIK:</strong> ${wp.nik}</div>
            <div><strong>NPWP:</strong> ${wp.npwp || '-'}</div>
            <div><strong>Nama:</strong> ${wp.nama}</div>
            <div><strong>Nama Usaha:</strong> ${wp.namaUsaha || '-'}</div>
            <div><strong>Email:</strong> ${wp.email || '-'}</div>
            <div><strong>Telepon:</strong> ${wp.telepon}</div>
            <div><strong>Status Keaktifan:</strong> <span class="px-2 py-1 ${wp.statusKeaktifan === 'Aktif' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded text-xs">${wp.statusKeaktifan || 'Aktif'}</span></div>
            <div><strong>Kepatuhan:</strong> <span class="px-2 py-1 ${wp.kepatuhan === 'Patuh' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} rounded text-xs">${wp.kepatuhan || 'Patuh'}</span></div>
            <div class="col-span-2"><strong>Alamat:</strong> ${wp.alamat}</div>
            <div><strong>Kecamatan:</strong> ${wp.kecamatan}</div>
            <div><strong>Kelurahan:</strong> ${wp.kelurahan}</div>
            <div><strong>Latitude:</strong> ${wp.latitude}</div>
            <div><strong>Longitude:</strong> ${wp.longitude}</div>
        </div>
        <h4 class="font-semibold mb-2">Jenis Pajak:</h4>
        <div class="flex flex-wrap gap-2 mb-4">
            ${wp.jenisPajak.map(p => `<span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">${getTaxName(p)}</span>`).join('')}
        </div>
    `;
    
    wp.jenisPajak.forEach(pajak => {
        if (wp[pajak]) {
            html += `<h4 class="font-semibold mb-2 mt-4">Data ${getTaxName(pajak)}:</h4><div class="grid grid-cols-2 gap-2">`;
            Object.entries(wp[pajak]).forEach(([key, value]) => {
                if (value) {
                    html += `<div class="text-sm"><strong>${key}:</strong> ${value}</div>`;
                }
            });
            html += '</div>';
        }
    });
    
    document.getElementById('detailContent').innerHTML = html;
    document.getElementById('detailModal').classList.remove('hidden');
}

function closeDetailModal() {
    document.getElementById('detailModal').classList.add('hidden');
}

function deleteWp(id) {
    Swal.fire({
        title: 'Konfirmasi',
        text: 'Apakah Anda yakin ingin menghapus data ini?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            wajibPajak = wajibPajak.filter(w => w.id !== id);
            saveData();
            renderWPTable();
            showNotification('Berhasil', 'Data berhasil dihapus!', 'success');
        }
    });
}

function searchWp() {
    renderWPTable();
}

function filterWp() {
    renderWPTable();
}

// =====================================================
// EXPORT DATA
// =====================================================

function exportData() {
    if (wajibPajak.length === 0) {
        showNotification('Peringatan', 'Tidak ada data untuk diexport!', 'warning');
        return;
    }
    
    const csv = Papa.unparse(wajibPajak.map(wp => ({
        NIK: wp.nik,
        NPWP: wp.npwp || '',
        Nama: wp.nama,
        Nama_Usaha: wp.namaUsaha || '',
        Email: wp.email || '',
        Telepon: wp.telepon,
        Alamat: wp.alamat,
        Kecamatan: wp.kecamatan,
        Kelurahan: wp.kelurahan,
        Status_Keaktifan: wp.statusKeaktifan || '',
        Kepatuhan: wp.kepatuhan || '',
        Latitude: wp.latitude || '',
        Longitude: wp.longitude || '',
        Jenis_Pajak: wp.jenisPajak.join('; '),
        Tanggal_Daftar: wp.createdAt
    })));
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `database_wp_sidrap_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showNotification('Berhasil', 'Data berhasil diexport!', 'success');
}

// =====================================================
// USER MANAGEMENT
// =====================================================

function showAddUserModal() {
    document.getElementById('addUserModal').classList.remove('hidden');
}

function closeAddUserModal() {
    document.getElementById('addUserModal').classList.add('hidden');
    document.getElementById('addUserForm').reset();
}

function handleAddUser(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const newUser = {
        id: Date.now(),
        username: formData.get('username'),
        password: formData.get('password'),
        nama: formData.get('namaLengkap'),
        role: formData.get('role')
    };
    
    if (users.find(u => u.username === newUser.username)) {
        showNotification('Gagal', 'Username sudah digunakan!', 'error');
        return;
    }
    
    users.push(newUser);
    saveData();
    
    closeAddUserModal();
    renderUserList();
    showNotification('Berhasil', 'User berhasil ditambahkan!', 'success');
}

function renderUserList() {
    const container = document.getElementById('userList');
    container.innerHTML = users.map(user => `
        <div class="bg-white rounded-xl shadow-md p-4">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <i class="fas fa-user text-blue-600"></i>
                </div>
                <div>
                    <h4 class="font-semibold">${user.nama}</h4>
                    <p class="text-sm text-gray-500">@${user.username}</p>
                </div>
            </div>
            <div class="flex items-center justify-between">
                <span class="px-2 py-1 text-xs rounded-full ${user.role === 'admin' ? 'bg-red-100 text-red-700' : user.role === 'petugas' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}">${user.role}</span>
                ${user.role !== 'admin' ? `
                <button onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-800 text-sm">
                    <i class="fas fa-trash mr-1"></i>Hapus
                </button>
                ` : '<span class="text-gray-400 text-sm">Default</span>'}
            </div>
        </div>
    `).join('');
    
    document.getElementById('userAktif').textContent = users.length;
}

function deleteUser(id) {
    Swal.fire({
        title: 'Konfirmasi',
        text: 'Apakah Anda yakin ingin menghapus user ini?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Ya, Hapus',
        cancelButtonText: 'Batal'
    }).then((result) => {
        if (result.isConfirmed) {
            users = users.filter(u => u.id !== id);
            saveData();
            renderUserList();
            showNotification('Berhasil', 'User berhasil dihapus!', 'success');
        }
    });
}

// =====================================================
// DASHBOARD
// =====================================================

function updateDashboard() {
    document.getElementById('totalWp').textContent = wajibPajak.length;
    document.getElementById('pajakAktif').textContent = wajibPajak.filter(w => w.jenisPajak.length > 0).length;
    
    const totalPendapatan = wajibPajak.reduce((sum, wp) => {
        let revenue = 0;
        if (wp.pbbp2?.pbb_njop_tanah) revenue += parseFloat(wp.pbbp2.pbb_njop_tanah) * 0.005;
        if (wp.opsen_pkb?.opsen_pkb_nilai) revenue += parseFloat(wp.opsen_pkb.opsen_pkb_nilai) * 0.05;
        if (wp.opsen_bbnkb?.opsen_bbnkb_nilai) revenue += parseFloat(wp.opsen_bbnkb.opsen_bbnkb_nilai) * 0.05;
        if (wp.pbjt_makanan?.pbjt_makanan_omzet) revenue += parseFloat(wp.pbjt_makanan.pbjt_makanan_omzet) * 0.1;
        return sum + revenue;
    }, 0);
    
    document.getElementById('totalPendapatan').textContent = 'Rp ' + totalPendapatan.toLocaleString('id-ID', { maximumFractionDigits: 0 });
    document.getElementById('userAktif').textContent = users.length;
    
    // Render recent taxes
    const recentContainer = document.getElementById('recentTaxList');
    const recent = wajibPajak.slice(-5).reverse();
    
    recentContainer.innerHTML = recent.map(wp => `
        <div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
            <div>
                <p class="font-medium text-sm">${wp.nama}</p>
                <p class="text-xs text-gray-500">${wp.jenisPajak.map(p => getTaxName(p)).join(', ')}</p>
            </div>
            <span class="text-xs text-gray-400">${new Date(wp.createdAt).toLocaleDateString()}</span>
        </div>
    `).join('') || '<p class="text-gray-500 text-center py-4">Belum ada data</p>';
    
    // Update chart
    updateChart();
    updateDashboardRealisasi();
}

function updateChart() {
    const ctx = document.getElementById('taxTypeChart');
    if (!ctx) return;
    
    const taxCounts = {};
    wajibPajak.forEach(wp => {
        wp.jenisPajak.forEach(pajak => {
            taxCounts[pajak] = (taxCounts[pajak] || 0) + 1;
        });
    });
    
    const labels = Object.keys(taxCounts).map(k => getTaxName(k));
    const data = Object.values(taxCounts);
    
    if (taxChart) {
        taxChart.destroy();
    }
    
    taxChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Jumlah Wajib Pajak',
                data: data,
                backgroundColor: [
                    '#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#eab308',
                    '#22c55e', '#ec4899', '#f97316', '#14b8a6', '#6366f1',
                    '#a855f7', '#ef4444', '#dc2626'
                ],
                borderWidth: 0,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

function updateDashboardRealisasi() {
    const tahun = document.getElementById('realisasiTahun')?.value || new Date().getFullYear();
    const filteredData = realisasiPajak.filter(r => r.tahun == tahun);
    
    const taxTypesRealisasi = [
        { code: 'reklame', name: 'Pajak Reklame' },
        { code: 'airtanah', name: 'Pajak Air Tanah' },
        { code: 'walet', name: 'Pajak Walet' },
        { code: 'mineral', name: 'Pajak Mineral' },
        { code: 'pbbp2', name: 'PBB-P2' },
        { code: 'bphtb', name: 'BPHTB' },
        { code: 'pbjt_makanan', name: 'PBJT M&M' },
        { code: 'pbjt_listrik', name: 'PBJT Listrik' },
        { code: 'pbjt_perhotelan', name: 'PBJT Hotel' },
        { code: 'pbjt_parkir', name: 'PBJT Parkir' },
        { code: 'pbjt_hiburan', name: 'PBJT Hiburan' },
        { code: 'opsen_pkb', name: 'Opsen PKB' },
        { code: 'opsen_bbnkb', name: 'Opsen BBNKB' }
    ];
    
    const taxData = taxTypesRealisasi.map(tax => {
        const data = filteredData.filter(d => d.jenisPajak === tax.code);
        const target = data.reduce((sum, d) => sum + d.target, 0);
        const realisasi = data.reduce((sum, d) => sum + d.realisasi, 0);
        return { ...tax, target, realisasi, persen: target > 0 ? ((realisasi / target) * 100).toFixed(1) : 0 };
    });
    
    // Update summary
    const totalTarget = taxData.reduce((sum, t) => sum + t.target, 0);
    const totalRealisasi = taxData.reduce((sum, t) => sum + t.realisasi, 0);
    const totalPersen = totalTarget > 0 ? ((totalRealisasi / totalTarget) * 100).toFixed(1) : 0;
    
    document.getElementById('dashTarget').textContent = 'Rp ' + totalTarget.toLocaleString('id-ID');
    document.getElementById('dashRealisasi').textContent = 'Rp ' + totalRealisasi.toLocaleString('id-ID');
    document.getElementById('dashPersen').textContent = totalPersen + '%';
    document.getElementById('dashSelisih').textContent = 'Rp ' + (totalRealisasi - totalTarget).toLocaleString('id-ID');
    
    // Render dashboard table
    renderDashboardRealisasiTable(taxData);
    updateDashboardCharts(taxData);
}

function renderDashboardRealisasiTable(taxData) {
    const tbody = document.getElementById('dashRealisasiTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = taxData.map((tax, index) => {
        const persen = parseFloat(tax.persen);
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">${index + 1}</td>
                <td class="px-4 py-3 text-sm">${tax.name}</td>
                <td class="px-4 py-3 text-sm text-right">${tax.target.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-sm text-right">${tax.realisasi.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-sm text-center">
                    <div class="flex items-center justify-center gap-2">
                        <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full rounded-full ${persen >= 100 ? 'bg-green-500' : persen >= 80 ? 'bg-blue-500' : persen >= 50 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: ${Math.min(persen, 100)}%"></div>
                        </div>
                        <span class="text-xs">${tax.persen}%</span>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateDashboardCharts(taxData) {
    // Doughnut Chart
    const ctxDoughnut = document.getElementById('dashRealisasiChart');
    if (ctxDoughnut) {
        if (window.dashRealisasiChart) {
            window.dashRealisasiChart.destroy();
        }
        window.dashRealisasiChart = new Chart(ctxDoughnut, {
            type: 'doughnut',
            data: {
                labels: taxData.map(t => t.name),
                datasets: [{
                    data: [taxData.reduce((s, t) => s + t.target, 0), taxData.reduce((s, t) => s + t.realisasi, 0)],
                    backgroundColor: ['#e5e7eb', '#22c55e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
    
    // Bar Chart
    const ctxBar = document.getElementById('dashComparisonChart');
    if (ctxBar) {
        if (window.dashComparisonChart) {
            window.dashComparisonChart.destroy();
        }
        window.dashComparisonChart = new Chart(ctxBar, {
            type: 'bar',
            data: {
                labels: taxData.map(t => t.name),
                datasets: [
                    {
                        label: 'Target',
                        data: taxData.map(t => t.target),
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderRadius: 4
                    },
                    {
                        label: 'Realisasi',
                        data: taxData.map(t => t.realisasi),
                        backgroundColor: 'rgba(34, 197, 94, 0.7)',
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return 'Rp ' + (value / 1000000).toFixed(0) + 'M';
                            }
                        }
                    }
                }
            }
        });
    }
}

// =====================================================
// REPORTS
// =====================================================

function generateReport(type) {
    Swal.fire({
        title: 'Memproses',
        text: `Sedang membuat laporan ${type}...`,
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    setTimeout(() => {
        Swal.close();
        if (type === 'rekap') {
            exportData();
        } else {
            showNotification('Berhasil', `Laporan ${type} berhasil dibuat!`, 'success');
        }
    }, 1000);
}

// =====================================================
// REALISASI PAJAK
// =====================================================

const taxTypesRealisasi = [
    { code: 'reklame', name: 'Pajak Reklame', color: '#3b82f6' },
    { code: 'airtanah', name: 'Pajak Air Tanah', color: '#06b6d4' },
    { code: 'walet', name: 'Pajak Walet', color: '#8b5cf6' },
    { code: 'mineral', name: 'Pajak Mineral', color: '#f59e0b' },
    { code: 'pbbp2', name: 'PBB-P2', color: '#eab308' },
    { code: 'bphtb', name: 'BPHTB', color: '#22c55e' },
    { code: 'pbjt_makanan', name: 'PBJT M&M', color: '#ec4899' },
    { code: 'pbjt_listrik', name: 'PBJT Listrik', color: '#f97316' },
    { code: 'pbjt_perhotelan', name: 'PBJT Hotel', color: '#14b8a6' },
    { code: 'pbjt_parkir', name: 'PBJT Parkir', color: '#6366f1' },
    { code: 'pbjt_hiburan', name: 'PBJT Hiburan', color: '#a855f7' },
    { code: 'opsen_pkb', name: 'Opsen PKB', color: '#ef4444' },
    { code: 'opsen_bbnkb', name: 'Opsen BBNKB', color: '#dc2626' }
];

function generateYears() {
    const select = document.getElementById('realisasiTahun');
    if (!select) return;
    
    select.innerHTML = '';
    for (let year = 2020; year <= 2035; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === new Date().getFullYear()) {
            option.selected = true;
        }
        select.appendChild(option);
    }
}

function showInputRealisasiModal() {
    document.getElementById('inputRealisasiModal').classList.remove('hidden');
    const currentMonth = new Date().getMonth() + 1;
    document.getElementById('periodeRealisasi').value = currentMonth;
    document.getElementById('tanggalRealisasi').value = new Date().toISOString().split('T')[0];
}

function closeInputRealisasiModal() {
    document.getElementById('inputRealisasiModal').classList.add('hidden');
    document.getElementById('realisasiForm').reset();
}

function showEditRealisasiModal(id) {
    const data = realisasiPajak.find(r => r.id === id);
    if (!data) return;

    document.getElementById('editId').value = data.id;
    document.getElementById('editJenisPajak').value = data.jenisPajak;
    document.getElementById('editPeriode').value = data.periode;
    document.getElementById('editTarget').value = data.target;
    document.getElementById('editRealisasi').value = data.realisasi;
    document.getElementById('editTanggalRealisasi').value = data.tanggalRealisasi || '';
    document.getElementById('editCatatan').value = data.catatan || '';

    document.getElementById('editRealisasiModal').classList.remove('hidden');
}

function closeEditRealisasiModal() {
    document.getElementById('editRealisasiModal').classList.add('hidden');
    document.getElementById('editRealisasiForm').reset();
}

function handleRealisasiSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const tahun = document.getElementById('realisasiTahun').value;

    const newData = {
        id: Date.now(),
        jenisPajak: formData.get('jenisPajakRealisasi'),
        periode: formData.get('periodeRealisasi'),
        tahun: parseInt(tahun),
        tanggalRealisasi: formData.get('tanggalRealisasi'),
        target: parseFloat(formData.get('targetRealisasi')),
        realisasi: parseFloat(formData.get('realisasiValue')),
        catatan: formData.get('catatanRealisasi'),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.nama
    };

    const existingIndex = realisasiPajak.findIndex(r =>
        r.jenisPajak === newData.jenisPajak &&
        r.periode === newData.periode &&
        r.tahun === newData.tahun
    );

    if (existingIndex >= 0) {
        realisasiPajak[existingIndex] = newData;
    } else {
        realisasiPajak.push(newData);
    }

    saveData();
    closeInputRealisasiModal();
    updateRealisasi();
    showNotification('Berhasil', 'Data realisasi berhasil disimpan!', 'success');
}

function handleEditRealisasiSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = parseInt(formData.get('editId'));
    const tahun = document.getElementById('realisasiTahun').value;

    const updatedData = {
        id: id,
        jenisPajak: formData.get('editJenisPajak'),
        periode: formData.get('editPeriode'),
        tahun: parseInt(tahun),
        tanggalRealisasi: formData.get('editTanggalRealisasi'),
        target: parseFloat(formData.get('editTarget')),
        realisasi: parseFloat(formData.get('editRealisasi')),
        catatan: formData.get('editCatatan'),
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.nama
    };

    const index = realisasiPajak.findIndex(r => r.id === id);
    if (index >= 0) {
        realisasiPajak[index] = updatedData;
        saveData();
        closeEditRealisasiModal();
        updateRealisasi();
        showNotification('Berhasil', 'Data realisasi berhasil diperbarui!', 'success');
    }
}

function updateRealisasi() {
    const tahun = document.getElementById('realisasiTahun').value;
    const filteredData = realisasiPajak.filter(r => r.tahun == tahun);

    let totalTarget = 0;
    let totalRealisasi = 0;

    const taxData = taxTypesRealisasi.map(tax => {
        const data = filteredData.filter(d => d.jenisPajak === tax.code);
        const target = data.reduce((sum, d) => sum + d.target, 0);
        const realisasi = data.reduce((sum, d) => sum + d.realisasi, 0);
        totalTarget += target;
        totalRealisasi += realisasi;

        return {
            ...tax,
            target,
            realisasi,
            selisih: realisasi - target,
            persen: target > 0 ? ((realisasi / target) * 100).toFixed(1) : 0
        };
    });

    document.getElementById('totalTarget').textContent = 'Rp ' + totalTarget.toLocaleString('id-ID');
    document.getElementById('totalRealisasi').textContent = 'Rp ' + totalRealisasi.toLocaleString('id-ID');
    const totalPersen = totalTarget > 0 ? ((totalRealisasi / totalTarget) * 100).toFixed(1) : 0;
    document.getElementById('totalPersen').textContent = totalPersen + '%';
    document.getElementById('totalSelisih').textContent = 'Rp ' + (totalRealisasi - totalTarget).toLocaleString('id-ID');

    document.getElementById('footerTarget').textContent = 'Rp ' + totalTarget.toLocaleString('id-ID');
    document.getElementById('footerRealisasi').textContent = 'Rp ' + totalRealisasi.toLocaleString('id-ID');
    document.getElementById('footerPersen').textContent = totalPersen + '%';
    document.getElementById('footerSelisih').textContent = 'Rp ' + (totalRealisasi - totalTarget).toLocaleString('id-ID');

    renderRealisasiTable(taxData);
    updateRealisasiCharts(taxData);
}

function renderRealisasiTable(taxData) {
    const tbody = document.getElementById('realisasiTableBody');
    tbody.innerHTML = taxData.map((tax, index) => {
        const persen = parseFloat(tax.persen);
        let status, statusClass;
        if (persen >= 100) {
            status = 'Melampaui';
            statusClass = 'bg-green-100 text-green-700';
        } else if (persen >= 80) {
            status = 'On Track';
            statusClass = 'bg-blue-100 text-blue-700';
        } else if (persen >= 50) {
            status = 'Progress';
            statusClass = 'bg-yellow-100 text-yellow-700';
        } else {
            status = 'Kurang';
            statusClass = 'bg-red-100 text-red-700';
        }

        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">${index + 1}</td>
                <td class="px-4 py-3 text-sm">
                    <div class="flex items-center gap-2">
                        <div class="w-3 h-3 rounded-full" style="background-color: ${tax.color}"></div>
                        <span>${tax.name}</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-right">${tax.target.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-sm text-right">${tax.realisasi.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-sm text-center">
                    <div class="flex items-center justify-center gap-2">
                        <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div class="h-full rounded-full ${persen >= 100 ? 'bg-green-500' : persen >= 80 ? 'bg-blue-500' : persen >= 50 ? 'bg-yellow-500' : 'bg-red-500'}" style="width: ${Math.min(persen, 100)}%"></div>
                        </div>
                        <span class="text-xs">${tax.persen}%</span>
                    </div>
                </td>
                <td class="px-4 py-3 text-sm text-right ${tax.selisih >= 0 ? 'text-green-600' : 'text-red-600'}">${tax.selisih.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-sm text-center">
                    <span class="px-2 py-1 text-xs rounded-full ${statusClass}">${status}</span>
                </td>
                <td class="px-4 py-3 text-sm text-center">
                    <button onclick="showEditRealisasiModal('${tax.code}')" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function showEditRealisasiModalByCode(code) {
    const tahun = document.getElementById('realisasiTahun').value;
    const existingData = realisasiPajak.find(r => r.jenisPajak === code && r.tahun == tahun);

    if (existingData) {
        document.getElementById('editId').value = existingData.id;
        document.getElementById('editJenisPajak').value = existingData.jenisPajak;
        document.getElementById('editPeriode').value = existingData.periode;
        document.getElementById('editTarget').value = existingData.target;
        document.getElementById('editRealisasi').value = existingData.realisasi;
        document.getElementById('editTanggalRealisasi').value = existingData.tanggalRealisasi || '';
        document.getElementById('editCatatan').value = existingData.catatan || '';
    } else {
        document.getElementById('editId').value = '';
        document.getElementById('editJenisPajak').value = code;
        document.getElementById('editPeriode').value = new Date().getMonth() + 1;
        document.getElementById('editTarget').value = '';
        document.getElementById('editRealisasi').value = '';
        document.getElementById('editTanggalRealisasi').value = new Date().toISOString().split('T')[0];
        document.getElementById('editCatatan').value = '';
    }

    document.getElementById('editRealisasiModal').classList.remove('hidden');
}

function updateRealisasiCharts(taxData) {
    const ctx1 = document.getElementById('realisasiChart');
    if (realisasiChart) {
        realisasiChart.destroy();
    }

    realisasiChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: taxData.map(t => t.name),
            datasets: [
                {
                    label: 'Target',
                    data: taxData.map(t => t.target),
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    borderRadius: 4
                },
                {
                    label: 'Realisasi',
                    data: taxData.map(t => t.realisasi),
                    backgroundColor: 'rgba(34, 197, 94, 0.5)',
                    borderColor: '#22c55e',
                    borderWidth: 1,
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'Rp ' + value.toLocaleString('id-ID');
                        }
                    }
                }
            }
        }
    });

    const ctx2 = document.getElementById('persenChart');
    if (persenChart) {
        persenChart.destroy();
    }

    persenChart = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: taxData.map(t => t.name),
            datasets: [{
                data: taxData.map(t => t.persen),
                backgroundColor: taxData.map(t => t.color),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.raw + '%';
                        }
                    }
                }
            }
        }
    });
}

function exportRealisasi() {
    const tahun = document.getElementById('realisasiTahun').value;
    const filteredData = realisasiPajak.filter(r => r.tahun == tahun);

    if (filteredData.length === 0) {
        showNotification('Peringatan', 'Tidak ada data untuk diexport!', 'warning');
        return;
    }

    const exportData = filteredData.map(r => ({
        'Jenis Pajak': taxTypesRealisasi.find(t => t.code === r.jenisPajak)?.name || r.jenisPajak,
        'Periode': ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][r.periode - 1],
        'Tahun': r.tahun,
        'Tanggal Realisasi': r.tanggalRealisasi || '',
        'Target (Rp)': r.target,
        'Realisasi (Rp)': r.realisasi,
        'Persentase': r.target > 0 ? ((r.realisasi / r.target) * 100).toFixed(2) + '%' : '0%',
        'Catatan': r.catatan || ''
    }));

    const csv = Papa.unparse(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `realisasi_pajak_sidrap_${tahun}.csv`;
    link.click();

    showNotification('Berhasil', 'Data realisasi berhasil diexport!', 'success');
}

// =====================================================
// DATA STORAGE
// =====================================================

function saveData() {
    localStorage.setItem('wajibPajak', JSON.stringify(wajibPajak));
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('realisasiPajak', JSON.stringify(realisasiPajak));
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function showNotification(title, text, icon) {
    Swal.fire(title, text, icon);
}

// Make functions globally accessible
window.logout = logout;
window.showPage = showPage;
window.showTaxFields = showTaxFields;
window.switchMapView = switchMapView;
window.clearMapLocation = clearMapLocation;
window.getCurrentLocation = getCurrentLocation;
window.switchBlockMapView = switchBlockMapView;
window.importShapeFile = importShapeFile;
window.clearImportedLayers = clearImportedLayers;
window.handleWPSubmit = handleWPSubmit;
window.resetForm = resetForm;
window.viewWpDetail = viewWpDetail;
window.closeDetailModal = closeDetailModal;
window.deleteWp = deleteWp;
window.searchWp = searchWp;
window.filterWp = filterWp;
window.exportData = exportData;
window.showAddUserModal = showAddUserModal;
window.closeAddUserModal = closeAddUserModal;
window.deleteUser = deleteUser;
window.generateReport = generateReport;
window.showInputRealisasiModal = showInputRealisasiModal;
window.closeInputRealisasiModal = closeInputRealisasiModal;
window.showEditRealisasiModal = showEditRealisasiModal;
window.closeEditRealisasiModal = closeEditRealisasiModal;
window.showEditRealisasiModalByCode = showEditRealisasiModalByCode;
window.exportRealisasi = exportRealisasi;
window.generateYears = generateYears;
