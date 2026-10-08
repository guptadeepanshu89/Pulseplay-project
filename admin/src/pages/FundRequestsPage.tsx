import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Popconfirm, Segmented, Space, Table, Tag, Typography } from 'antd';
import { useState } from 'react';

import { listFundRequests, resolveFundRequest } from '../api/fundRequests';
import { messageOf } from '../context/AuthContext';
import type { FundRequest, FundRequestStatus } from '../types';

const STATUS_COLOR: Record<FundRequestStatus, string> = { PENDING: 'gold', APPROVED: 'green', REJECTED: 'red' };
const TYPE_COLOR = { INCREASE: 'green', DECREASE: 'volcano' } as const;

export function FundRequestsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FundRequestStatus | 'ALL'>('PENDING');
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
    },
    onError: (err) => message.error(messageOf(err)),
  });

  return (
    <>
      <Typography.Title level={3}>Fund requests</Typography.Title>

      <Segmented
        style={{ marginBottom: 16 }}
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

      <Table<FundRequest>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.items}
        pagination={{
          current: page,
          pageSize,
          total: data?.total,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        columns={[
          { title: 'Player', render: (_, r) => (
            <div>
              <div>{r.user.name}</div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.user.email}</Typography.Text>
            </div>
          ) },
          { title: 'Client', dataIndex: ['client', 'name'] },
          { title: 'Type', dataIndex: 'type', render: (t: FundRequest['type']) => <Tag color={TYPE_COLOR[t]}>{t}</Tag> },
          { title: 'Amount', dataIndex: 'amount', render: (v: number) => `₹${v.toFixed(2)}` },
          { title: 'Reason', dataIndex: 'reason', ellipsis: true },
          { title: 'Status', dataIndex: 'status', render: (s: FundRequestStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag> },
          { title: 'Requested', dataIndex: 'requestedAt', render: (v: string) => new Date(v).toLocaleString() },
          {
            title: 'Resolved by',
            render: (_, r) => (r.resolvedBy ? `${r.resolvedBy.name ?? '—'} · ${new Date(r.resolvedAt!).toLocaleString()}` : '—'),
          },
          {
            title: 'Actions',
            render: (_, r) =>
              r.status === 'PENDING' ? (
                <Space>
                  <Popconfirm title="Approve this request?" description={`This credits/debits ${r.user.name}'s wallet immediately.`} onConfirm={() => resolveMutation.mutate({ id: r.id, decision: 'approve' })}>
                    <Button size="small" type="primary">
                      Approve
                    </Button>
                  </Popconfirm>
                  <Popconfirm title="Reject this request?" onConfirm={() => resolveMutation.mutate({ id: r.id, decision: 'reject' })}>
                    <Button size="small" danger>
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
    </>
  );
}
