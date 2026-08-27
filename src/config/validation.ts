import * as Joi from 'joi';

export const validationSchema = Joi.object({
  JWT_SECRET: Joi.string().required(),

  GOOGLE_CLIENT_ID: Joi.string().required(),

  DATABASE_URL: Joi.string(),
  MONGODB_URI: Joi.string(),
  GOOGLE_CLOUD_PROJECT_ID: Joi.string(),
  EARTH_ENGINE_PROJECT_ID: Joi.string(),
  EARTH_ENGINE_CLIENT_EMAIL: Joi.string(),
  EARTH_ENGINE_PRIVATE_KEY: Joi.string(),
  EARTH_ENGINE_REFRESH_INTERVAL_SECONDS: Joi.number().default(900),
  EARTH_ENGINE_REQUEST_TIMEOUT_MS: Joi.number().default(30000),
  EARTH_ENGINE_MAX_RETRIES: Joi.number().default(3),
  EARTH_ENGINE_MOCK_ENABLED: Joi.string()
    .valid('true', 'false')
    .default('false'),
  LAND_MAX_VERTICES: Joi.number().default(100),
  LAND_MIN_AREA_HECTARES: Joi.number(),
  LAND_MAX_AREA_HECTARES: Joi.number(),
}).or('DATABASE_URL', 'MONGODB_URI');
