/* ---------- Nearby care finder ---------- */
const WAIT_TIMES_URL='https://www.edwaittimes.ca/welcome';

async function searchPlaces(lat, lng, mode, queryOrType) {
  try {
    const {
      Place,
      SearchByTextRankPreference,
      SearchNearbyRankPreference
    } = await google.maps.importLibrary("places");

    let places = [];

    // -----------------------------------
    // TEXT SEARCH
    // Used for:
    // - family doctor
    // - walk-in clinic
    // -----------------------------------
    if (mode === "text") {
      const request = {
        textQuery: queryOrType,

        fields: [
          "displayName",
          "formattedAddress",
          "location",
          "businessStatus",
          "rating",
          "regularOpeningHours"
        ],

        locationBias: {
          center: {
            lat: lat,
            lng: lng
          },
          radius: 10000
        },

        maxResultCount: 10,

        rankPreference:
          SearchByTextRankPreference.DISTANCE
      };

      const response =
        await Place.searchByText(request);

      places = response.places || [];
    }

    // -----------------------------------
    // NEARBY SEARCH
    // Used for:
    // - pharmacy
    // -----------------------------------
    else if (mode === "nearby") {
      const request = {
        fields: [
          "displayName",
          "formattedAddress",
          "location",
          "businessStatus",
          "rating",
          "regularOpeningHours"
        ],

        locationRestriction: {
          center: {
            lat: lat,
            lng: lng
          },
          radius: 10000
        },

        includedPrimaryTypes: [
          queryOrType
        ],

        maxResultCount: 10,

        rankPreference:
          SearchNearbyRankPreference.DISTANCE
      };

      const response =
        await Place.searchNearby(request);

      places = response.places || [];
    }

    // -----------------------------------
    // Convert Google results into
    // CarePath-friendly data
    // -----------------------------------
    const results = places.map(place => {

      const pLat =
        typeof place.location?.lat === "function"
          ? place.location.lat()
          : place.location?.lat;

      const pLng =
        typeof place.location?.lng === "function"
          ? place.location.lng()
          : place.location?.lng;

      // Calculate distance from user
      const distance =
        pLat != null && pLng != null
          ? distanceKm(
              lat,
              lng,
              pLat,
              pLng
            )
          : 999;

      // Check if open now
      let open = undefined;

      if (
        place.regularOpeningHours &&
        typeof place.regularOpeningHours.isOpen === "function"
      ) {
        try {
          open =
            place.regularOpeningHours.isOpen(
              new Date()
            );
        } catch (error) {
          open = undefined;
        }
      }

      return {
        name:
          place.displayName ||
          "Unknown location",

        vicinity:
          place.formattedAddress ||
          "Address unavailable",

        distance:
          distance,

        rating:
          place.rating,

        open:
          open,

        businessStatus:
          place.businessStatus
      };
    });

    // -----------------------------------
    // Sorting:
    // 1. Open now
    // 2. Unknown hours
    // 3. Closed
    // Then nearest first
    // -----------------------------------
    const openRank = value => {
      if (value === true) return 0;
      if (value === undefined) return 1;
      if (value === false) return 2;
      return 1;
    };

    results.sort((a, b) => {
      const openDifference =
        openRank(a.open) -
        openRank(b.open);

      if (openDifference !== 0) {
        return openDifference;
      }

      return (
        a.distance -
        b.distance
      );
    });

    // Only return top 5
    return results.slice(0, 5);

  } catch (error) {
    console.error(
      "Places API search error:",
      mode,
      queryOrType,
      error
    );

    return [];
  }
}

