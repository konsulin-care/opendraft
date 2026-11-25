/// <reference types="vite-plugin-pwa/react" />
/**
 * Re-export the PWA registration hook so the rest of the app depends on this
 * local module rather than the Vite virtual module directly.
 */
export { useRegisterSW } from 'virtual:pwa-register/react';
