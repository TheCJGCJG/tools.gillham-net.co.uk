/* eslint-disable no-restricted-globals */

// Network Quality Worker
// Handles connectivity checks and quality assessment

self.onmessage = async (e) => {
    const { type, timeout = 5000 } = e.data;

    if (type === 'check-connectivity') {
        try {
            const result = await checkNetworkConnectivity(timeout);
            self.postMessage({ type: 'complete', result });
        } catch (error) {
            self.postMessage({ type: 'error', error: error.message });
        }
    }
};

async function checkNetworkConnectivity(timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const startTime = Date.now();

    // Use multiple endpoints for better reliability
    const endpoints = [
        'https://www.google.com/favicon.ico',
        'https://www.cloudflare.com/favicon.ico',
        'https://httpbin.org/status/200'
    ];

    try {
        // Try the first endpoint
        // Note: In a worker, we can use fetch directly
        await fetch(endpoints[0], {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseTime = Date.now() - startTime;

        // Quality assessment
        let quality;
        if (responseTime > 2000) {
            quality = 'poor';
        } else if (responseTime > 500) {
            quality = 'fair';
        } else {
            quality = 'good';
        }

        // Fetch public IP address
        let ipAddress = null;
        try {
            const ipResponse = await fetch('https://icanhazip.com', { cache: 'no-cache' });
            if (ipResponse.ok) {
                ipAddress = (await ipResponse.text()).trim();
            }
        } catch (_) {
            // IP fetch is best-effort, don't fail connectivity check
        }

        return {
            online: true,
            responseTime,
            quality,
            ipAddress
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            return { online: true, responseTime: timeout, quality: 'poor' };
        }
        return { online: false, responseTime: null, quality: 'offline', error: error.message };
    }
}
