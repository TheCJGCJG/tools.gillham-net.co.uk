/**
 * Browser detection utilities
 */

/**
 * Detects if the user is on iOS Safari
 * @returns {boolean} True if running on iOS Safari
 */
export function detectIOSSafari() {
    const ua = navigator.userAgent;
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const webkit = /WebKit/.test(ua);
    const safari = /Safari/.test(ua) && !/Chrome/.test(ua);
    return iOS && webkit && safari;
}
