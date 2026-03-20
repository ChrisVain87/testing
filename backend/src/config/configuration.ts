export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  database: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/creature_world',
  },

  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-this-in-production-very-long-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-this-refresh-secret-also',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY ?? 'change-this-32-char-aes-key-prod!',
  },

  llm: {
    promptCooldownHours: parseInt(process.env.PROMPT_COOLDOWN_HOURS ?? '4', 10),
    maxPromptLength: parseInt(process.env.MAX_PROMPT_LENGTH ?? '2000', 10),
    maxActionsPerPlan: parseInt(process.env.MAX_ACTIONS_PER_PLAN ?? '20', 10),
  },

  simulation: {
    tickRateHz: parseInt(process.env.SIMULATION_TICK_HZ ?? '10', 10),
    maxActiveCreatures: parseInt(process.env.MAX_ACTIVE_CREATURES ?? '5000', 10),
  },

  world: {
    chunkSize: parseInt(process.env.CHUNK_SIZE ?? '64', 10),
    tileSize: parseInt(process.env.TILE_SIZE ?? '32', 10),
  },

  throttle: {
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '60', 10),
  },
});
