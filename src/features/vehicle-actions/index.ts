// Public API: only what other features and pages use. Feature internals (API calls, query
// options, the form) are imported relatively inside the feature.
export { vehicleKeys } from './api/vehicle-detail.queries';
export { VehicleDetailDialog } from './components/VehicleDetailDialog';
export { useVehicleSelection } from './hooks/useVehicleSelection';
