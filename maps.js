/* =========================================================================
   전쟁 예언자 — 지도 자산 (인라인 SVG)
   외부 이미지 없이 오프라인/배포에서도 안정적으로 표시됩니다.
   단순화한 개략도이며 정확한 국경이 아닌 학습용 도식입니다.
   ========================================================================= */

const MAPS = {
  /* ------------------------------------------------------------------
     1914년 유럽 개략도.
     각 <path>에 data-country 를 넣어 app.js에서 색칠/식별합니다.
     viewBox 0 0 100 78 (map-wrap의 4:3 비율에 맞춤)
     ------------------------------------------------------------------ */
  europe() {
    return `
<svg class="geo-map" viewBox="0 0 100 78" preserveAspectRatio="xMidYMid meet" role="img" aria-label="1914년 유럽 개략 지도">
  <defs>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe3ef"/>
      <stop offset="1" stop-color="#b8d3e2"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="100" height="78" fill="url(#sea)"/>

  <!-- 영국 -->
  <path class="land" data-country="britain"
    d="M28,14 L34,12 L36,18 L33,24 L27,26 L24,20 Z"/>
  <!-- 프랑스 -->
  <path class="land" data-country="france"
    d="M27,34 L40,32 L44,40 L40,50 L30,52 L25,44 Z"/>
  <!-- 독일 -->
  <path class="land" data-country="germany"
    d="M44,26 L58,25 L60,36 L54,42 L45,40 L44,32 Z"/>
  <!-- 오스트리아-헝가리 -->
  <path class="land" data-country="austria"
    d="M54,42 L70,40 L74,50 L64,56 L52,54 L50,46 Z"/>
  <!-- 이탈리아 -->
  <path class="land" data-country="italy"
    d="M48,54 L56,54 L58,64 L54,74 L49,70 L47,60 Z"/>
  <!-- 러시아 (동쪽 넓게) -->
  <path class="land" data-country="russia"
    d="M72,10 L98,10 L98,52 L78,54 L70,40 L68,24 Z"/>

  <!-- 배경 육지(비활성, 참고용) -->
  <path class="land-bg" data-country="spain"
    d="M16,50 L28,50 L30,60 L20,66 L12,58 Z"/>
  <path class="land-bg" data-country="balkan"
    d="M64,56 L74,54 L78,62 L70,70 L62,66 Z"/>
  <path class="land-bg" data-country="scandinavia"
    d="M52,4 L64,4 L62,18 L54,20 L50,10 Z"/>

  <text class="geo-label" x="49" y="6">스칸디나비아</text>
</svg>`;
  },

  /* ------------------------------------------------------------------
     발칸반도 지역 개략도 (미션 2).
     지역/도시 라벨과 사라예보 표시점을 포함.
     viewBox 0 0 100 78
     ------------------------------------------------------------------ */
  balkans() {
    return `
<svg class="geo-map balkans" viewBox="0 0 100 78" preserveAspectRatio="xMidYMid meet" role="img" aria-label="1914년 발칸반도 개략 지도">
  <defs>
    <linearGradient id="sea2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#cfe3ef"/>
      <stop offset="1" stop-color="#a9c8db"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="100" height="78" fill="url(#sea2)"/>

  <!-- 오스트리아-헝가리 (북쪽, 지배 세력) -->
  <path class="region region-austria" data-region="austria"
    d="M6,6 L70,4 L74,20 L40,24 L10,22 Z"/>
  <!-- 보스니아 (오스트리아-헝가리가 지배, 사건 무대) -->
  <path class="region region-bosnia" data-region="bosnia"
    d="M34,24 L58,22 L60,38 L42,44 L32,36 Z"/>
  <!-- 세르비아 (남슬라브 통합 주장) -->
  <path class="region region-serbia" data-region="serbia"
    d="M58,26 L76,26 L80,44 L64,50 L58,40 Z"/>
  <!-- 오스만 제국(쇠퇴, 남동쪽) -->
  <path class="region region-ottoman" data-region="ottoman"
    d="M64,50 L92,48 L94,70 L70,72 L60,58 Z"/>

  <!-- 사라예보 위치 표시 -->
  <g class="spark" data-region="sarajevo">
    <circle cx="46" cy="34" r="2.4" class="spark-dot"/>
    <circle cx="46" cy="34" r="6" class="spark-ring"/>
  </g>

  <!-- 지역 라벨 -->
  <text class="geo-label" x="30" y="14">오스트리아-헝가리</text>
  <text class="geo-label" x="45" y="30">보스니아</text>
  <text class="geo-label" x="68" y="38">세르비아</text>
  <text class="geo-label" x="78" y="62">오스만 제국</text>
  <text class="city-label" x="46" y="42">★ 사라예보</text>
</svg>`;
  },
};
