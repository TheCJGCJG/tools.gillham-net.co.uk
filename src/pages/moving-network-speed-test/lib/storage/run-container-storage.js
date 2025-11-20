import { RunContainer } from '../models/run-container.js';
import { TestRun } from '../models/test-run.js';

/**
 * Manages RunContainer persistence in localStorage
 */
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
