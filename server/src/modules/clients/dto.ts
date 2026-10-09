import { Client } from '@prisma/client';

export type ClientStats = { wallet: number; winning: number; loss: number };

export function toClientDto(client: Client, stats: ClientStats = { wallet: 0, winning: 0, loss: 0 }) {
  return {
    id: client.id,
    code: client.code,
    name: client.name,
    isActive: client.isActive === 1,
    createdAt: client.createdAt,
    wallet: stats.wallet,
    winning: stats.winning,
    loss: stats.loss,
  };
}
