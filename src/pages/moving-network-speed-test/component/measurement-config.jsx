import React, { useState } from 'react';

export const defaultMeasurements = [
  { type: 'latency', numPackets: 1 },
  { type: 'download', bytes: 1e5, count: 1, bypassMinDuration: true },
  { type: 'latency', numPackets: 20 },
  { type: 'download', bytes: 1e5, count: 6 },
  { type: 'download', bytes: 1e6, count: 5 },
  { type: 'upload', bytes: 1e5, count: 5 },
  { type: 'upload', bytes: 1e6, count: 4 },
  { type: 'download', bytes: 1e7, count: 4 },
  { type: 'upload', bytes: 1e7, count: 3 },
  { type: 'download', bytes: 2.5e7, count: 4 },
  { type: 'upload', bytes: 2.5e7, count: 3 },
  { type: 'download', bytes: 5e7, count: 4 },
  { type: 'upload', bytes: 5e7, count: 3 },
  { type: 'download', bytes: 1e8, count: 4 },
  { type: 'upload', bytes: 1e8, count: 3 },
  { type: 'download', bytes: 2.5e8, count: 3 },
  { type: 'upload', bytes: 1.5e8, count: 2 }
];

const labelCls = "block text-sm font-medium text-gray-700 mb-1";
const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50";
const selectCls = inputCls;
const helpCls = "text-xs text-gray-500 mt-1";

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
        const updated = { ...advancedConfig, [field]: Number(value) };
        setAdvancedConfig(updated);
        if (onAdvancedConfigUpdate) {
            onAdvancedConfigUpdate(updated);
        }
    };

    return (
        <details className="rounded-xl border border-gray-100 shadow-card bg-white">
            <summary className="px-4 py-3 cursor-pointer font-medium text-gray-900 text-sm select-none hover:bg-gray-50 rounded-xl transition-colors">
                Manual Test Configuration
            </summary>
            <div className="px-4 pb-4 pt-2">
                <div className="mb-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="dynamic-measurements"
                            checked={dynamicEnabled}
                            onChange={(e) => onDynamicToggle && onDynamicToggle(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="dynamic-measurements" className="text-sm text-gray-700">
                            Enable dynamic test sizing (adapts based on recent results)
                        </label>
                    </div>
                    <p className={helpCls}>
                        When enabled, test sizes automatically adjust based on your connection performance.
                        Disable to use manual configuration below.
                    </p>
                </div>

                {!dynamicEnabled && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <small className="text-blue-700 text-xs">Dynamic sizing is disabled. Using manual configuration below.</small>
                    </div>
                )}

                {measurements.map((measurement, index) => (
                    <div key={index} className={`mb-3 p-3 border border-gray-200 rounded-lg ${dynamicEnabled ? 'opacity-50' : ''}`}>
                        <div className="mb-2">
                            <label className={labelCls}>Type</label>
                            <select
                                value={measurement.type}
                                onChange={(e) => handleMeasurementUpdate(index, 'type', e.target.value)}
                                disabled={dynamicEnabled}
                                className={selectCls}
                            >
                                <option value="latency">Latency</option>
                                <option value="download">Download</option>
                                <option value="upload">Upload</option>
                            </select>
                        </div>

                        {measurement.type === 'latency' ? (
                            <div>
                                <label className={labelCls}>Number of Packets</label>
                                <input
                                    type="number"
                                    value={measurement.numPackets}
                                    onChange={(e) => handleMeasurementUpdate(index, 'numPackets', e.target.value)}
                                    disabled={dynamicEnabled}
                                    className={inputCls}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="mb-2">
                                    <label className={labelCls}>Bytes</label>
                                    <input
                                        type="number"
                                        value={measurement.bytes}
                                        onChange={(e) => handleMeasurementUpdate(index, 'bytes', e.target.value)}
                                        disabled={dynamicEnabled}
                                        className={inputCls}
                                    />
                                </div>
                                <div className="mb-2">
                                    <label className={labelCls}>Count</label>
                                    <input
                                        type="number"
                                        value={measurement.count}
                                        onChange={(e) => handleMeasurementUpdate(index, 'count', e.target.value)}
                                        disabled={dynamicEnabled}
                                        className={inputCls}
                                    />
                                </div>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => removeMeasurement(index)}
                            disabled={dynamicEnabled}
                            className="px-3 py-1 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Remove
                        </button>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={addMeasurement}
                    disabled={dynamicEnabled}
                    className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add Measurement
                </button>

                <hr className="my-4 border-gray-200" />

                <div className="mb-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="advanced-config"
                            checked={!advancedConfigEnabled}
                            onChange={(e) => onAdvancedConfigToggle && onAdvancedConfigToggle(!e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label htmlFor="advanced-config" className="text-sm text-gray-700">
                            Override adaptive test thresholds (advanced)
                        </label>
                    </div>
                    <p className={helpCls}>
                        When unchecked, thresholds automatically adapt based on network quality.
                        Check to manually configure below.
                    </p>
                </div>

                {advancedConfigEnabled && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                        <small className="text-yellow-700 text-xs"><strong>Advanced Configuration Active</strong> — Manual thresholds will override automatic adaptation.</small>
                    </div>
                )}

                <div className={advancedConfigEnabled ? '' : 'opacity-50'}>
                    <div className="mb-3">
                        <label className={labelCls}>Bandwidth Finish Duration (ms)</label>
                        <input
                            type="number"
                            value={advancedConfig.bandwidthFinishRequestDuration}
                            onChange={(e) => handleAdvancedConfigChange('bandwidthFinishRequestDuration', e.target.value)}
                            disabled={!advancedConfigEnabled}
                            min="100" max="5000" step="100"
                            className={inputCls}
                        />
                        <p className={helpCls}>
                            How long a request must take before moving to larger files.
                            Lower = faster ramp-up (good for fast connections).
                            Higher = more patient (good for high-latency connections).
                            Default: 400ms (good), 800ms (fair/5G), 3000ms (poor/satellite).
                        </p>
                    </div>

                    <div className="mb-3">
                        <label className={labelCls}>Minimum Request Duration (ms)</label>
                        <input
                            type="number"
                            value={advancedConfig.bandwidthMinRequestDuration}
                            onChange={(e) => handleAdvancedConfigChange('bandwidthMinRequestDuration', e.target.value)}
                            disabled={!advancedConfigEnabled}
                            min="1" max="100" step="1"
                            className={inputCls}
                        />
                        <p className={helpCls}>
                            Minimum duration to consider a measurement valid.
                            Lower = accepts faster measurements (good for gigabit).
                            Higher = more conservative (good for consistency).
                            Default: 5ms (good), 10ms (fair/5G), 50ms (poor/satellite).
                        </p>
                    </div>

                    <div className="mb-3">
                        <label className={labelCls}>Loaded Request Duration (ms)</label>
                        <input
                            type="number"
                            value={advancedConfig.loadedRequestMinDuration}
                            onChange={(e) => handleAdvancedConfigChange('loadedRequestMinDuration', e.target.value)}
                            disabled={!advancedConfigEnabled}
                            min="50" max="1000" step="50"
                            className={inputCls}
                        />
                        <p className={helpCls}>
                            How long before considering connection "loaded" for latency measurements.
                            Lower = faster loaded detection.
                            Higher = more time to stabilize.
                            Default: 100ms (good), 200ms (fair/5G), 1000ms (poor/satellite).
                        </p>
                    </div>
                </div>
            </div>
        </details>
    );
};

export default MeasurementConfig;
