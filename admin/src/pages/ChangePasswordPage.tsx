import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { changePassword } from '../api/auth';
import { messageOf, useAuth } from '../context/AuthContext';

export function ChangePasswordPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const onFinish = async (values: { currentPassword: string; newPassword: string }) => {
    setError(null);
    setSubmitting(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      if (user) setUser({ ...user, mustChangePassword: false });
      navigate('/', { replace: true });
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: user?.mustChangePassword ? 80 : 8 }}>
      <Card style={{ width: '100%', maxWidth: 440 }} bordered={false} title="Change password">
        {user?.mustChangePassword && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="You're signed in with a temporary password"
            description="Choose your own password to continue."
          />
        )}
        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}
        <Form form={form} layout="vertical" onFinish={onFinish} disabled={submitting}>
          <Form.Item name="currentPassword" label="Current password" rules={[{ required: true, message: 'Required' }]}>
            <Input.Password autoComplete="current-password" autoFocus />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New password"
            rules={[
              { required: true, message: 'Required' },
              { min: 10, message: 'At least 10 characters' },
              { pattern: /[A-Za-z]/, message: 'Must contain a letter' },
              { pattern: /\d/, message: 'Must contain a digit' },
            ]}
            extra="At least 10 characters, with a letter and a digit."
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm new password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Required' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              Update password
            </Button>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary">You'll stay signed in — this just refreshes your session.</Typography.Text>
      </Card>
    </div>
  );
}
