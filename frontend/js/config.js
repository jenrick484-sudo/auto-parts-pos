const CONFIG = {
  // Awtomatikong pinipili ang URL depende kung local o live site
  API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://auto-parts-pos-9pv5.onrender.com/api' // Papalitan ito pagkatapos mai-deploy ang backend sa Render
};
