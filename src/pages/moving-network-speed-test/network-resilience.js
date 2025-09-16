/**
 * Network Resilience Utilities
 * Handles network-specific optimizations and error recovery patterns
 */

export class NetworkResilience {
    static detectIOSSafari() {
        const ua = navigator.userAgent;
        const iOS = /iPad|iPhone|iPod/.test(ua);
        const webkit = /WebKit/.test(ua);
        const safari = /Safari/.test(ua) && !/Chrome/.test(ua);
        return iOS && webkit && safari;
    }

    static detectSlowConnection() {
        // Use Network Information API if available
        if ('connection' in navigator) {
            const connection = navigator.connection;
            const slowTypes = ['slow-2g', '2g', '3g'];
            return slowTypes.includes(connection.effectiveType);
        }
        return false;
    }

    static getOptimalTimeout(baseTimeout, isIOSSafari = false, networkQuality = 'good') {
        let timeout = baseTimeout;
        
        if (isIOSSafari) {
            timeout = Math.min(timeout, 45000); // iOS Safari has stricter limits
        }
        
        switch (networkQuality) {
            case 'poor':
                timeout *= 2;
                break;
            case 'fair':
                timeout *= 1.5;
                break;
            default:
                break;
        }
        
        return timeout;
    }

    static getRetryDelay(attempt, baseDelay = 5000, networkQuality = 'good') {
        let delay = baseDelay;
        
        if (networkQuality === 'poor') {
            delay *= 2;
        }
        
        // Exponential backoff with jitter
        const exponentialDelay = delay * Math.pow(1.5, attempt - 1);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        
        return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
    }

    static async withTimeout(promise, timeoutMs, errorMessage = 'Operation timed out') {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        });
        
        return Promise.race([promise, timeoutPromise]);
    }

    static async checkNetworkConnectivity(timeout = 5000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const startTime = Date.now();
            
            // Use multiple endpoints for better reliability
            const endpoints = [
                'https://www.google.com/favicon.ico',
                'https://www.cloudflare.com/favicon.ico',
                'https://httpbin.org/status/200'
            ];
            
            // Try the first endpoint
            await fetch(endpoints[0], {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const responseTime = Date.now() - startTime;
            
            return {
                online: true,
                responseTime,
                quality: responseTime > 3000 ? 'poor' : 
                        responseTime > 1000 ? 'fair' : 'good'
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                return { online: true, responseTime: timeout, quality: 'poor' };
            }
            return { online: false, responseTime: null, quality: 'offline' };
        }
    }

    static getGeolocationOptions(isIOSSafari = false) {
        return {
            enableHighAccuracy: !isIOSSafari, // Battery optimization for iOS
            timeout: isIOSSafari ? 15000 : 5000,
            maximumAge: isIOSSafari ? 30000 : 0 // Allow cached position on iOS
        };
    }

    static handleVisibilityChange(callback) {
        const handleChange = () => {
            if (document.hidden) {
                callback('hidden');
            } else {
                callback('visible');
            }
        };
        
        document.addEventListener('visibilitychange', handleChange);
        
        // Return cleanup function
        return () => document.removeEventListener('visibilitychange', handleChange);
    }

    static createAbortablePromise(executor) {
        let abortController = new AbortController();
        
        const promise = new Promise((resolve, reject) => {
            const wrappedResolve = (value) => {
                if (!abortController.signal.aborted) {
                    resolve(value);
                }
            };
            
            const wrappedReject = (error) => {
                if (!abortController.signal.aborted) {
                    reject(error);
                }
            };
            
            abortController.signal.addEventListener('abort', () => {
                reject(new Error('Operation was aborted'));
            });
            
            executor(wrappedResolve, wrappedReject, abortController.signal);
        });
        
        promise.abort = () => {
            abortController.abort();
        };
        
        return promise;
    }

    static async retryWithBackoff(operation, maxAttempts = 3, baseDelay = 1000, networkQuality = 'good') {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation(attempt);
            } catch (error) {
                lastError = error;
                
                if (attempt === maxAttempts) {
                    throw error;
                }
                
                const delay = this.getRetryDelay(attempt, baseDelay, networkQuality);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

export default NetworkResilience;