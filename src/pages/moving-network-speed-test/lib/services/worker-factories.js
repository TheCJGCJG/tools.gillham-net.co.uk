export const createDefaultWorkers = () => {
    // Only create these when needed to avoid import.meta.url issues in Jest
    if (typeof Worker === 'undefined') {
        return null;
    }
    return {
        'network-quality': () => new Worker(new URL('../workers/network-quality.worker.js', import.meta.url)),
        'latency': () => new Worker(new URL('../workers/latency.worker.js', import.meta.url)),
        'download': () => new Worker(new URL('../workers/download.worker.js', import.meta.url)),
        'upload': () => new Worker(new URL('../workers/upload.worker.js', import.meta.url))
    };
};
