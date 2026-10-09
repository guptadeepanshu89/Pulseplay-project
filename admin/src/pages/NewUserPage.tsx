import {
  BankOutlined,
  MailOutlined,
  MobileOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Button, Card, Col, Form, Input, Row, Select, Space } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { listClients } from '../api/clients';
import { createUser } from '../api/users';
import { useHeaderExtras } from '../components/AppLayout';
import { TempPasswordModal } from '../components/TempPasswordModal';
import { messageOf, useAuth } from '../context/AuthContext';

export function NewUserPage() {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(null);

  const { data: clientOptions } = useQuery({
    queryKey: ['clients', 'options'],
    queryFn: () => listClients({ pageSize: 100, isActive: true }),
    enabled: isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: (result) => {
      form.resetFields();
      setCreated({ email: result.user.email, temporaryPassword: result.temporaryPassword });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => message.error(messageOf(err)),
  });

  const headerExtras = useMemo(
    () => <span className="pp-new-user__header-title">Create New User</span>,
    [],
  );
  useHeaderExtras(headerExtras);

  return (
    <>
      <div className="pp-new-user pp-new-user--solo">
        <div className="pp-solo-bg" aria-hidden>
          <span className="pp-solo-bg__glow pp-solo-bg__glow--a" />
          <span className="pp-solo-bg__glow pp-solo-bg__glow--b" />
          <span className="pp-solo-bg__glow pp-solo-bg__glow--c" />
          <span className="pp-solo-bg__glow pp-solo-bg__glow--d" />
          <span className="pp-solo-bg__orb pp-solo-bg__orb--a" />
          <span className="pp-solo-bg__orb pp-solo-bg__orb--b" />
          <span className="pp-solo-bg__orb pp-solo-bg__orb--c" />
          <span className="pp-solo-bg__arc pp-solo-bg__arc--a" />
          <span className="pp-solo-bg__arc pp-solo-bg__arc--b" />
          <span className="pp-solo-bg__arc pp-solo-bg__arc--c" />
          <span className="pp-solo-bg__dots pp-solo-bg__dots--tl" />
          <span className="pp-solo-bg__dots pp-solo-bg__dots--br" />
        </div>

        <div className="pp-new-user__shell">
          <Card className="pp-new-user__card" bordered={false}>
            <div className="pp-new-user__accent" />

            <Form
              form={form}
              layout="vertical"
              requiredMark
              className="pp-new-user__form"
              onFinish={(values) => {
                createMutation.mutate(
                  isSuperAdmin
                    ? {
                        name: values.name,
                        email: values.email,
                        mobile: values.mobile,
                        clientId: values.clientId,
                        role: values.role ?? 'CLIENT_USER',
                      }
                    : { name: values.name, email: values.email, mobile: values.mobile },
                );
              }}
            >
              <Row gutter={[18, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Required' }]}>
                    <Input size="large" placeholder="Full name" prefix={<UserOutlined />} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[{ required: true, type: 'email', message: 'A valid email is required' }]}
                  >
                    <Input size="large" placeholder="user@example.com" prefix={<MailOutlined />} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="mobile"
                    label="Mobile"
                    rules={[{ required: true, pattern: /^\d{10}$/, message: 'Exactly 10 digits' }]}
                  >
                    <Input size="large" placeholder="10-digit mobile" maxLength={10} prefix={<MobileOutlined />} />
                  </Form.Item>
                </Col>
                {isSuperAdmin && (
                  <Col xs={24} md={12}>
                    <Form.Item name="clientId" label="Client" rules={[{ required: true, message: 'Required' }]}>
                      <Select
                        size="large"
                        placeholder="Select client"
                        prefix={<BankOutlined />}
                        options={clientOptions?.items.map((c) => ({ value: c.id, label: c.name }))}
                      />
                    </Form.Item>
                  </Col>
                )}
                {isSuperAdmin && (
                  <Col xs={24} md={12}>
                    <Form.Item name="role" label="Role" initialValue="CLIENT_USER">
                      <Select
                        size="large"
                        prefix={<TeamOutlined />}
                        options={[
                          { value: 'CLIENT_USER', label: 'Player' },
                          { value: 'CLIENT_ADMIN', label: 'Client Admin' },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                )}
              </Row>

              <Space className="pp-new-user__actions" wrap>
                <Button size="large" className="pp-new-user__cancel" onClick={() => navigate('/users')}>
                  Cancel
                </Button>
                <Button
                  type="primary"
                  size="large"
                  htmlType="submit"
                  className="pp-new-user__submit"
                  icon={<UserAddOutlined />}
                  loading={createMutation.isPending}
                  disabled={createMutation.isPending}
                >
                  Create User
                </Button>
              </Space>
            </Form>
          </Card>
        </div>
      </div>

      <TempPasswordModal
        open={!!created}
        title="User created"
        identifierLabel="Email"
        identifier={created?.email ?? ''}
        password={created?.temporaryPassword ?? null}
        onClose={() => {
          setCreated(null);
          navigate('/users');
        }}
      />
    </>
  );
}
