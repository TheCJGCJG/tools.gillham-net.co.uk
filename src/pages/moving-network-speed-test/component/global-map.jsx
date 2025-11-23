import React from 'react';
import TestRunMap from './test-run-map';
import { Card } from 'react-bootstrap';

const GlobalMap = ({ sessions, currentSession, currentPosition }) => {
    // Combine all sessions including the current active session
    const allSessions = [...sessions];
    
    // Add current session if it exists and isn't already in the list
    if (currentSession && !sessions.find(s => s.getId() === currentSession.getId())) {
        allSessions.unshift(currentSession);
    }
    
    return (
        <Card>
            <Card.Header>
                <h5 className="mb-0">
                    Global Network Coverage Map
                    <small className="text-muted ms-2">
                        ({allSessions.reduce((total, session) => total + session.getCount(), 0)} total tests)
                    </small>
                </h5>
            </Card.Header>
            <Card.Body>
                <TestRunMap sessions={allSessions} currentPosition={currentPosition} />
            </Card.Body>
        </Card>
    );
};

export default GlobalMap;