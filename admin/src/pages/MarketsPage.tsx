import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Collapse, Popconfirm, Radio, Space, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { listEvents, listMarkets, resumeMarket, settleMarket, suspendMarket } from '../api/markets';
import { useHeaderExtras } from '../components/AppLayout';
import { messageOf } from '../context/AuthContext';

export function MarketsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [selections, setSelections] = useState<Record<number, number>>({});

  const { data: events } = useQuery({ queryKey: ['events'], queryFn: listEvents });
  const { data: markets, isLoading } = useQuery({ queryKey: ['markets'], queryFn: listMarkets });

  const settleMutation = useMutation({
    mutationFn: ({ marketId, winningSelectionId }: { marketId: number; winningSelectionId: number }) => settleMarket(marketId, winningSelectionId),
    onSuccess: (result) => {
      const settled = result.settledBets.length;
      const pending = result.pendingAccumulatorCount ?? 0;
      if (pending > 0) {
        message.success(
          `Market settled — ${settled} bet(s) fully settled; ${pending} accumulator(s) still waiting on other legs`,
        );
      } else {
        message.success(`Market settled — ${settled} bet(s) fully settled`);
      }
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      queryClient.invalidateQueries({ queryKey: ['bets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ marketId, action }: { marketId: number; action: 'suspend' | 'resume' }) =>
      action === 'suspend' ? suspendMarket(marketId) : resumeMarket(marketId),
    onSuccess: (_result, variables) => {
      message.success(variables.action === 'suspend' ? 'Market suspended — new bets are blocked' : 'Market resumed');
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const eventNameOf = (eventId: number) => events?.find((e) => e.id === eventId)?.name ?? `Event #${eventId}`;
  const visibleMarkets = (markets ?? []).filter((m) => m.status === 'OPEN' || m.status === 'SUSPENDED');

  const headerExtras = useMemo(
    () => (
      <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 650 }}>
        Markets — settle
      </Typography.Title>
    ),
    [],
  );
  useHeaderExtras(headerExtras);

  return (
    <>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 16 }}>
        Settling pays out every open bet on this market for every client at once — pick the winning selection carefully; it cannot be undone.
      </Typography.Paragraph>

      <Card bordered={false}>
        {!isLoading && visibleMarkets.length === 0 && <Typography.Text type="secondary">No open markets right now.</Typography.Text>}

        <Collapse
          items={visibleMarkets.map((market) => ({
            key: market.id,
            label: (
              <Space wrap className="pp-collapse-label">
                <Tag color="purple">{eventNameOf(market.eventId)}</Tag>
                <strong>{market.name}</strong>
                <Tag color={market.status === 'OPEN' ? 'green' : 'gold'}>{market.status}</Tag>
              </Space>
            ),
            children: (
              <>
                {market.status === 'OPEN' && (
                <Radio.Group
                  value={selections[market.id]}
                  onChange={(e) => setSelections((prev) => ({ ...prev, [market.id]: e.target.value }))}
                >
                  <Space direction="vertical">
                    {market.selections.map((selection) => (
                      <Radio key={selection.id} value={selection.id}>
                        {selection.name} <Typography.Text type="secondary">@ {selection.currentPrice}</Typography.Text>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
                )}
                {market.status === 'SUSPENDED' && (
                  <Typography.Text type="secondary">Betting is paused. Resume the market before settling it.</Typography.Text>
                )}
                <Space wrap style={{ marginTop: 16 }}>
                  {market.status === 'OPEN' && (
                    <Popconfirm
                      title="Settle this market?"
                      description="This cannot be undone."
                      disabled={!selections[market.id] || settleMutation.isPending}
                      onConfirm={() => settleMutation.mutate({ marketId: market.id, winningSelectionId: selections[market.id] })}
                    >
                      <Button type="primary" danger disabled={!selections[market.id] || settleMutation.isPending} loading={settleMutation.isPending}>
                        Settle market
                      </Button>
                    </Popconfirm>
                  )}
                  {market.status === 'OPEN' && (
                    <Popconfirm
                      title="Suspend betting on this market?"
                      disabled={statusMutation.isPending}
                      onConfirm={() => statusMutation.mutate({ marketId: market.id, action: 'suspend' })}
                    >
                      <Button disabled={statusMutation.isPending} loading={statusMutation.isPending && statusMutation.variables?.marketId === market.id}>
                        Suspend
                      </Button>
                    </Popconfirm>
                  )}
                  {market.status === 'SUSPENDED' && (
                    <Popconfirm
                      title="Resume betting on this market?"
                      disabled={statusMutation.isPending}
                      onConfirm={() => statusMutation.mutate({ marketId: market.id, action: 'resume' })}
                    >
                      <Button type="primary" disabled={statusMutation.isPending} loading={statusMutation.isPending && statusMutation.variables?.marketId === market.id}>
                        Resume
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              </>
            ),
          }))}
        />
      </Card>
    </>
  );
}
