import {
  CancellationRequestSchema,
  OrderRequestSchema,
  WithdrawalRequestSchema,
  type ContractNoticeReceipt,
  type OrderCreated,
  type OrderDto,
} from '@kaufcheck/shared';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Services } from '../../container';
import { parseInput } from '../errors';

const OrderNumberParamSchema = z.object({ number: z.string().regex(/^KC-[0-9A-Z]{8}$/) });

/** Ordering Pro, and the cancellation and withdrawal functions required by law. */
export function contractRoutes(app: FastifyInstance, services: Services): void {
  const { contracts } = services;
  const hourly = (max: number) => ({ config: { rateLimit: { max, timeWindow: '1 hour' } } });

  app.post('/api/billing/orders', hourly(10), async (request, reply): Promise<OrderCreated> => {
    const body = parseInput(OrderRequestSchema, request.body);
    const created = await contracts.placeOrder(request.actor, body);
    reply.status(201);
    return created;
  });

  app.get('/api/billing/orders/:number', async (request, reply): Promise<OrderDto> => {
    const { number } = parseInput(OrderNumberParamSchema, request.params);
    reply.header('cache-control', 'private, no-store');
    return contracts.getOrder(request.actor, number);
  });

  // Public on purpose: cancelling and withdrawing must not require signing in.
  app.post(
    '/api/contracts/cancellations',
    hourly(10),
    async (request, reply): Promise<ContractNoticeReceipt> => {
      const body = parseInput(CancellationRequestSchema, request.body);
      reply.status(201).header('cache-control', 'private, no-store');
      return contracts.cancel(request.actor, body);
    },
  );

  app.post(
    '/api/contracts/withdrawals',
    hourly(10),
    async (request, reply): Promise<ContractNoticeReceipt> => {
      const body = parseInput(WithdrawalRequestSchema, request.body);
      reply.status(201).header('cache-control', 'private, no-store');
      return contracts.withdraw(request.actor, body);
    },
  );
}
