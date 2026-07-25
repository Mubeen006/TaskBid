require("dotenv").config();
const Joi = require("joi");

const envSchema = Joi.object({
  MONGODB_URI: Joi.string().uri().required(),
  PORT: Joi.number().integer().positive().default(4000),
  CORS_ORIGIN: Joi.string().uri().required(),
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
}).unknown(true);

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Invalid environment configuration: ${error.message}`);
}

module.exports = {
  mongoUri: env.MONGODB_URI,
  port: env.PORT,
  corsOrigin: env.CORS_ORIGIN,
  nodeEnv: env.NODE_ENV,
};
