export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '1d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
  },
  database: {
    url: process.env.MONGODB_URI ?? process.env.DATABASE_URL,
  },
  earthEngine: {
    projectId:
      process.env.EARTH_ENGINE_PROJECT_ID ??
      process.env.GOOGLE_CLOUD_PROJECT_ID,
    clientEmail: process.env.EARTH_ENGINE_CLIENT_EMAIL,
    privateKey: process.env.EARTH_ENGINE_PRIVATE_KEY,
    refreshIntervalSeconds: Number(
      process.env.EARTH_ENGINE_REFRESH_INTERVAL_SECONDS ?? 900,
    ),
    requestTimeoutMs: Number(
      process.env.EARTH_ENGINE_REQUEST_TIMEOUT_MS ?? 30000,
    ),
    maxRetries: Number(process.env.EARTH_ENGINE_MAX_RETRIES ?? 3),
    mockEnabled: process.env.EARTH_ENGINE_MOCK_ENABLED ?? 'false',
  },
  land: {
    maxVertices: Number(process.env.LAND_MAX_VERTICES ?? 100),
    minAreaHectares: process.env.LAND_MIN_AREA_HECTARES
      ? Number(process.env.LAND_MIN_AREA_HECTARES)
      : undefined,
    maxAreaHectares: process.env.LAND_MAX_AREA_HECTARES
      ? Number(process.env.LAND_MAX_AREA_HECTARES)
      : undefined,
  },
});
