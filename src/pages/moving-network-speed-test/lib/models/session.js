import { v4 as uuidv4 } from 'uuid';
import { TestRun } from './test-run.js';

/**
 * Represents a testing session containing multiple test runs
 */
export class Session {
    #id;
    #name;
    #description;
    #startTime;
    #endTime;
    #testRuns;
    #isActive;
    #testInterval;
    #measurements;

    constructor(params = {}) {
        this.#id = params.id || uuidv4();
        this.#name = params.name || `Session ${new Date().toLocaleString()}`;
        this.#description = params.description || '';
        this.#startTime = params.startTime || Date.now();
        this.#endTime = params.endTime || null;
        this.#testRuns = new Map();
        this.#isActive = params.isActive !== undefined ? params.isActive : true;
        this.#testInterval = params.testInterval || 30000;
        this.#measurements = params.measurements || [];

        // Load existing test runs if provided
        if (params.testRuns && Array.isArray(params.testRuns)) {
            params.testRuns.forEach(testRunData => {
                const testRun = testRunData instanceof TestRun ? testRunData : new TestRun(testRunData);
                this.#testRuns.set(testRun.getId(), testRun);
            });
        }
    }

    // Getters
    getId() { return this.#id; }
    getName() { return this.#name; }
    getDescription() { return this.#description; }
    getStartTime() { return this.#startTime; }
    getEndTime() { return this.#endTime; }
    getIsActive() { return this.#isActive; }
    getTestInterval() { return this.#testInterval; }
    getMeasurements() { return this.#measurements; }

    // Setters
    setName(name) { this.#name = name; }
    setDescription(description) { this.#description = description; }
    setEndTime(endTime) { this.#endTime = endTime; }
    setIsActive(isActive) { this.#isActive = isActive; }
    setTestInterval(interval) { this.#testInterval = interval; }
    setMeasurements(measurements) { this.#measurements = measurements; }

    // Test run management
    addTestRun(testRun) {
        if (!(testRun instanceof TestRun)) {
            throw new Error('Parameter must be an instance of TestRun');
        }
        this.#testRuns.set(testRun.getId(), testRun);
    }

    removeTestRun(id) {
        return this.#testRuns.delete(id);
    }

    getAllTestRuns() {
        return Array.from(this.#testRuns.values())
            .sort((a, b) => a.getStartTimestamp() - b.getStartTimestamp());
    }

    getLastN(n) {
        if (!Number.isInteger(n) || n <= 0) {
            throw new Error('Parameter must be a positive integer');
        }
        return Array.from(this.#testRuns.values())
            .sort((a, b) => b.getStartTimestamp() - a.getStartTimestamp())
            .slice(0, n);
    }

    getCount() {
        return this.#testRuns.size;
    }

    // Statistics
    getStats() {
        const allRuns = this.getAllTestRuns();
        const successfulRuns = allRuns.filter(run => run.getSuccess());

        if (successfulRuns.length === 0) {
            return {
                totalTests: allRuns.length,
                successfulTests: 0,
                failedTests: allRuns.length,
                avgDownload: 0,
                avgUpload: 0,
                avgLatency: 0,
                duration: this.#endTime ? this.#endTime - this.#startTime : Date.now() - this.#startTime
            };
        }

        const avgDownload = successfulRuns.reduce((sum, run) =>
            sum + (run.getResults()?.downloadBandwidth || 0), 0) / successfulRuns.length;
        const avgUpload = successfulRuns.reduce((sum, run) =>
            sum + (run.getResults()?.uploadBandwidth || 0), 0) / successfulRuns.length;
        const avgLatency = successfulRuns.reduce((sum, run) =>
            sum + (run.getResults()?.unloadedLatency || 0), 0) / successfulRuns.length;

        return {
            totalTests: allRuns.length,
            successfulTests: successfulRuns.length,
            failedTests: allRuns.length - successfulRuns.length,
            avgDownload,
            avgUpload,
            avgLatency,
            duration: this.#endTime ? this.#endTime - this.#startTime : Date.now() - this.#startTime
        };
    }

    // Session lifecycle
    start() {
        this.#isActive = true;
        this.#startTime = Date.now();
        this.#endTime = null;
    }

    stop() {
        this.#isActive = false;
        this.#endTime = Date.now();
    }

    // Serialization
    getObject() {
        return {
            id: this.#id,
            name: this.#name,
            description: this.#description,
            startTime: this.#startTime,
            endTime: this.#endTime,
            isActive: this.#isActive,
            testInterval: this.#testInterval,
            measurements: this.#measurements,
            testRuns: this.getAllTestRuns().map(run => run.getObject())
        };
    }
}
