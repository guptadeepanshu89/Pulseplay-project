import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { messageOf, useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: Location } };
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only staff may skip the login form. A Player session (e.g. mobile cookie on
  // the same host) must stay on this page — ProtectedRoute clears it.
  if (user && (user.role === 'SUPER_ADMIN' || user.role === 'CLIENT_ADMIN')) {
    return (
      <Navigate
        to={Boolean(user.mustChangePassword) ? '/change-password' : (location.state?.from?.pathname ?? '/')}
        replace
      />
    );
  }

  const onFinish = async (values: { identifier: string; password: string }) => {
    setError(null);
    setSubmitting(true);
    try {
      const next = await login(values.identifier, values.password);
      navigate(Boolean(next.mustChangePassword) ? '/change-password' : (location.state?.from?.pathname ?? '/'), {
        replace: true,
      });
    } catch (err) {
      // WRONG_APP is exactly the case a player mistakenly using this panel hits.
      setError(messageOf(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pp-new-user pp-new-user--solo pp-login-page">
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
        <Card className="pp-new-user__card pp-login-card" bordered={false}>
          <div className="pp-new-user__accent" />
          <Typography.Title level={3} className="pp-login-title">
            PulsePlay Admin
          </Typography.Title>
          <Typography.Text type="secondary" className="pp-login-subtitle">
            Sign in with your admin account
          </Typography.Text>
          {error && <Alert type="error" message={error} showIcon className="pp-login-error" />}
          <Form
            layout="vertical"
            onFinish={onFinish}
            disabled={submitting}
            requiredMark={false}
            className="pp-new-user__form"
          >
            <Form.Item name="identifier" label="Email or mobile" rules={[{ required: true, message: 'Required' }]}>
              <Input size="large" prefix={<UserOutlined />} autoFocus autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Required' }]}>
              <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" block size="large" loading={submitting} className="pp-new-user__submit">
                Sign in
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}
