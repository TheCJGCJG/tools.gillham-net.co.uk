import React, { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';

export const defaultMeasurements = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e5, count: 6 }, // Reduced count to move faster
  { type: 'download', bytes: 1e6, count: 5 },
  { type: 'upload', bytes: 1e5, count: 5 },
  { type: 'upload', bytes: 1e6, count: 4 },
  { type: 'download', bytes: 1e7, count: 4 },
  { type: 'upload', bytes: 1e7, count: 3 },
  { type: 'download', bytes: 2.5e7, count: 4 },
  { type: 'upload', bytes: 2.5e7, count: 3 },
  { type: 'download', bytes: 5e7, count: 4 }, // 50MB
  { type: 'upload', bytes: 5e7, count: 3 },
  { type: 'download', bytes: 1e8, count: 4 }, // 100MB for gigabit
  { type: 'upload', bytes: 1e8, count: 3 },
  { type: 'download', bytes: 2.5e8, count: 3 }, // 250MB for gigabit+
  { type: 'upload', bytes: 1.5e8, count: 2 }
];



export const MeasurementConfig = ({ 
    onConfigUpdate, 
    onDynamicToggle, 
    dynamicEnabled = true,
    onAdvancedConfigUpdate,
    advancedConfigEnabled = false,
    onAdvancedConfigToggle
}) => {
    const [measurements, setMeasurements] = useState(defaultMeasurements);
    const [advancedConfig, setAdvancedConfig] = useState({
        bandwidthFinishRequestDuration: 400,
        bandwidthMinRequestDuration: 5,
        loadedRequestMinDuration: 100
    });
  
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

    const handleAdvancedConfigChange = (field, value) => {
      const updated = {
        ...advancedConfig,
        [field]: Number(value)
      };
      setAdvancedConfig(updated);
      if (onAdvancedConfigUpdate) {
        onAdvancedConfigUpdate(updated);
      }
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

            <hr className="my-4" />

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="advanced-config"
                label="Override adaptive test thresholds (advanced)"
                checked={!advancedConfigEnabled}
                onChange={(e) => onAdvancedConfigToggle && onAdvancedConfigToggle(!e.target.checked)}
              />
              <Form.Text className="text-muted">
                When unchecked, thresholds automatically adapt based on network quality. 
                Check to manually configure below.
              </Form.Text>
            </Form.Group>

            {advancedConfigEnabled && (
              <div className="alert alert-warning">
                <small><strong>Advanced Configuration Active</strong> - Manual thresholds will override automatic adaptation.</small>
              </div>
            )}

            <div className={advancedConfigEnabled ? '' : 'opacity-50'}>
              <Form.Group className="mb-3">
                <Form.Label>Bandwidth Finish Duration (ms)</Form.Label>
                <Form.Control
                  type="number"
                  value={advancedConfig.bandwidthFinishRequestDuration}
                  onChange={(e) => handleAdvancedConfigChange('bandwidthFinishRequestDuration', e.target.value)}
                  disabled={!advancedConfigEnabled}
                  min="100"
                  max="5000"
                  step="100"
                />
                <Form.Text className="text-muted">
                  How long a request must take before moving to larger files. 
                  Lower = faster ramp-up (good for fast connections). 
                  Higher = more patient (good for high-latency connections).
                  Default: 400ms (good), 800ms (fair/5G), 3000ms (poor/satellite).
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Minimum Request Duration (ms)</Form.Label>
                <Form.Control
                  type="number"
                  value={advancedConfig.bandwidthMinRequestDuration}
                  onChange={(e) => handleAdvancedConfigChange('bandwidthMinRequestDuration', e.target.value)}
                  disabled={!advancedConfigEnabled}
                  min="1"
                  max="100"
                  step="1"
                />
                <Form.Text className="text-muted">
                  Minimum duration to consider a measurement valid. 
                  Lower = accepts faster measurements (good for gigabit). 
                  Higher = more conservative (good for consistency).
                  Default: 5ms (good), 10ms (fair/5G), 50ms (poor/satellite).
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Loaded Request Duration (ms)</Form.Label>
                <Form.Control
                  type="number"
                  value={advancedConfig.loadedRequestMinDuration}
                  onChange={(e) => handleAdvancedConfigChange('loadedRequestMinDuration', e.target.value)}
                  disabled={!advancedConfigEnabled}
                  min="50"
                  max="1000"
                  step="50"
                />
                <Form.Text className="text-muted">
                  How long before considering connection "loaded" for latency measurements. 
                  Lower = faster loaded detection. 
                  Higher = more time to stabilize.
                  Default: 100ms (good), 200ms (fair/5G), 1000ms (poor/satellite).
                </Form.Text>
              </Form.Group>
            </div>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    );
  };

export default MeasurementConfig;
