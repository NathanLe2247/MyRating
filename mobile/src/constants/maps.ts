/**
 * Map links for a court's Directions button (see `courtDirectionsUrl` in
 * src/utils/maps.ts). Both are https URLs, so they open on any device: iOS
 * hands `maps.apple.com` to Apple Maps, Android hands Google Maps URLs to
 * the Maps app, and web opens the page in a browser tab. No custom scheme
 * (`maps://`, `geo:`) means no `canOpenURL` allow-list in app.json.
 */
export const AppleMapsBaseUrl = 'https://maps.apple.com/';

/** Google Maps URLs API, search action: https://developers.google.com/maps/documentation/urls */
export const GoogleMapsSearchUrl = 'https://www.google.com/maps/search/';
export const GoogleMapsApiVersion = '1';
