import axios, { AxiosRequestConfig } from 'axios';
import { consulDiscoverService, InternalServerError } from '@ecommerce/shared';

export class ProxyService {
  private discoveryCache = new Map<
    string,
    { expiresAt: number; targets: { address: string; port: number }[] }
  >();

  private discoveryTtlMs =
    parseInt(process.env.SERVICE_DISCOVERY_TTL_MS || '5000', 10) || 5000;

  private async resolveBaseUrl(serviceName: string, fallbackUrl: string) {
    const now = Date.now();
    const cached = this.discoveryCache.get(serviceName);
    if (cached && cached.expiresAt > now && cached.targets.length > 0) {
      const target =
        cached.targets[Math.floor(Math.random() * cached.targets.length)];
      return `http://${target.address}:${target.port}`;
    }

    try {
      const discovered = await consulDiscoverService(serviceName);
      const targets = discovered.map((d) => ({
        address: d.address,
        port: d.port,
      }));
      this.discoveryCache.set(serviceName, {
        expiresAt: now + this.discoveryTtlMs,
        targets,
      });
      if (targets.length > 0) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        return `http://${target.address}:${target.port}`;
      }
    } catch {
      // fall back below
    }

    return fallbackUrl;
  }

  async forward(
    serviceName: string,
    fallbackUrl: string,
    path: string,
    method: string,
    data?: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    try {
      const baseUrl = await this.resolveBaseUrl(serviceName, fallbackUrl);
      const config: AxiosRequestConfig = {
        method: method as any,
        url: `${baseUrl}${path}`,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
        config.data = data;
      } else if (data) {
        config.params = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new InternalServerError(
          error.response.data?.message || 'Service request failed',
        );
      }
      throw new InternalServerError('Service unavailable');
    }
  }
}
