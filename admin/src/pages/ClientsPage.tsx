import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Checkbox, Input, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { deleteClient, listClients, setClientActive } from '../api/clients';
import { useHeaderExtras } from '../components/AppLayout';
import { messageOf } from '../context/AuthContext';
import type { Client } from '../types';

export function ClientsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const isActive = searchParams.get('status') === 'active' ? true : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, page, pageSize, isActive }],
    queryFn: () => listClients({ search: search || undefined, page, pageSize, isActive }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setClientActive(id, active),
    onSuccess: invalidate,
    onError: (err) => message.error(messageOf(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      message.success('Client deleted');
      invalidate();
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const headerExtras = useMemo(
    () => (
      <>
        <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 650 }}>
          Clients
        </Typography.Title>
        <Input.Search
          placeholder="Search by name or code"
          allowClear
          size="middle"
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/clients/new')}>
          New client
        </Button>
      </>
    ),
    [navigate],
  );
  useHeaderExtras(headerExtras);

  return (
    <>
      <Card bordered={false} styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
      <Table<Client>
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data?.items}
        tableLayout="fixed"
        style={{ width: '100%' }}
        onRow={(client) => ({
          onDoubleClick: () => navigate(`/users?clientId=${client.id}`),
          style: { cursor: 'pointer' },
        })}
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
          { title: 'Code', dataIndex: 'code', width: 90, ellipsis: true },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          {
            title: 'Status',
            dataIndex: 'isActive',
            width: 90,
            render: (isActive: boolean) => <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Tag>,
          },
          {
            title: 'Wallet',
            dataIndex: 'wallet',
            width: 100,
            align: 'right' as const,
            ellipsis: true,
            render: (v: number) => `₹${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
          {
            title: 'Win',
            dataIndex: 'winning',
            width: 90,
            align: 'right' as const,
            ellipsis: true,
            render: (v: number) => `₹${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
          {
            title: 'Loss',
            dataIndex: 'loss',
            width: 90,
            align: 'right' as const,
            ellipsis: true,
            render: (v: number) => `₹${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          },
          {
            title: 'Net Balance',
            width: 110,
            align: 'right' as const,
            ellipsis: true,
            render: (_: unknown, client: Client) => {
              const win = Number(client.winning ?? 0);
              const loss = Number(client.loss ?? 0);
              const fmt = (n: number) =>
                `₹${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
              if (win === loss) return fmt(0);
              if (win > loss) return <span style={{ color: '#dc2626' }}>{`-${fmt(win - loss)}`}</span>;
              return <span style={{ color: '#16a34a' }}>{`+${fmt(loss - win)}`}</span>;
            },
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            width: 96,
            render: (v: string) => new Date(v).toLocaleDateString(),
          },
          {
            title: 'Active',
            width: 64,
            align: 'center' as const,
            onCell: () => ({
              onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
            }),
            render: (_: unknown, client: Client) => (
              <Checkbox
                checked={client.isActive}
                disabled={toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === client.id}
                onChange={(e) => {
                  const checked = e.target.checked;
                  modal.confirm({
                    title: checked ? 'Activate Client?' : 'Deactivate Client?',
                    okText: checked ? 'Activate' : 'Deactivate',
                    cancelText: 'Cancel',
                    okButtonProps: checked ? undefined : { danger: true },
                    onOk: () => toggleActiveMutation.mutateAsync({ id: client.id, active: checked }),
                  });
                }}
              />
            ),
          },
          {
            title: 'Actions',
            width: 100,
            onCell: () => ({
              onDoubleClick: (e: MouseEvent) => e.stopPropagation(),
            }),
            render: (_, client) => (
              <Space size={6} wrap>
                <Popconfirm
                  title="Delete this client?"
                  description="Only possible once it has no active players and no pending requests."
                  onConfirm={() => deleteMutation.mutate(client.id)}
                >
                  <Button size="small" danger>
                    Delete
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      </Card>
    </>
  );
}
