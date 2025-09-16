import React, { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';

export const defaultMeasurements = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e5, count: 9 },
  { type: 'download', bytes: 1e6, count: 8 },
  { type: 'upload', bytes: 1e5, count: 8 },
  { type: 'upload', bytes: 1e6, count: 6 },
  { type: 'download', bytes: 1e7, count: 6 },
  { type: 'upload', bytes: 1e7, count: 4 },
  { type: 'download', bytes: 2.5e7, count: 4 }
];

export const MeasurementConfig = ({ onConfigUpdate, onDynamicToggle, dynamicEnabled = true }) => {
    const [measurements, setMeasurements] = useState(defaultMeasurements);
  
    const handleMeasurementUpdate = (index, field, value) => {
      const updatedMeasurements = [...measurements];
      updatedMeasurements[index] = {
        ...updatedMeasurements[index],
        [field]: field === 'bytes' || field === 'count' || field === 'numPackets' 
          ? Number(value) 
          : value
      };
      setMeasurements(updatedMeasurements);
      onConfigUpdate(updatedMeasurements);
    };
  
    const addMeasurement = () => {
      setMeasurements([...measurements, { type: 'download', bytes: 1e5, count: 1 }]);
    };
  
    const removeMeasurement = (index) => {
      const updatedMeasurements = measurements.filter((_, i) => i !== index);
      setMeasurements(updatedMeasurements);
      onConfigUpdate(updatedMeasurements);
    };
  
    return (
      <Accordion>
        <Accordion.Item eventKey="0">
          <Accordion.Header>Manual Test Configuration</Accordion.Header>
          <Accordion.Body>
            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="dynamic-measurements"
                label="Enable dynamic test sizing (adapts based on recent results)"
                checked={dynamicEnabled}
                onChange={(e) => onDynamicToggle && onDynamicToggle(e.target.checked)}
              />
              <Form.Text className="text-muted">
                When enabled, test sizes automatically adjust based on your connection performance. 
                Disable to use manual configuration below.
              </Form.Text>
            </Form.Group>
            
            {!dynamicEnabled && (
              <div className="alert alert-info">
                <small>Dynamic sizing is disabled. Using manual configuration below.</small>
              </div>
            )}
            {measurements.map((measurement, index) => (
              <div key={index} className={`mb-3 p-3 border rounded ${dynamicEnabled ? 'opacity-50' : ''}`}>
                <Form.Group className="mb-2">
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={measurement.type}
                    onChange={(e) => handleMeasurementUpdate(index, 'type', e.target.value)}
                    disabled={dynamicEnabled}
                  >
                    <option value="latency">Latency</option>
                    <option value="download">Download</option>
                    <option value="upload">Upload</option>
                  </Form.Select>
                </Form.Group>
  
                {measurement.type === 'latency' ? (
                  <Form.Group>
                    <Form.Label>Number of Packets</Form.Label>
                    <Form.Control
                      type="number"
                      value={measurement.numPackets}
                      onChange={(e) => handleMeasurementUpdate(index, 'numPackets', e.target.value)}
                      disabled={dynamicEnabled}
                    />
                  </Form.Group>
                ) : (
                  <>
                    <Form.Group className="mb-2">
                      <Form.Label>Bytes</Form.Label>
                      <Form.Control
                        type="number"
                        value={measurement.bytes}
                        onChange={(e) => handleMeasurementUpdate(index, 'bytes', e.target.value)}
                        disabled={dynamicEnabled}
                      />
                    </Form.Group>
                    <Form.Group className="mb-2">
                      <Form.Label>Count</Form.Label>
                      <Form.Control
                        type="number"
                        value={measurement.count}
                        onChange={(e) => handleMeasurementUpdate(index, 'count', e.target.value)}
                        disabled={dynamicEnabled}
                      />
                    </Form.Group>
                  </>
                )}
                <Button 
                  variant="danger" 
                  size="sm"
                  onClick={() => removeMeasurement(index)}
                  disabled={dynamicEnabled}
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button onClick={addMeasurement} disabled={dynamicEnabled}>
              Add Measurement
            </Button>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    );
  };

export default MeasurementConfig;
