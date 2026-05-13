// Optional runtime config for static hosting.
// Fill TTS_PROXY_URL with your backend endpoint (Azure Function, etc.).
//
// Word images: Google does not allow scraping Image Search from the browser.
// To get Google’s first image result, create a Programmable Search Engine (image search)
// and paste the API key + cx here. If empty, the app falls back to Wikimedia Commons.
window.APP_CONFIG = {
  TTS_PROXY_URL: "",
  GOOGLE_CSE_API_KEY: "",
  GOOGLE_CSE_CX: ""
};
