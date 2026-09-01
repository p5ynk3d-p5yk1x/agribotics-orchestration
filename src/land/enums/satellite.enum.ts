export enum SatelliteProvider {
  GOOGLE_EARTH_ENGINE = 'GOOGLE_EARTH_ENGINE',
}

export enum SatelliteDataset {
  SENTINEL_2 = 'SENTINEL_2',
}

export enum SatelliteObservationStatus {
  SUCCESS = 'SUCCESS',
  NO_DATA = 'NO_DATA',
  TEMPORARILY_UNAVAILABLE = 'TEMPORARILY_UNAVAILABLE',
  FAILED = 'FAILED',
}

export enum SatelliteMapLayer {
  NDVI_HEATMAP = 'NDVI_HEATMAP',
  NDMI_HEATMAP = 'NDMI_HEATMAP',
}