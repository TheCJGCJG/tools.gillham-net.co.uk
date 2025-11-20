import { Session } from '../models/session.js';

/**
 * Manages session persistence in localStorage
 */
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
