import * as Joi from 'joi';

export const validationSchema = Joi.object({
  JWT_SECRET: Joi.string().required(),

  GOOGLE_CLIENT_ID: Joi.string().required(),
  
  DATABASE_URL: Joi.string().required(),
});