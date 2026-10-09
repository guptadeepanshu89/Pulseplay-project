import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Popconfirm, Segmented, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { listFundRequests, resolveFundRequest } from '../api/fundRequests';
import { useHeaderExtras } from '../components/AppLayout';
import { messageOf } from '../context/AuthContext';
import type { FundRequest, FundRequestStatus } from '../types';

const STATUS_COLOR: Record<FundRequestStatus, string> = { PENDING: 'gold', APPROVED: 'green', REJECTED: 'red' };
const TYPE_COLOR = { INCREASE: 'green', DECREASE: 'volcano' } as const;

function statusFromQuery(raw: string | null): FundRequestStatus | 'ALL' {
  if (raw === 'PENDING' || raw === 'APPROVED' || raw === 'REJECTED' || raw === 'ALL') return raw;
  return 'PENDING';
}

export function FundRequestsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<FundRequestStatus | 'ALL'>(() => statusFromQuery(searchParams.get('status')));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data, isLoading } = useQuery({
    queryKey: ['fundRequests', { status, page, pageSize }],
    queryFn: () => listFundRequests({ status: status === 'ALL' ? undefined : status, page, pageSize }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, decision }: { id: number; decision: 'approve' | 'reject' }) => resolveFundRequest(id, decision),
    onSuccess: (_, { decision }) => {
      message.success(decision === 'approve' ? 'Request approved — the wallet is updated' : 'Request rejected');
      queryClient.invalidateQueries({ queryKey: ['fundRequests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const headerExtras = useMemo(
    () => (
      <>
        <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 650 }}>
          Fund Requests
        </Typography.Title>
        <Segmented
          size="middle"
          value={status}
          onChange={(value) => {
            setStatus(value as FundRequestStatus | 'ALL');
            setPage(1);
          }}
          options={[
            { label: 'Pending', value: 'PENDING' },
            { label: 'Approved', value: 'APPROVED' },
            { label: 'Rejected', value: 'REJECTED' },
            { label: 'All', value: 'ALL' },
          ]}
        />
      </>
    ),
    [status],
  );
  useHeaderExtras(headerExtras);

  return (
    <>
      <Card bordered={false} styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
        <div className="pp-fund-table">
          <Table<FundRequest>
            rowKey="id"
            size="middle"
            loading={isLoading}
            dataSource={data?.items}
            tableLayout="fixed"
            style={{ width: '100%' }}
            pagination={{
              current: page,
              pageSize,
              total: data?.total,
              showSizeChanger: true,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
            columns={[
              {
                title: 'Player',
                ellipsis: true,
                render: (_, r) => (
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.user.name}
                    </div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      {r.user.email}
                    </Typography.Text>
                  </div>
                ),
              },
              { title: 'Client', dataIndex: ['client', 'name'], ellipsis: true },
              {
                title: 'Type',
                dataIndex: 'type',
                width: 110,
                render: (t: FundRequest['type']) => <Tag color={TYPE_COLOR[t]}>{t}</Tag>,
              },
              {
                title: 'Amount',
                dataIndex: 'amount',
                width: 110,
                render: (v: number) => `₹${v.toFixed(2)}`,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                width: 110,
                render: (s: FundRequestStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
              },
              {
                title: 'Requested',
                dataIndex: 'requestedAt',
                width: 150,
                ellipsis: true,
                render: (v: string) => new Date(v).toLocaleString(),
              },
              {
                title: 'Resolved by',
                ellipsis: true,
                render: (_, r) =>
                  r.resolvedBy ? `${r.resolvedBy.name ?? '—'} · ${new Date(r.resolvedAt!).toLocaleString()}` : '—',
              },
              {
                title: 'Actions',
                width: 168,
                render: (_, r) =>
                  r.status === 'PENDING' ? (
                    <Space size={6} wrap={false}>
                      <Popconfirm
                        title="Approve this request?"
                        description={`This credits/debits ${r.user.name}'s wallet immediately.`}
                        onConfirm={() => resolveMutation.mutate({ id: r.id, decision: 'approve' })}
                        disabled={resolveMutation.isPending}
                      >
                        <Button size="small" type="primary" disabled={resolveMutation.isPending} loading={resolveMutation.isPending}>
                          Approve
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title="Reject this request?"
                        onConfirm={() => resolveMutation.mutate({ id: r.id, decision: 'reject' })}
                        disabled={resolveMutation.isPending}
                      >
                        <Button size="small" danger disabled={resolveMutation.isPending} loading={resolveMutation.isPending}>
                          Reject
                        </Button>
                      </Popconfirm>
                    </Space>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        </div>
      </Card>
    </>
  );
}
