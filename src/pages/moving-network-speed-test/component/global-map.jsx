import React from 'react';
import TestRunMap from './test-run-map';

const GlobalMap = ({ sessions, currentSession, currentPosition }) => {
    const allSessions = [...sessions];

    if (currentSession && !sessions.find(s => s.getId() === currentSession.getId())) {
        allSessions.unshift(currentSession);
    }

    return (
        <div className="rounded-xl border border-gray-100 shadow-card bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
                <h5 className="mb-0 font-semibold text-gray-900">
                    Global Network Coverage Map
                    <small className="text-gray-500 ml-2 font-normal text-sm">
                        ({allSessions.reduce((total, session) => total + session.getCount(), 0)} total tests)
                    </small>
                </h5>
            </div>
            <div className="p-4">
                <TestRunMap sessions={allSessions} currentPosition={currentPosition} />
            </div>
        </div>
    );
};

export default GlobalMap;
