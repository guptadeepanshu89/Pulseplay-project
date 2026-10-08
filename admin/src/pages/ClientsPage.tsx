import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd';
import { useState } from 'react';

import { createClient, deleteClient, listClients, setClientActive, updateClient } from '../api/clients';
import { messageOf } from '../context/AuthContext';
import { TempPasswordModal } from '../components/TempPasswordModal';
import type { Client } from '../types';

export function ClientsPage() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, page, pageSize }],
    queryFn: () => listClients({ search: search || undefined, page, pageSize }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['clients'] });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: (result) => {
      setCreateOpen(false);
      createForm.resetFields();
      setCreated({ email: result.admin.email, temporaryPassword: result.admin.temporaryPassword });
      invalidate();
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (values: { id: number; name: string }) => updateClient(values.id, values.name),
    onSuccess: () => {
      setEditing(null);
      invalidate();
      message.success('Client updated');
    },
    onError: (err) => message.error(messageOf(err)),
  });

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

  return (
    <>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Clients
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          New client
        </Button>
      </Space>

      <Input.Search
        placeholder="Search by name or code"
        allowClear
        style={{ maxWidth: 320, marginBottom: 16 }}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />

      <Table<Client>
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
          { title: 'Code', dataIndex: 'code' },
          { title: 'Name', dataIndex: 'name' },
          {
            title: 'Status',
            dataIndex: 'isActive',
            render: (isActive: boolean) => <Tag color={isActive ? 'green' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Tag>,
          },
          { title: 'Created', dataIndex: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString() },
          {
            title: 'Actions',
            render: (_, client) => (
              <Space>
                <Button size="small" onClick={() => { setEditing(client); editForm.setFieldsValue({ name: client.name }); }}>
                  Rename
                </Button>
                <Switch
                  checked={client.isActive}
                  checkedChildren="Active"
                  unCheckedChildren="Inactive"
                  onChange={(checked) => toggleActiveMutation.mutate({ id: client.id, active: checked })}
                  loading={toggleActiveMutation.isPending && toggleActiveMutation.variables?.id === client.id}
                />
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

      <Modal
        title="New client"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        okText="Create"
      >
        <Form form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="code" label="Client code" rules={[{ required: true, pattern: /^[A-Za-z0-9_-]{2,20}$/, message: '2–20 letters, numbers, "_" or "-"' }]} extra="Cannot be changed later.">
            <Input placeholder="e.g. NITIN" />
          </Form.Item>
          <Form.Item name="name" label="Client name" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. Nitin Enterprises" />
          </Form.Item>
          <Typography.Text type="secondary">First Client Admin</Typography.Text>
          <Form.Item name={['admin', 'name']} label="Admin name" rules={[{ required: true, message: 'Required' }]} style={{ marginTop: 8 }}>
            <Input />
          </Form.Item>
          <Form.Item name={['admin', 'email']} label="Admin email" rules={[{ required: true, type: 'email', message: 'A valid email is required' }]}>
            <Input />
          </Form.Item>
          <Form.Item name={['admin', 'mobile']} label="Admin mobile" rules={[{ required: true, pattern: /^\d{10}$/, message: 'Exactly 10 digits' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Rename client"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
      >
        <Form form={editForm} layout="vertical" onFinish={(values) => editing && updateMutation.mutate({ id: editing.id, name: values.name })}>
          <Form.Item name="name" label="Client name" rules={[{ required: true, message: 'Required' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <TempPasswordModal
        open={!!created}
        title="Client created"
        identifierLabel="Admin email"
        identifier={created?.email ?? ''}
        password={created?.temporaryPassword ?? null}
        onClose={() => setCreated(null)}
      />
    </>
  );
}
