import { v4 as uuidv4 } from 'uuid';

const isError = (e) => e && e.stack && e.message;

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

export class RunContainer {
    #testRuns;
    #id;
    #create_time;
    #name;
    #description;

    constructor(id = undefined, createTime = undefined) {
        this.#testRuns = new Map();
        this.#id = id || uuidv4();
        this.#create_time = createTime || Date.now();
    }

    /**
     * @returns {string} ID
     */
    getId() {
        return this.#id;
    }

    /**
     * @returns {number} Creation time
     */
    getCreateTime() {
        return this.#create_time;
    }

    /**
     * Sets the name of the container
     * @param {string} name - The name to set
     */
    setName(name) {
        this.#name = name;
    }

    /**
     * Sets the description of the container
     * @param {string} description - The description to set
     */
    setDescription(description) {
        this.#description = description;
    }
    /**
     * Gets the name of the container
     * @returns {string} The name of the container
     */
    getName() {
        return this.#name;
    }
    
    /**
     * 
     * @returns {string} description - The description
     */
    getDescription() {
        return this.#description;
    }

    /**
     * Adds a TestRun instance to the container
     * @param {TestRun} testRun - The TestRun instance to add
     * @throws {Error} If the parameter is not a TestRun instance
     */
    addTestRun(testRun) {
        if (!(testRun instanceof TestRun)) {
            throw new Error('Parameter must be an instance of TestRun');
        }
        this.#testRuns.set(testRun.getId(), testRun);
    }

    /**
     * Removes a TestRun by its ID
     * @param {string} id - The ID of the TestRun to remove
     * @returns {boolean} True if the TestRun was found and removed, false otherwise
     */
    removeTestRun(id) {
        return this.#testRuns.delete(id);
    }

