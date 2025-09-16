import React from 'react';
import TestRunMap from './test-run-map';
import { Card } from 'react-bootstrap';

const GlobalMap = ({ sessions, storage }) => {
    return (
        <Card>
            <Card.Header>
                <h5 className="mb-0">
                    Global Network Coverage Map
                    <small className="text-muted ms-2">
                        ({sessions.reduce((total, session) => total + session.getCount(), 0)} total tests)
                    </small>
                </h5>
            </Card.Header>
            <Card.Body>
                <TestRunMap sessions={sessions} />
            </Card.Body>
        </Card>
    );
};

export default GlobalMap;