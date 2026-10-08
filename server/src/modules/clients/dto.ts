import { Client } from '@prisma/client';

export function toClientDto(client: Client) {
  return {
    id: client.id,
    code: client.code,
    name: client.name,
    isActive: client.isActive === 1,
    createdAt: client.createdAt,
  };
}
