import amqp, { type Channel } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672';
export const NOTIFICATION_EXCHANGE = process.env.NOTIFICATION_EXCHANGE ?? 'leave.events';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

let connection: AmqpConnection | null = null;
let channel: Channel | null = null;

export async function connectRabbit(retries = 15, delayMs = 4000): Promise<Channel> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      connection = await amqp.connect(RABBITMQ_URL);
      channel = await connection.createChannel();
      await channel.assertExchange(NOTIFICATION_EXCHANGE, 'topic', { durable: true });
      console.log('[rabbitmq] Connected');
      return channel;
    } catch (err) {
      console.warn(`[rabbitmq] Connection attempt ${attempt}/${retries} failed:`, (err as Error).message);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error('Unable to connect to RabbitMQ');
}

export function getChannel(): Channel {
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  return channel;
}

export async function publishEvent(
  routingKey: string,
  payload: unknown,
  correlationId: string
): Promise<void> {
  const ch = getChannel();
  ch.publish(NOTIFICATION_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
    persistent: true,
    contentType: 'application/json',
    correlationId,
  });
  console.log(`[rabbitmq] Published ${routingKey}`, { correlationId });
}

export async function consumeEvents(
  queueName: string,
  routingKeys: string[],
  handler: (routingKey: string, payload: unknown, correlationId: string) => Promise<void>
): Promise<void> {
  const ch = getChannel();
  await ch.assertQueue(queueName, { durable: true });
  for (const key of routingKeys) {
    await ch.bindQueue(queueName, NOTIFICATION_EXCHANGE, key);
  }

  await ch.consume(queueName, (msg) => {
    if (!msg) return;
    void (async () => {
      try {
        const payload = JSON.parse(msg.content.toString()) as unknown;
        const correlationId = (msg.properties.correlationId as string) ?? 'unknown';
        await handler(msg.fields.routingKey, payload, correlationId);
        ch.ack(msg);
      } catch (err) {
        console.error('[rabbitmq] Consumer error:', (err as Error).message);
        ch.nack(msg, false, false);
      }
    })();
  });
}
