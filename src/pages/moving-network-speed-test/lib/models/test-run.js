import { v4 as uuidv4 } from 'uuid';

const isError = (e) => e && e.stack && e.message;

/**
 * Represents a single test run with results and metadata
 */
export class TestRun {
    #id;
    #startTimestamp;
    #endTimestamp;
    #location;
    #results;
    #success;
    #error;

    constructor(params) {
        this.setId(params.id || uuidv4());
        this.setStartTimestamp(params.start_timestamp);
        this.setEndTimestamp(params.end_timestamp);
        this.setLocation(params.location);

        // Determine success based on results and error
        const hasValidResults = params.results && !isError(params.results);
        const hasError = params.error || isError(params.results);
        this.setSuccess(hasValidResults && !hasError);

        if (this.getSuccess() && params.results) {
            this.setResults({
                downloadBandwidth: params.results.downloadBandwidth,
                downloadLoadedLatency: params.results.downloadLoadedLatency,
                unloadedLatency: params.results.unloadedLatency,
                unloadedJitter: params.results.unloadedJitter,
                uploadBandwidth: params.results.uploadBandwidth,
                uploadLoadedLatency: params.results.uploadLoadedLatency
            });
            this.setError(null);
        } else {
            this.setError(params.error || (isError(params.results) ? params.results.message : 'Unknown error'));
            this.setResults(null);
        }
    }

    // Getters
    getId() {
        return this.#id;
    }

    getStartTimestamp() {
        return this.#startTimestamp;
    }

    getEndTimestamp() {
        return this.#endTimestamp;
    }

    getLocation() {
        return this.#location;
    }

    getResults() {
        return this.#results;
    }

    getSuccess() {
        return this.#success;
    }

    getError() {
        return this.#error;
    }

    getObject() {
        return {
            id: this.#id,
            start_timestamp: this.#startTimestamp,
            end_timestamp: this.#endTimestamp,
            location: this.#location,
            success: this.#success,
            error: this.#error,
            results: this.#results
        }
    }

    // Setters
    setId(id) {
        this.#id = id;
    }

    setStartTimestamp(timestamp) {
        this.#startTimestamp = timestamp;
    }

    setEndTimestamp(timestamp) {
        this.#endTimestamp = timestamp;
    }

    setLocation(location) {
        this.#location = location;
    }

    setSuccess(success) {
        this.#success = success;
    }

    setError(error) {
        this.#error = error;
    }

    setResults(results) {
        if (results === null) {
            this.#results = null;
            return;
        }

        // Validate that all required properties are present
        const requiredProperties = [
            'downloadBandwidth',
            'downloadLoadedLatency',
            'unloadedLatency',
            'unloadedJitter',
            'uploadBandwidth',
            'uploadLoadedLatency'
        ];

        const missingProperties = requiredProperties.filter(prop => !(prop in results));

        if (missingProperties.length > 0) {
            throw new Error(`Missing required properties: ${missingProperties.join(', ')}`);
        }

        this.#results = results;
    }
}
