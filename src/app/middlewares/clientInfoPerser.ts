import { Request, Response, NextFunction } from 'express';
import { UAParser } from 'ua-parser-js';
import axios from 'axios';

interface LocationInfo {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
}

interface ClientInfo {
  device: string;
  browser: string;
  ipAddress: string;
  pcName?: string;
  os: string;
  userAgent: string;
  browserVersion?: string;
  osVersion?: string;
  deviceModel?: string;
  cpuArchitecture?: string;
  location?: LocationInfo;
}

// IP to Location service function
const getLocationFromIP = async (ip: string): Promise<LocationInfo | null> => {
  try {
    // Skip location lookup for localhost/private IPs
    if (
      ip === '::1' ||
      ip === '127.0.0.1' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.')
    ) {
      return {
        country: 'Local',
        region: 'Local',
        city: 'localhost',
        timezone: 'Local',
      };
    }

    // Using ip-api.com (free service, 1000 requests/month)
    const response = await axios.get(
      `http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,lat,lon,timezone,isp`,
      {
        timeout: 5000, // 5 second timeout
      },
    );

    if (response.data.status === 'success') {
      return {
        country: response.data.country,
        region: response.data.regionName,
        city: response.data.city,
        latitude: response.data.lat,
        longitude: response.data.lon,
        timezone: response.data.timezone,
        isp: response.data.isp,
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching location from IP:', error);
    return null;
  }
};

const clientInfoParser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const parser = new UAParser();
    parser.setUA(userAgent);
    const parsedUA = parser.getResult();

    // Get IP address from various possible headers
    const getClientIP = (): string => {
      const forwarded = req.headers['x-forwarded-for'];
      const realIP = req.headers['x-real-ip'];
      const clientIP = req.headers['x-client-ip'];

      if (forwarded) {
        // x-forwarded-for can contain multiple IPs, get the first one
        return (forwarded as string).split(',')[0].trim();
      }

      if (realIP) {
        return realIP as string;
      }

      if (clientIP) {
        return clientIP as string;
      }

      return (
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        (req.connection as any)?.socket?.remoteAddress ||
        req.ip ||
        'Unknown'
      );
    };

    // Determine device type more accurately
    const getDeviceType = (): string => {
      const deviceType = parsedUA.device.type;

      if (deviceType === 'mobile') return 'mobile';
      if (deviceType === 'tablet') return 'tablet';
      if (deviceType === 'smarttv') return 'smarttv';
      if (deviceType === 'wearable') return 'wearable';
      if (deviceType === 'console') return 'console';

      // If no specific device type, check user agent for mobile indicators
      const mobileKeywords =
        /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i;
      if (mobileKeywords.test(userAgent)) {
        return 'mobile';
      }

      return 'pc'; // Default to PC
    };

    const clientIP = getClientIP();

    // Get location information
    const locationInfo = await getLocationFromIP(clientIP);

    const clientInfo: ClientInfo = {
      device: getDeviceType(),
      browser: parsedUA.browser.name || 'Unknown',
      browserVersion: parsedUA.browser.version || 'Unknown',
      ipAddress: clientIP,
      pcName: (req.headers['host'] as string) || undefined,
      os: parsedUA.os.name || 'Unknown',
      osVersion: parsedUA.os.version || 'Unknown',
      userAgent: userAgent,
      deviceModel: parsedUA.device.model || undefined,
      cpuArchitecture: parsedUA.cpu.architecture || undefined,
      location: locationInfo || undefined,
    };

    // Add to request body for validation and storage
    req.body.clientInfo = clientInfo;

    // Also add to req object for middleware access
    (req as any).clientInfo = clientInfo;

    next();
  } catch (error) {
    console.error('Error parsing client info:', error);

    // Fallback client info in case of error
    req.body.clientInfo = {
      device: 'pc',
      browser: 'Unknown',
      ipAddress: req.ip || 'Unknown',
      os: 'Unknown',
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    next();
  }
};

export default clientInfoParser;

// Additional utility functions for client info
export const getDeviceInfo = (userAgent: string) => {
  const parser = new UAParser();
  parser.setUA(userAgent);
  return parser.getResult();
};

export const isRequestFromMobile = (userAgent: string): boolean => {
  const parser = new UAParser();
  parser.setUA(userAgent);
  const result = parser.getResult();

  return (
    result.device.type === 'mobile' ||
    /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent)
  );
};

export const getBrowserInfo = (userAgent: string) => {
  const parser = new UAParser();
  parser.setUA(userAgent);
  const result = parser.getResult();

  return {
    name: result.browser.name,
    version: result.browser.version,
    engine: result.engine.name,
    engineVersion: result.engine.version,
  };
};

// New utility function for manual IP location lookup
export const getLocationByIP = async (
  ip: string,
): Promise<LocationInfo | null> => {
  return await getLocationFromIP(ip);
};
