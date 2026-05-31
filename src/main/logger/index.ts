import pino from 'pino';

export const logger = pino({
  level: 'info',
  redact: ['path', 'path_or_url', 'url'],
});
