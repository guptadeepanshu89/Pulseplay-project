import { DownOutlined, MailOutlined, MobileOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Checkbox, Dropdown, Form, Input, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { listClients } from '../api/clients';
import { deleteUser, listUsers, resetUserPassword, setUserActive, updateUser } from '../api/users';
import { useHeaderExtras } from '../components/AppLayout';
import { TempPasswordModal } from '../components/TempPasswordModal';
import { messageOf, useAuth } from '../context/AuthContext';
import type { AdminUser } from '../types';

export function UsersPage() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  // Matches server manageUser policy: CA may only manage players, never fellow admins.
  const canManage = (u: AdminUser) => isSuperAdmin || u.role === 'CLIENT_USER';
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const rawClientId = searchParams.get('clientId');
  const clientId = rawClientId && Number.isFinite(Number(rawClientId)) ? Number(rawClientId) : undefined;
  const rawRole = searchParams.get('role');
  const role = rawRole === 'CLIENT_USER' || rawRole === 'CLIENT_ADMIN' ? rawRole : undefined;
  const isActive =
    searchParams.get('status') === 'active' ? true : searchParams.get('status') === 'inactive' ? false : undefined;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [reset, setReset] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [editForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, clientId, role, isActive, page, pageSize }],
    queryFn: () => listUsers({ search: search || undefined, clientId, role, isActive, page, pageSize }),
  });

  const { data: clientOptions } = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => listClients({ pageSize: 100, isActive: true }),
    enabled: isSuperAdmin,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const updateMutation = useMutation({
    mutationFn: (values: { id: number; name: string; email: string; mobile: string }) =>
      updateUser(values.id, { name: values.name, email: values.email, mobile: values.mobile }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      message.success('User updated');
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => setUserActive(id, active),
    onSuccess: invalidate,
    onError: (err) => message.error(messageOf(err)),
  });

  const resetMutation = useMutation({
    mutationFn: resetUserPassword,
    onError: (err) => message.error(messageOf(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      message.success('User deleted');
      invalidate();
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const confirmActiveChange = (u: AdminUser, checked: boolean) => {
    modal.confirm({
      title: checked ? 'Activate this user?' : 'Deactivate this user?',
      content: checked
        ? 'This user will be able to access the application again.'
        : 'This user will no longer be able to access the application.',
      okText: checked ? 'Activate' : 'Deactivate',
      okButtonProps: checked ? undefined : { danger: true },
      onOk: () => toggleActiveMutation.mutateAsync({ id: u.id, active: checked }),
    });
  };

  const confirmResetPassword = (u: AdminUser) => {
    modal.confirm({
      title: "Reset this user's password?",
      content: 'A new one-time password will be generated.',
      okText: 'Reset',
      onOk: async () => {
        const result = await resetMutation.mutateAsync(u.id);
        setReset({ email: u.email, temporaryPassword: result.temporaryPassword });
      },
    });
  };

  const confirmDeleteUser = (u: AdminUser) => {
    modal.confirm({
      title: 'Delete this user?',
      content: 'Only possible with an empty wallet, no open bets and no pending requests.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: () => deleteMutation.mutateAsync(u.id),
    });
  };

  const headerExtras = useMemo(
    () => (
      <>
        <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 650 }}>
          Users
        </Typography.Title>
        <Input.Search
          placeholder="Search by name, email, mobile or code"
          allowClear
          size="middle"
          style={{ width: 260, maxWidth: '100%' }}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {isSuperAdmin && (
          <Select
            allowClear
            placeholder="Filter by client"
            size="middle"
            style={{ width: 180, maxWidth: '100%' }}
            value={clientId}
            options={clientOptions?.items.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(value) => {
              setPage(1);
              if (value == null) {
                setSearchParams({});
              } else {
                setSearchParams({ clientId: String(value) });
              }
            }}
          />
        )}
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/users/new')}>
          New user
        </Button>
      </>
    ),
    [isSuperAdmin, clientId, clientOptions?.items, setSearchParams, navigate],
  );
  useHeaderExtras(headerExtras);

  return (
    <>
      <Card bordered={false} styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden' }}>
        <Table<AdminUser>
          rowKey="id"
          size="small"
          loading={isLoading}
          dataSource={data?.items}
          tableLayout="fixed"
          scroll={{ x: 1040 }}
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
            { title: 'Name', dataIndex: 'name', ellipsis: true },
            { title: 'Email', dataIndex: 'email', ellipsis: true },
            { title: 'Mobile', dataIndex: 'mobile', width: 100, ellipsis: true },
            {
              title: 'Role',
              dataIndex: 'role',
              width: 88,
              render: (r: string) => (
                <Tag color={r === 'CLIENT_ADMIN' ? 'gold' : 'blue'}>{r === 'CLIENT_ADMIN' ? 'Client Admin' : 'Player'}</Tag>
              ),
            },
            ...(isSuperAdmin && clientId == null
              ? [
                  {
                    title: 'Client',
                    dataIndex: 'client',
                    ellipsis: true,
                    width: 110,
                    render: (c: AdminUser['client']) => c?.name ?? '—',
                  },
                ]
              : []),
            {
              title: 'Wallet',
              dataIndex: 'wallet',
              width: 88,
              align: 'right' as const,
              ellipsis: true,
              render: (v: number, u: AdminUser) =>
                u.role === 'CLIENT_USER'
                  ? `₹${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—',
            },
            {
              title: 'Win',
              dataIndex: 'winning',
              width: 80,
              align: 'right' as const,
              ellipsis: true,
              render: (v: number, u: AdminUser) =>
                u.role === 'CLIENT_USER'
                  ? `₹${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—',
            },
            {
              title: 'Loss',
              dataIndex: 'loss',
              width: 80,
              align: 'right' as const,
              ellipsis: true,
              render: (v: number, u: AdminUser) =>
                u.role === 'CLIENT_USER'
                  ? `₹${Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : '—',
            },
            {
              title: 'Net Balance',
              width: 110,
              align: 'right' as const,
              ellipsis: true,
              render: (_: unknown, u: AdminUser) => {
                if (u.role !== 'CLIENT_USER') return '—';
                const win = Number(u.winning ?? 0);
                const loss = Number(u.loss ?? 0);
                const fmt = (n: number) =>
                  `₹${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                if (win === loss) return fmt(0);
                if (win > loss) return <span style={{ color: '#dc2626' }}>{`-${fmt(win - loss)}`}</span>;
                return <span style={{ color: '#16a34a' }}>{`+${fmt(loss - win)}`}</span>;
              },
            },
            {
              title: 'Active',
              width: 56,
              align: 'center' as const,
              render: (_: unknown, u: AdminUser) =>
                canManage(u) ? (
                  <Checkbox
                    checked={u.isActive}
                    disabled={toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === u.id}
                    onChange={(e) => confirmActiveChange(u, e.target.checked)}
                  />
                ) : (
                  '—'
                ),
            },
            {
              title: 'Last login',
              dataIndex: 'lastLoginAt',
              width: 96,
              ellipsis: true,
              render: (v: string | null) =>
                v
                  ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
                  : 'Never',
            },
            {
              title: '',
              width: 64,
              render: (_, u) =>
                canManage(u) ? (
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'reset',
                          label: 'Reset password',
                          onClick: () => confirmResetPassword(u),
                        },
                        {
                          key: 'delete',
                          label: 'Delete',
                          danger: true,
                          onClick: () => confirmDeleteUser(u),
                        },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <Button size="small" type="link" style={{ paddingInline: 4 }}>
                      More <DownOutlined />
                    </Button>
                  </Dropdown>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>

      <Modal
        className="pp-edit-user-modal"
        open={!!editing}
        onCancel={() => setEditing(null)}
        footer={null}
        destroyOnHidden
        width={520}
        centered
        styles={{
          container: { borderRadius: 16, overflow: 'hidden', padding: 0 },
          body: { padding: 0 },
        }}
      >
        <div className="pp-edit-user">
          <div className="pp-edit-user__accent" />
          <div className="pp-edit-user__header">
            <div className="pp-edit-user__icon" aria-hidden>
              <UserOutlined />
            </div>
            <div>
              <Typography.Title level={4} className="pp-edit-user__title">
                Edit User
              </Typography.Title>
              <Typography.Paragraph type="secondary" className="pp-edit-user__subtitle">
                Update the user&apos;s basic account information.
              </Typography.Paragraph>
            </div>
          </div>

          <Form
            form={editForm}
            layout="vertical"
            requiredMark="optional"
            className="pp-edit-user__form"
            onFinish={(values) => editing && updateMutation.mutate({ id: editing.id, ...values })}
          >
            <div className="pp-edit-user__grid">
              <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]}>
                <Input size="large" placeholder="Full name" prefix={<UserOutlined />} />
              </Form.Item>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, type: 'email', message: 'A valid email is required' }]}
              >
                <Input size="large" placeholder="user@example.com" prefix={<MailOutlined />} />
              </Form.Item>
              <Form.Item
                name="mobile"
                label="Mobile"
                rules={[{ required: true, pattern: /^\d{10}$/, message: 'Exactly 10 digits' }]}
                className="pp-edit-user__mobile"
              >
                <Input size="large" placeholder="10-digit mobile" maxLength={10} prefix={<MobileOutlined />} />
              </Form.Item>
            </div>

            <Space className="pp-edit-user__actions" wrap>
              <Button size="large" onClick={() => setEditing(null)} disabled={updateMutation.isPending}>
                Cancel
              </Button>
              <Button
                type="primary"
                size="large"
                htmlType="submit"
                loading={updateMutation.isPending}
                disabled={updateMutation.isPending}
              >
                Save
              </Button>
            </Space>
          </Form>
        </div>
      </Modal>

      <TempPasswordModal
        open={!!reset}
        title="Password reset"
        identifierLabel="Email"
        identifier={reset?.email ?? ''}
        password={reset?.temporaryPassword ?? null}
        onClose={() => setReset(null)}
      />
    </>
  );
}
