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
  aws: {
    region: process.env.AWS_REGION ?? 'ap-south-1',
    s3: {
      bucket: process.env.AWS_S3_UPLOAD_BUCKET,
      jobsPrefix: process.env.AWS_S3_JOBS_PREFIX ?? 'jobs',
      productsPrefix: process.env.AWS_S3_PRODUCTS_PREFIX ?? 'products',
    },
  },
  earthEngine: {
    projectId: process.env.EARTH_ENGINE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT_ID,
    refreshIntervalSeconds: Number(process.env.EARTH_ENGINE_REFRESH_INTERVAL_SECONDS ?? 900),
    failureRetrySeconds: Number(process.env.EARTH_ENGINE_FAILURE_RETRY_SECONDS ?? 60),
    requestTimeoutMs: Number(process.env.EARTH_ENGINE_REQUEST_TIMEOUT_MS ?? 30000),
    maxRetries: Number(process.env.EARTH_ENGINE_MAX_RETRIES ?? 3),
    mockEnabled: process.env.EARTH_ENGINE_MOCK_ENABLED ?? 'false',
    lookbackDays: Number(process.env.EARTH_ENGINE_LOOKBACK_DAYS ?? 30),
    extendedLookbackDays: Number(process.env.EARTH_ENGINE_EXTENDED_LOOKBACK_DAYS ?? 90),
    minClearCoveragePercentage: Number(process.env.EARTH_ENGINE_MIN_CLEAR_COVERAGE_PERCENTAGE ?? 60),
    maxCloudPercentage: Number(process.env.EARTH_ENGINE_MAX_CLOUD_PERCENTAGE ?? 30),
    fallbackMaxCloudPercentage: Number(process.env.EARTH_ENGINE_FALLBACK_MAX_CLOUD_PERCENTAGE ?? 80),
    maxCandidateImages: Number(process.env.EARTH_ENGINE_MAX_CANDIDATE_IMAGES ?? 6),
    scaleMeters: Number(process.env.EARTH_ENGINE_SCALE_METERS ?? 10),
    mapCacheSeconds: Number(process.env.EARTH_ENGINE_MAP_CACHE_SECONDS ?? 3600),
  },
  land: {
    maxVertices: Number(process.env.LAND_MAX_VERTICES ?? 100),
    minAreaHectares: process.env.LAND_MIN_AREA_HECTARES ? Number(process.env.LAND_MIN_AREA_HECTARES) : undefined,
    maxAreaHectares: process.env.LAND_MAX_AREA_HECTARES ? Number(process.env.LAND_MAX_AREA_HECTARES) : undefined,
  },
  admin: {
    email: process.env.DEFAULT_ADMIN_EMAIL,
    password: process.env.DEFAULT_ADMIN_PASSWORD,
  },
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '12', 10),
  },
});