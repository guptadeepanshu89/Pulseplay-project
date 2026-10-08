import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import { useState } from 'react';

import { listClients } from '../api/clients';
import { createUser, deleteUser, listUsers, resetUserPassword, setUserActive, updateUser } from '../api/users';
import { TempPasswordModal } from '../components/TempPasswordModal';
import { messageOf, useAuth } from '../context/AuthContext';
import type { AdminUser } from '../types';

export function UsersPage() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const { message } = App.useApp();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [reset, setReset] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['users', { search, clientId, page, pageSize }],
    queryFn: () => listUsers({ search: search || undefined, clientId, page, pageSize }),
  });

  // SuperAdmin creates a user under a client of their choosing — the picker for it.
  const { data: clientOptions } = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => listClients({ pageSize: 100, isActive: true }),
    enabled: isSuperAdmin,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (result) => {
      setCreateOpen(false);
      createForm.resetFields();
      setCreated({ email: result.user.email, temporaryPassword: result.temporaryPassword });
      invalidate();
    },
    onError: (err) => message.error(messageOf(err)),
  });

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

  return (
    <>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Users
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New user
        </Button>
      </Space>

      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search by name, email, mobile or code"
          allowClear
          style={{ width: 320 }}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        {isSuperAdmin && (
          <Select
            allowClear
            placeholder="Filter by client"
            style={{ width: 220 }}
            options={clientOptions?.items.map((c) => ({ value: c.id, label: c.name }))}
            onChange={(value) => {
              setClientId(value);
              setPage(1);
            }}
          />
        )}
      </Space>

      <Table<AdminUser>
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
          { title: 'Name', dataIndex: 'name' },
          { title: 'Email', dataIndex: 'email' },
          { title: 'Mobile', dataIndex: 'mobile' },
          { title: 'Role', dataIndex: 'role', render: (r: string) => <Tag color={r === 'CLIENT_ADMIN' ? 'gold' : 'blue'}>{r === 'CLIENT_ADMIN' ? 'Client Admin' : 'Player'}</Tag> },
          ...(isSuperAdmin ? [{ title: 'Client', dataIndex: 'client', render: (c: AdminUser['client']) => c?.name ?? '—' }] : []),
          {
            title: 'Status',
            render: (_: unknown, u: AdminUser) => (
              <Space>
                <Tag color={u.isActive ? 'green' : 'default'}>{u.isActive ? 'Active' : 'Blocked'}</Tag>
                {u.mustChangePassword && <Tag color="orange">Temp password</Tag>}
              </Space>
            ),
          },
          { title: 'Last login', dataIndex: 'lastLoginAt', render: (v: string | null) => (v ? new Date(v).toLocaleString() : 'Never') },
          {
            title: 'Actions',
            render: (_, u) => (
              <Space>
                <Button size="small" onClick={() => { setEditing(u); editForm.setFieldsValue(u); }}>
                  Edit
                </Button>
                <Switch
                  checked={u.isActive}
                  checkedChildren="Active"
                  unCheckedChildren="Blocked"
                  onChange={(checked) => toggleActiveMutation.mutate({ id: u.id, active: checked })}
                  loading={toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === u.id}
                />
                <Popconfirm
                  title="Reset this user's password?"
                  description="A new one-time password will be generated."
                  onConfirm={async () => {
                    try {
                      const result = await resetMutation.mutateAsync(u.id);
                      setReset({ email: u.email, temporaryPassword: result.temporaryPassword });
                    } catch {
                      // surfaced via resetMutation.onError
                    }
                  }}
                >
                  <Button size="small">Reset password</Button>
                </Popconfirm>
                <Popconfirm
                  title="Delete this user?"
                  description="Only possible with an empty wallet, no open bets and no pending requests."
                  onConfirm={() => deleteMutation.mutate(u.id)}
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

      <Modal
        title="New user"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
      >
        <Form form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'A valid email is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="mobile" label="Mobile" rules={[{ required: true, pattern: /^\d{10}$/, message: 'Exactly 10 digits' }]}>
            <Input />
          </Form.Item>
          {isSuperAdmin && (
            <>
              <Form.Item name="clientId" label="Client" rules={[{ required: true, message: 'Required' }]}>
                <Select options={clientOptions?.items.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
              <Form.Item name="role" label="Role" initialValue="CLIENT_USER">
                <Select options={[{ value: 'CLIENT_USER', label: 'Player' }, { value: 'CLIENT_ADMIN', label: 'Client Admin' }]} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal title="Edit user" open={!!editing} onCancel={() => setEditing(null)} onOk={() => editForm.submit()} confirmLoading={updateMutation.isPending}>
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => editing && updateMutation.mutate({ id: editing.id, ...values })}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'A valid email is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="mobile" label="Mobile" rules={[{ required: true, pattern: /^\d{10}$/, message: 'Exactly 10 digits' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <TempPasswordModal
        open={!!created}
        title="User created"
        identifierLabel="Email"
        identifier={created?.email ?? ''}
        password={created?.temporaryPassword ?? null}
        onClose={() => setCreated(null)}
      />
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