async function findPrimaryCareOptions(
  lat,
  lng
) {
  const list = $("nearbyList");

  list.innerHTML = `
    <p class="gpsmsg">
      Finding family doctors,
      walk-in clinics and pharmacies near you...
    </p>
  `;

  try {

    const [
      familyDoctors,
      walkIns,
      pharmacies
    ] = await Promise.all([

      // Family doctors
      searchPlaces(
        lat,
        lng,
        "text",
        "family doctor"
      ),

      // Walk-in clinics
      searchPlaces(
        lat,
        lng,
        "text",
        "walk-in clinic"
      ),

      // Pharmacies
      searchPlaces(
        lat,
        lng,
        "nearby",
        "pharmacy"
      )
    ]);

    list.innerHTML =

      renderPlaceGroup(
        "👨‍⚕️ Family doctors",
        familyDoctors
      )

      +

      renderPlaceGroup(
        "🏥 Walk-in clinics",
        walkIns
      )

      +

      renderPlaceGroup(
        "💊 Pharmacies",
        pharmacies
      );

  } catch (error) {

    console.error(
      "Primary care search failed:",
      error
    );

    list.innerHTML = `
      <div class="place">
        <strong>
          Nearby search failed.
        </strong>

        <p class="gpsmsg">
          Please try again.
        </p>
      </div>
    `;
  }
}

function renderPlaceGroup(title, places) {

  if (!places.length) {
    return `
      <div style="margin-top:1.5rem">
        <h4>${title}</h4>
        <p class="gpsmsg">
          No nearby locations found.
        </p>
      </div>
    `;
  }

  return `
    <div style="margin-top:1.5rem">

      <h4>${title}</h4>

      ${places.map((p, index) => {

        const openStatus =
          p.open === true
            ? '<span class="badge open">Open now</span>'
            : p.open === false
            ? '<span class="badge closed">Closed</span>'
            : '<span class="badge">Hours unavailable</span>';

        const rating =
          p.rating
            ? `<span class="badge">★ ${p.rating}</span>`
            : '';

        const distanceText =
          p.distance < 999
            ? `${p.distance.toFixed(1)} km`
            : '';

        return `
          <div class="place">

            <div class="place-top">

              <div>
                <div class="place-name">
                  ${index + 1}. ${esc(p.name)}
                </div>

                <div class="gpsmsg">
                  ${esc(p.vicinity || 'Address unavailable')}
                </div>
              </div>

              <strong>
                ${distanceText}
              </strong>

            </div>

            <div>
              ${openStatus}
              ${rating}
            </div>

          </div>
        `;

      }).join('')}

    </div>
  `;
}
function careSearchFor(best){
  const s=(best||'').toLowerCase();
  if(s.includes('optometrist')) return {type:'doctor',keyword:'optometrist'};
  if(s.includes('pharmacist')) return {type:'pharmacy',keyword:'pharmacy'};
  if(s.includes('dentist')) return {type:'dentist',keyword:'dentist'};
  if(s.includes('urgent')||s.includes('upcc')) return {type:'doctor',keyword:'urgent primary care centre'};
  if(s.includes('er')||s.includes('emergency')) return {type:'hospital',keyword:'emergency department'};
  return {type:'doctor',keyword:'walk-in clinic family doctor'};
}

function distanceKm(a,b,c,d){
  const R=6371, rad=x=>x*Math.PI/180;
  const dLat=rad(c-a), dLng=rad(d-b);
  const q=Math.sin(dLat/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(q));
}

function nearbyShell(best,isEmergency=false){
  return `<div class="nearby">
    <div class="nearby-head">
      <div>
        <h4 style="margin:0">📍 Care near you</h4>
        <p class="gpsmsg">Use your location to find nearby places and compare open status and distance.</p>
      </div>
      <button class="btn" id="findCare">${isEmergency?'Find nearest ER':'Find nearby care'}</button>
    </div>
    <div id="gpsStatus"></div>
    <div id="nearbyList"></div>
  </div>`;
}

