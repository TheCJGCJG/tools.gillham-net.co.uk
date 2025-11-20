import { v4 as uuidv4 } from 'uuid';
import { TestRun } from './test-run.js';

/**
 * Container for test runs (legacy support)
 */
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