    /**
     * Returns all TestRun instances ordered by start timestamp ascending
     * @returns {TestRun[]} Array of TestRun instances
     */
    getAllTestRuns() {
        return Array.from(this.#testRuns.values())
            .sort((a, b) => {
                const timestampA = new Date(a.getStartTimestamp()).getTime();
                const timestampB = new Date(b.getStartTimestamp()).getTime();
                return timestampA - timestampB;
            });
    }

    /**
     * Returns the N most recent TestRun instances ordered by start timestamp descending
     * @param {number} n - The number of most recent TestRuns to return
     * @returns {TestRun[]} Array of the N most recent TestRun instances
     * @throws {Error} If n is not a positive number
     */
    getLastN(n) {
        if (!Number.isInteger(n) || n <= 0) {
            throw new Error('Parameter must be a positive integer');
        }

        return Array.from(this.#testRuns.values())
            .sort((a, b) => {
                const timestampA = new Date(a.getStartTimestamp()).getTime();
                const timestampB = new Date(b.getStartTimestamp()).getTime();
                return timestampB - timestampA; // Note the reverse order compared to getAllTestRuns
            })
            .slice(0, n);
    }


    /**
     * Returns all TestRuns as plain objects ordered by start timestamp ascending
     * @returns {Object[]} Array of TestRun objects
     */
    getAllTestRunObjects() {
        return this.getAllTestRuns()
            .map(testRun => testRun.getObject());
    }

    /**
     * Returns the count of TestRuns in the container
     * @returns {number} Number of TestRuns
     */
    getCount() {
        return this.#testRuns.size;
    }
}

export class SessionStorage {
    #STORAGE_KEY_PREFIX;
    #EXPIRY_DAYS;
    
    constructor() {
        this.#STORAGE_KEY_PREFIX = 'network_test_session_';
        this.#EXPIRY_DAYS = 30;
    }

    /**
     * Saves a Session to localStorage
     * @param {Session} session - The session to save
     */
    saveSession(session) {
        if (!(session instanceof Session)) {
            throw new Error('Parameter must be an instance of Session');
        }

        const storageItem = {
            data: session.getObject(),
            timestamp: Date.now(),
            expiryTime: Date.now() + (this.#EXPIRY_DAYS * 24 * 60 * 60 * 1000)
        };

        localStorage.setItem(
            this.#STORAGE_KEY_PREFIX + session.getId(),
            JSON.stringify(storageItem)
        );
    }

    /**
     * Retrieves a Session from localStorage
     * @param {string} id - The ID of the session to retrieve
     * @returns {Session|null} The retrieved session or null if not found
     */
    getSession(id) {
        const item = localStorage.getItem(this.#STORAGE_KEY_PREFIX + id);
        if (!item) return null;

        const parsed = JSON.parse(item);
        
        // Check if expired
        if (Date.now() > parsed.expiryTime) {
            this.removeSession(id);
            return null;
        }

        return new Session(parsed.data);
    }

    /**
     * Lists all saved sessions
     * @returns {Session[]} Array of Session instances
     */
    listSessions() {
        const sessions = [];
        this.#removeExpiredItems();

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.#STORAGE_KEY_PREFIX)) {
                const sessionId = key.replace(this.#STORAGE_KEY_PREFIX, '');
                const session = this.getSession(sessionId);
                if (session) {
                    sessions.push(session);
                }
            }
        }

        // Sort sessions by start time (newest first)
        return sessions.sort((a, b) => b.getStartTime() - a.getStartTime());
    }

    /**
     * Removes a session from localStorage
     * @param {string} id - The ID of the session to remove
     */
    removeSession(id) {
        localStorage.removeItem(this.#STORAGE_KEY_PREFIX + id);
    }

    /**
     * Clears all saved sessions
     */
    clearAll() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.#STORAGE_KEY_PREFIX)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }

    /**
     * Exports sessions to JSON
     * @param {string[]} ids - Array of session IDs to export (optional)
     * @returns {string} JSON string of exported sessions
     */
    exportToJson(ids = null) {
        const sessions = [];
        
        if (ids) {
            ids.forEach(id => {
                const session = this.getSession(id);
                if (session) {
                    sessions.push(session.getObject());
                }
            });
        } else {
            this.listSessions().forEach(session => {
                sessions.push(session.getObject());
            });
        }

        return JSON.stringify(sessions, null, 2);
    }

    /**
     * Removes expired items from localStorage
     * @private
     */
    #removeExpiredItems() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(this.#STORAGE_KEY_PREFIX)) {
                try {
                    const item = JSON.parse(localStorage.getItem(key));
                    if (Date.now() > item.expiryTime) {
                        keys.push(key);
                    }
                } catch (error) {
                    // Remove corrupted items
                    keys.push(key);
                }
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }
}

export class RunContainerStorage {
    #STORAGE_KEY_PREFIX;
    #EXPIRY_DAYS;
    constructor() {
        this.#STORAGE_KEY_PREFIX = 'network_test_run_';
        this.#EXPIRY_DAYS = 30;
    }


    /**
     * Saves a RunContainer to localStorage
     * @param {RunContainer} container - The container to save
     * @throws {Error} If the parameter is not a RunContainer instance
     */
    saveContainer(container) {
        if (!(container instanceof RunContainer)) {
            throw new Error('Parameter must be an instance of RunContainer');
        }

        const storageItem = {
            data: {
                id: container.getId(),
                createTime: container.getCreateTime(),
                name: container.getName(),
                description: container.getDescription(),
                testRuns: container.getAllTestRunObjects()
            },
            timestamp: Date.now(),
            expiryTime: Date.now() + (this.#EXPIRY_DAYS * 24 * 60 * 60 * 1000)
        };

        localStorage.setItem(
            this.#STORAGE_KEY_PREFIX + container.getId(),
            JSON.stringify(storageItem)
        );
    }

    /**
     * Retrieves a RunContainer from localStorage
     * @param {string} id - The ID of the container to retrieve
     * @returns {RunContainer|null} The retrieved container or null if not found
     */
    getContainer(id) {
        const item = localStorage.getItem(this.#STORAGE_KEY_PREFIX + id);
        if (!item) return null;

        const parsed = JSON.parse(item);
        
        // Check if expired
        if (Date.now() > parsed.expiryTime) {
            this.removeContainer(id);
            return null;
        }

        const container = new RunContainer(parsed.data.id, parsed.data.createTime);
        container.setName(parsed.data.name);
        container.setDescription(parsed.data.description);

        // Reconstruct test runs
        parsed.data.testRuns.forEach(testRunData => {
            const testRun = new TestRun(testRunData);
            container.addTestRun(testRun);
        });

        return container;
    }

    /**
     * Lists all saved containers
     * @returns {RunContainer[]} Array of RunContainer instances
     */
    listContainers() {
        const containers = [];
        this.#removeExpiredItems();

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.#STORAGE_KEY_PREFIX)) {
                const containerId = key.replace(this.#STORAGE_KEY_PREFIX, '');
                const container = this.getContainer(containerId);
                if (container) {
                    containers.push(container);
                }
            }
        }

        // Sort containers by creation time (newest first)
        return containers.sort((a, b) => b.getCreateTime() - a.getCreateTime());
    }


    /**
     * Removes a container from localStorage
     * @param {string} id - The ID of the container to remove
     */
    removeContainer(id) {
        localStorage.removeItem(this.#STORAGE_KEY_PREFIX + id);
    }

    /**
     * Clears all saved containers
     */
    clearAll() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.#STORAGE_KEY_PREFIX)) {
                keys.push(key);
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }

    /**
     * Exports containers to JSON
     * @param {string[]} ids - Array of container IDs to export (optional)
     * @returns {string} JSON string of exported containers
     */
    exportToJson(ids = null) {
        const containers = [];
        
        if (ids) {
            ids.forEach(id => {
                const container = this.getContainer(id);
                if (container) {
                    containers.push(container);
                }
            });
        } else {
            this.listContainers().forEach(info => {
                const container = this.getContainer(info.id);
                if (container) {
                    containers.push(container);
                }
            });
        }

        return JSON.stringify(containers);
    }

    /**
     * Imports containers from JSON
     * @param {string} jsonString - JSON string to import
     * @returns {number} Number of containers imported
     */
    importFromJson(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            if (!Array.isArray(data)) {
                throw new Error('Invalid import format');
            }

            let importCount = 0;
            data.forEach(containerData => {
                const container = new RunContainer();
                container.setName(containerData.name);
                container.setDescription(containerData.description);

                if (Array.isArray(containerData.testRuns)) {
                    containerData.testRuns.forEach(testRunData => {
                        const testRun = new TestRun(testRunData);
                        container.addTestRun(testRun);
                    });
                }

                this.saveContainer(container);
                importCount++;
            });

            return importCount;
        } catch (error) {
            throw new Error('Failed to import containers: ' + error.message);
        }
    }

    /**
     * Removes expired items from localStorage
     * @private
     */
    #removeExpiredItems() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.#STORAGE_KEY_PREFIX)) {
                const item = JSON.parse(localStorage.getItem(key));
                if (Date.now() > item.expiryTime) {
                    keys.push(key);
                }
            }
        }
        keys.forEach(key => localStorage.removeItem(key));
    }
}
