import Redis from 'ioredis';
import config from '../../config';

const redis = new Redis(config.redis_url as string);

export default redis;
