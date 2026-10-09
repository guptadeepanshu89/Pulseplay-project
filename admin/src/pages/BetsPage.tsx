import { useQuery } from '@tanstack/react-query';
import { Card, Input, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listBets } from '../api/bets';
import { useHeaderExtras } from '../components/AppLayout';
import type { Bet } from '../types';

const STATUS_COLOR: Record<string, string> = { OPEN: 'blue', WON: 'green', LOST: 'red', VOID: 'default', SETTLED: 'default' };

function matchesSearch(bet: Bet, q: string) {
  if (!q) return true;
  const haystack = [bet.userName, bet.userEmail, bet.userMobile].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(q);
}

export function BetsPage() {
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || undefined;
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['bets'], queryFn: () => listBets() });

  const filtered = useMemo(() => {
    let rows = data;
    if (statusFilter) rows = rows?.filter((bet) => bet.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows?.filter((bet) => matchesSearch(bet, q));
  }, [data, search, statusFilter]);

  const headerExtras = useMemo(
    () => (
      <>
        <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 650 }}>
          Active Orders
        </Typography.Title>
        <Input.Search
          placeholder="Search by name, email, mob..."
          allowClear
          size="middle"
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={setSearch}
          onChange={(e) => {
            if (!e.target.value) setSearch('');
          }}
        />
      </>
    ),
    [],
  );
  useHeaderExtras(headerExtras);

  return (
    <>
      <Card bordered={false} styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
        <div className="pp-table-wrap">
          <Table<Bet>
            rowKey="id"
            size="middle"
            loading={isLoading}
            dataSource={filtered}
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 25, showSizeChanger: true }}
            expandable={{
              expandedRowRender: (bet) => (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
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
              {
                title: 'Player',
                dataIndex: 'userName',
                render: (name: string | undefined, bet) => name ?? `User #${bet.userId}`,
              },
              { title: 'Legs', dataIndex: 'legCount' },
              { title: 'Stake', dataIndex: 'stake', render: (v: number) => `₹${v.toFixed(2)}` },
              { title: 'Odds', dataIndex: 'combinedOdds' },
              { title: 'Potential return', dataIndex: 'potentialReturn', render: (v: number) => `₹${v.toFixed(2)}` },
              { title: 'Status', dataIndex: 'status', render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag> },
              { title: 'Placed', dataIndex: 'placedAt', render: (v: string) => new Date(v).toLocaleString() },
              { title: 'Settled', dataIndex: 'settledAt', render: (v?: string) => (v ? new Date(v).toLocaleString() : '—') },
            ]}
          />
        </div>
      </Card>
    </>
  );
}