async function findNearbyCare(best) {

  const status = $("gpsStatus");
  const list = $("nearbyList");

  // -----------------------------------
  // Check browser geolocation support
  // -----------------------------------
  if (!navigator.geolocation) {

    status.innerHTML = `
      <p class="gpsmsg">
        Location is not supported by this browser.
      </p>
    `;

    return;
  }

  status.innerHTML = `
    <p class="gpsmsg">
      Requesting your location...
    </p>
  `;


  // -----------------------------------
  // Get user's current location
  // -----------------------------------
  navigator.geolocation.getCurrentPosition(

    async position => {

      const lat =
        position.coords.latitude;

      const lng =
        position.coords.longitude;


      status.innerHTML = `
        <p class="gpsmsg">
          Location found.
        </p>
      `;


      // -----------------------------------
      // Check Google Places loaded
      // -----------------------------------
      if (
        !window.google ||
        !google.maps
      ) {

        list.innerHTML = `
          <div class="place">

            <strong>
              Nearby search is still loading.
            </strong>

            <p class="gpsmsg">
              Please wait a few seconds
              and press "Find nearby care" again.
            </p>

          </div>
        `;

        return;
      }


      try {

        const lower =
          best.toLowerCase();


        // ===================================
        // FAMILY DOCTOR / WALK-IN RESULT
        // Show 3 different groups
        // ===================================

        if (
          lower.includes("family doctor") ||
          lower.includes("walk-in")
        ) {

          await findPrimaryCareOptions(
            lat,
            lng
          );

          return;
        }


        // ===================================
        // ALL OTHER CARE TYPES
        // ===================================

        let title =
          "📍 Nearby care";

        let mode =
          "text";

        let query =
          best;


        // -----------------------------------
        // Optometrist
        // -----------------------------------
        if (
          lower.includes("optometrist")
        ) {

          title =
            "👁️ Nearby optometrists";

          mode =
            "text";

          query =
            "optometrist";
        }


        // -----------------------------------
        // Dentist
        // -----------------------------------
        else if (
          lower.includes("dentist")
        ) {

          title =
            "🦷 Nearby dentists";

          mode =
            "text";

          query =
            "dentist";
        }


        // -----------------------------------
        // Emergency room
        // -----------------------------------
        else if (
          lower.includes("emergency") ||
          lower.includes(" er") ||
          lower.startsWith("er")
        ) {

          title =
            "🚨 Nearby emergency departments";

          mode =
            "text";

          query =
            "hospital emergency department";
        }


        // -----------------------------------
        // UPCC / urgent care
        // -----------------------------------
        else if (
          lower.includes("upcc") ||
          lower.includes("urgent")
        ) {

          title =
            "🏥 Nearby urgent care centres";

          mode =
            "text";

          query =
            "urgent primary care centre";
        }


        // -----------------------------------
        // Pharmacy / pharmacist
        // -----------------------------------
        else if (
          lower.includes("pharmacist") ||
          lower.includes("pharmacy")
        ) {

          title =
            "💊 Nearby pharmacies";

          mode =
            "nearby";

          query =
            "pharmacy";
        }


        // -----------------------------------
        // Run Places API (New)
        // -----------------------------------
        list.innerHTML = `
          <p class="gpsmsg">
            Searching nearby care...
          </p>
        `;


        const results =
          await searchPlaces(
            lat,
            lng,
            mode,
            query
          );


        // -----------------------------------
        // Show results
        // -----------------------------------
        list.innerHTML =
          renderPlaceGroup(
            title,
            results
          );


      } catch (error) {

        console.error(
          "Nearby care search failed:",
          error
        );

        list.innerHTML = `
          <div class="place">

            <strong>
              Nearby search failed.
            </strong>

            <p class="gpsmsg">
              Please try again.
            </p>

          </div>
        `;
      }

    },


    // -----------------------------------
    // Geolocation error
    // -----------------------------------
    error => {

      console.error(
        "Location error:",
        error
      );

      status.innerHTML = `
        <p class="gpsmsg">
          Location permission was not available.
        </p>
      `;

    },


    // -----------------------------------
    // Location settings
    // -----------------------------------
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000
    }

  );
}
