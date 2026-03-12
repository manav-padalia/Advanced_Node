import axios from 'axios';

export type DiscoveredService = {
  id: string;
  address: string;
  port: number;
};

type ConsulRegisterInput = {
  id: string;
  name: string;
  address: string;
  port: number;
  tags?: string[];
  healthUrl?: string;
};

// Consul is optional in local/dev runs. If not configured, service discovery becomes a no-op
// and API Gateway will fall back to the static service URLs from env.
const CONSUL_HTTP_ADDR = process.env.CONSUL_HTTP_ADDR;

export async function consulRegisterService(input: ConsulRegisterInput) {
  if (!CONSUL_HTTP_ADDR) return;
  const payload: any = {
    ID: input.id,
    Name: input.name,
    Address: input.address,
    Port: input.port,
    Tags: input.tags || [],
  };

  if (input.healthUrl) {
    payload.Check = {
      HTTP: input.healthUrl,
      Interval: '10s',
      Timeout: '5s',
      DeregisterCriticalServiceAfter: '1m',
    };
  }

  await axios.put(`${CONSUL_HTTP_ADDR}/v1/agent/service/register`, payload, {
    timeout: 5000,
  });
}

export async function consulDeregisterService(serviceId: string) {
  if (!CONSUL_HTTP_ADDR) return;
  await axios.put(
    `${CONSUL_HTTP_ADDR}/v1/agent/service/deregister/${encodeURIComponent(
      serviceId,
    )}`,
    undefined,
    { timeout: 5000 },
  );
}

export async function consulDiscoverService(
  serviceName: string,
): Promise<DiscoveredService[]> {
  if (!CONSUL_HTTP_ADDR) return [];
  const res = await axios.get(
    `${CONSUL_HTTP_ADDR}/v1/health/service/${encodeURIComponent(
      serviceName,
    )}?passing=true`,
    { timeout: 5000 },
  );

  return (res.data as any[]).map((entry) => ({
    id: entry.Service.ID,
    address: entry.Service.Address,
    port: entry.Service.Port,
  }));
}

export function getAdvertiseAddress(defaultPort: number) {
  const address =
    process.env.SERVICE_ADVERTISE_HOST ||
    process.env.ADVERTISE_HOST ||
    process.env.HOST ||
    'localhost';
  const port = parseInt(process.env.SERVICE_ADVERTISE_PORT || '', 10) || defaultPort;
  return { address, port };
}

