/* =========================================================================
   전쟁 예언자 — 지도 (OpenStreetMap + Leaflet)
   실제 지도 타일 위에 국가/지역 이름을 표시합니다.
   인터넷 연결이 있어야 지도 타일이 로드됩니다.
   ========================================================================= */

const MAPS = {
  // 미션 1: 1914년 주요 국가의 대략적 수도/중심 좌표
  europeCountries: {
    germany:  { name: "독일",             lat: 52.52, lng: 13.40 },
    austria:  { name: "오스트리아-헝가리", lat: 47.50, lng: 16.30 },
    italy:    { name: "이탈리아",          lat: 41.90, lng: 12.50 },
    britain:  { name: "영국",             lat: 51.51, lng: -0.13 },
    france:   { name: "프랑스",           lat: 48.85, lng: 2.35 },
    russia:   { name: "러시아",           lat: 55.75, lng: 37.62 },
  },

  // 미션 2: 발칸반도 주요 지역 좌표
  balkanRegions: {
    austria:  { name: "오스트리아-헝가리", lat: 47.5,  lng: 16.3 },
    bosnia:   { name: "보스니아",          lat: 44.2,  lng: 17.8 },
    serbia:   { name: "세르비아",          lat: 44.0,  lng: 20.9 },
    ottoman:  { name: "오스만 제국",       lat: 41.0,  lng: 28.9 },
    sarajevo: { name: "사라예보",          lat: 43.85, lng: 18.41 },
  },

  _tileLayer(map) {
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
  },

  // 색깔 있는 원형 마커 + 항상 보이는 이름 라벨(툴팁)
  _labelMarker(id, info, color) {
    const marker = L.circleMarker([info.lat, info.lng], {
      radius: 9,
      color: "#333",
      weight: 2,
      fillColor: color || "#bbbbbb",
      fillOpacity: 0.95,
    });
    marker.bindTooltip(info.name, {
      permanent: true,
      direction: "top",
      className: "map-name-label",
      offset: [0, -8],
    });
    marker._countryId = id;
    return marker;
  },

  /* 미션 1 유럽 지도 생성.
     반환: { map, markers: {id: marker}, setGroup(id, group) } */
  buildEurope(container) {
    const map = L.map(container, {
      center: [50, 15],
      zoom: 4,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
    });
    this._tileLayer(map);
    const markers = {};
    Object.keys(this.europeCountries).forEach((id) => {
      const mk = this._labelMarker(id, this.europeCountries[id]);
      mk.addTo(map);
      markers[id] = mk;
    });
    const colorByGroup = { alliance: "#c0392b", entente: "#2c6fbb", none: "#cccccc" };
    function setGroup(id, group) {
      const mk = markers[id];
      if (!mk) return;
      mk.setStyle({ fillColor: colorByGroup[group] || colorByGroup.none });
    }
    setTimeout(() => map.invalidateSize(), 200);
    return { map, markers, setGroup };
  },

  /* 미션 2 발칸 지도 생성.
     반환: { map, highlight(ids), showSarajevo() } */
  buildBalkans(container) {
    const map = L.map(container, {
      center: [44, 20],
      zoom: 5,
      scrollWheelZoom: false,
      dragging: true,
      tap: true,
    });
    this._tileLayer(map);

    const regionMarkers = {};
    ["austria", "bosnia", "serbia", "ottoman"].forEach((id) => {
      const colors = { austria: "#d9a441", bosnia: "#e07b39", serbia: "#9b59b6", ottoman: "#5fad56" };
      const mk = this._labelMarker(id, this.balkanRegions[id], colors[id]);
      mk.addTo(map);
      regionMarkers[id] = mk;
    });

    // 사라예보 표시(처음엔 숨김)
    const sar = this.balkanRegions.sarajevo;
    let sarMarker = null;

    function highlight(ids) {
      Object.keys(regionMarkers).forEach((id) => {
        const on = (ids || []).includes(id);
        regionMarkers[id].setRadius(on ? 13 : 9);
        regionMarkers[id].setStyle({ weight: on ? 4 : 2, color: on ? "#a4342a" : "#333" });
      });
    }
    function showSarajevo() {
      if (sarMarker) return;
      sarMarker = L.marker([sar.lat, sar.lng]).addTo(map);
      sarMarker.bindTooltip("★ 사라예보 사건", {
        permanent: true, direction: "top", className: "map-name-label spark-label", offset: [0, -12],
      });
      L.circle([sar.lat, sar.lng], { radius: 40000, color: "#a4342a", fillColor: "#a4342a", fillOpacity: 0.3 }).addTo(map);
      map.setView([sar.lat, sar.lng], 6);
    }
    setTimeout(() => map.invalidateSize(), 200);
    return { map, highlight, showSarajevo };
  },
};
