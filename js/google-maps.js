/* ---------- Google Maps API ---------- */
(function(){
  const GOOGLE_MAPS_API_KEY='AIzaSyA-pnQ_tYg4HEk_DsQnkQ-cwYbMs_6Y_ms';

  if(!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY==='YOUR_GOOGLE_MAPS_API_KEY'){
    console.warn('Add your Google Maps API key.');
    return;
  }

  const s=document.createElement('script');

  s.src=`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;

  s.async=true;
  s.defer=true;

  document.head.appendChild(s);
})();
