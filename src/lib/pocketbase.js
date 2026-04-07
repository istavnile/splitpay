import PocketBase from 'pocketbase';

// PocketBase will be reachable at the same host in production via Nginx proxy /api/
const url = window.APP_CONFIG?.POCKETBASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8090' : window.location.origin);
console.log('SplitPay - Initializing PocketBase with URL:', url);
const pb = new PocketBase(url);

// Handle runtime configuration injection from Nginx/envsubst if needed
// (Though PocketBase is usually just at / on a separate port or subpath)

export default pb;
