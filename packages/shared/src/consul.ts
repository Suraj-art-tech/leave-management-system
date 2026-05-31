import Consul from 'consul';

const CONSUL_HOST = process.env.CONSUL_HOST ?? 'localhost';
const CONSUL_PORT = String(process.env.CONSUL_PORT ?? 8500);

interface ConsulServiceNode {
  Service: {
    Address: string;
    Port: number;
  };
}

let consulClient: Consul.Consul | null = null;

function getConsul(): Consul.Consul {
  if (!consulClient) {
    consulClient = new Consul({ host: CONSUL_HOST, port: CONSUL_PORT, promisify: true });
  }
  return consulClient;
}

export interface RegisterOptions {
  name: string;
  address: string;
  port: number;
}

export async function registerService(options: RegisterOptions): Promise<void> {
  const { name, address, port } = options;
  const id = `${name}-${address}-${port}`;

  try {
    await getConsul().agent.service.register({
      id,
      name,
      address,
      port,
      check: {
        http: `http://${address}:${port}/health`,
        interval: '10s',
      },
    } as Consul.Agent.Service.RegisterOptions);
    console.log(`[consul] Registered ${name} at ${address}:${port}`);

    const deregister = async () => {
      try {
        await getConsul().agent.service.deregister(id);
        console.log(`[consul] Deregistered ${name}`);
      } catch {
        /* best effort */
      }
      process.exit(0);
    };

    process.on('SIGINT', deregister);
    process.on('SIGTERM', deregister);
  } catch (err) {
    console.warn(`[consul] Registration failed for ${name}:`, (err as Error).message);
  }
}

export async function discoverService(name: string, fallbackUrl?: string): Promise<string> {
  try {
    const nodes = (await getConsul().health.service({
      service: name,
      passing: true,
    })) as ConsulServiceNode[];

    if (nodes.length > 0) {
      const node = nodes[Math.floor(Math.random() * nodes.length)];
      return `http://${node.Service.Address}:${node.Service.Port}`;
    }
  } catch (err) {
    console.warn(`[consul] Discovery failed for ${name}:`, (err as Error).message);
  }

  if (fallbackUrl) return fallbackUrl;
  throw new Error(`Unable to discover service: ${name}`);
}
