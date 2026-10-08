import { useQuery } from '@tanstack/react-query';
import { Table, Tag, Typography } from 'antd';

import { listBets } from '../api/bets';
import type { Bet } from '../types';

const STATUS_COLOR: Record<string, string> = { OPEN: 'blue', WON: 'green', LOST: 'red', VOID: 'default', SETTLED: 'default' };

export function BetsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['bets'], queryFn: () => listBets() });

  return (
    <>
      <Typography.Title level={3}>Bets</Typography.Title>
      <Table<Bet>
        rowKey="id"
        loading={isLoading}
        dataSource={data}
        pagination={{ pageSize: 25 }}
        expandable={{
          expandedRowRender: (bet) => (
            <ul style={{ margin: 0 }}>
              {bet.selections.map((leg) => (
                <li key={leg.selectionId}>
                  {leg.eventName} — {leg.marketName}: <strong>{leg.selectionName}</strong> @ {leg.oddsAtPlacement}
                </li>
              ))}
            </ul>
          ),
        }}
        columns={[
          { title: 'Bet #', dataIndex: 'id' },
          { title: 'Player', dataIndex: 'userId' },
          { title: 'Legs', dataIndex: 'legCount' },
          { title: 'Stake', dataIndex: 'stake', render: (v: number) => `₹${v.toFixed(2)}` },
          { title: 'Odds', dataIndex: 'combinedOdds' },
          { title: 'Potential return', dataIndex: 'potentialReturn', render: (v: number) => `₹${v.toFixed(2)}` },
          { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> },
          { title: 'Placed', dataIndex: 'placedAt', render: (v: string) => new Date(v).toLocaleString() },
          { title: 'Settled', dataIndex: 'settledAt', render: (v?: string) => (v ? new Date(v).toLocaleString() : '—') },
        ]}
      />
    </>
  );
}
