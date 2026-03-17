import { amqp, uuid } from '@ecommerce/shared';
import type { Channel, Connection, ConsumeMessage } from '@ecommerce/shared';
import { createServiceLogger } from '../utils/logger';

const logger = createServiceLogger('rabbitmq-client');

export interface MessageOptions {
  correlationId?: string;
  replyTo?: string;
  expiration?: string;
  persistent?: boolean;
}

export interface RPCOptions {
  timeout?: number;
  persistent?: boolean;
}

export class RabbitMQClient {
  private connection: any = null;
  private channel: Channel | null = null;
  private replyQueue: string | null = null;
  private pendingRPCs = new Map<
    string,
    { resolve: Function; reject: Function; timeout: NodeJS.Timeout }
  >();

  constructor(
    private url: string = process.env.RABBITMQ_URL || 'amqp://localhost:5672'
  ) {}

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      if (!this.channel) {
        throw new Error('Failed to create channel');
      }

      // Setup reply queue for RPC responses
      const { queue } = await this.channel.assertQueue('', {
        exclusive: true,
      });
      this.replyQueue = queue;

      // Consume RPC responses
      await this.channel.consume(
        this.replyQueue,
        (msg: ConsumeMessage | null) => {
          if (msg) {
            this.handleRPCResponse(msg);
          }
        },
        { noAck: true }
      );

      logger.info('Connected to RabbitMQ');

      // Handle connection errors
      if (this.connection) {
        this.connection.on('error', (err: Error) => {
          logger.error('RabbitMQ connection error:', err);
        });

        this.connection.on('close', () => {
          logger.warn('RabbitMQ connection closed');
        });
      }
    } catch (error) {
      logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      logger.info('Disconnected from RabbitMQ');
    } catch (error) {
      logger.error('Error disconnecting from RabbitMQ:', error);
    }
  }

  async assertQueue(queue: string, options: any = {}): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    await this.channel.assertQueue(queue, {
      durable: true,
      ...options,
    });
  }

  async assertExchange(
    exchange: string,
    type: string,
    options: any = {}
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    await this.channel.assertExchange(exchange, type, {
      durable: true,
      ...options,
    });
  }

  async bindQueue(
    queue: string,
    exchange: string,
    routingKey: string
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }
    await this.channel.bindQueue(queue, exchange, routingKey);
  }

  async publish(
    exchange: string,
    routingKey: string,
    message: any,
    options: MessageOptions = {}
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const content = Buffer.from(JSON.stringify(message));
    this.channel.publish(exchange, routingKey, content, {
      persistent: options.persistent !== false,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      expiration: options.expiration,
    });
  }

  async sendToQueue(
    queue: string,
    message: any,
    options: MessageOptions = {}
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    const content = Buffer.from(JSON.stringify(message));
    this.channel.sendToQueue(queue, content, {
      persistent: options.persistent !== false,
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      expiration: options.expiration,
    });
  }

  async consume(
    queue: string,
    handler: (message: any, msg: ConsumeMessage) => Promise<void>,
    options: any = {}
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.channel.consume(
      queue,
      async (msg: ConsumeMessage | null) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await handler(content, msg);
            this.channel!.ack(msg);
          } catch (error) {
            logger.error('Error processing message:', error);
            this.channel!.nack(msg, false, false);
          }
        }
      },
      options
    );
  }

  async rpcCall<T = any>(
    queue: string,
    message: any,
    options: RPCOptions = {}
  ): Promise<T> {
    if (!this.channel || !this.replyQueue) {
      throw new Error('Channel or reply queue not initialized');
    }

    const correlationId = uuid();
    const timeout = options.timeout || 30000;

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRPCs.delete(correlationId);
        reject(new Error('RPC timeout'));
      }, timeout);

      this.pendingRPCs.set(correlationId, {
        resolve,
        reject,
        timeout: timeoutHandle,
      });

      this.sendToQueue(queue, message, {
        correlationId,
        replyTo: this.replyQueue!,
        persistent: options.persistent,
      });
    });
  }

  async setupRPCServer(
    queue: string,
    handler: (message: any) => Promise<any>
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Channel not initialized');
    }

    await this.assertQueue(queue);

    await this.channel.consume(queue, async (msg: ConsumeMessage | null) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          const response = await handler(content);

          if (msg.properties.replyTo) {
            this.channel!.sendToQueue(
              msg.properties.replyTo,
              Buffer.from(JSON.stringify(response)),
              {
                correlationId: msg.properties.correlationId,
              }
            );
          }

          this.channel!.ack(msg);
        } catch (error: any) {
          logger.error('Error in RPC server:', error);

          if (msg.properties.replyTo) {
            this.channel!.sendToQueue(
              msg.properties.replyTo,
              Buffer.from(JSON.stringify({ error: error.message })),
              {
                correlationId: msg.properties.correlationId,
              }
            );
          }

          this.channel!.nack(msg, false, false);
        }
      }
    });

    logger.info(`RPC server listening on queue: ${queue}`);
  }

  private handleRPCResponse(msg: ConsumeMessage): void {
    const correlationId = msg.properties.correlationId;
    const pending = this.pendingRPCs.get(correlationId);

    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRPCs.delete(correlationId);

      try {
        const response = JSON.parse(msg.content.toString());
        if (response.error) {
          pending.reject(new Error(response.error));
        } else {
          pending.resolve(response);
        }
      } catch (error) {
        pending.reject(error);
      }
    }
  }

  getChannel(): Channel | null {
    return this.channel;
  }
}

// Singleton instance
let rabbitMQClient: RabbitMQClient | null = null;

export const getRabbitMQClient = (): RabbitMQClient => {
  if (!rabbitMQClient) {
    rabbitMQClient = new RabbitMQClient();
  }
  return rabbitMQClient;
};
