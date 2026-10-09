import { BankOutlined, ClockCircleOutlined, TrophyOutlined, WalletOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Typography } from 'antd';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchDashboard } from '../api/dashboard';
import { useHeaderExtras } from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';

const cardStyle = { boxShadow: '0 1px 2px rgba(46,16,101,0.06)' };

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => fetchDashboard() });

  const headerExtras = useMemo(
    () => (
      <Typography.Title level={4} style={{ margin: 0, whiteSpace: 'nowrap', fontWeight: 650 }}>
        {user?.role === 'SUPER_ADMIN' ? 'Platform overview' : `${user?.client?.name ?? 'Your client'} overview`}
      </Typography.Title>
    ),
    [user?.role, user?.client?.name],
  );
  useHeaderExtras(headerExtras);

  return (
    <>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0, marginBottom: 16 }}>
        Live snapshot of activity across your scope.
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {user?.role === 'SUPER_ADMIN' && (
          <Col xs={24} sm={12} lg={8} xl={6}>
            <Card
              className="pp-dash-card"
              loading={isLoading}
              bordered={false}
              style={cardStyle}
              onClick={() => navigate('/clients?status=active')}
            >
              <Statistic title="Active clients" value={data?.activeClients} prefix={<BankOutlined />} />
            </Card>
          </Col>
        )}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            className="pp-dash-card"
            loading={isLoading}
            bordered={false}
            style={cardStyle}
            onClick={() => navigate('/users?role=CLIENT_USER&status=active')}
          >
            <Statistic title="Active players" value={data?.activeUsers} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            className="pp-dash-card"
            loading={isLoading}
            bordered={false}
            style={cardStyle}
            onClick={() => navigate('/fund-requests?status=PENDING')}
          >
            <Statistic
              title="Pending fund requests"
              value={data?.pendingRequests}
              prefix={<WalletOutlined />}
              valueStyle={data && data.pendingRequests > 0 ? { color: '#d48806' } : undefined}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            className="pp-dash-card"
            loading={isLoading}
            bordered={false}
            style={cardStyle}
            onClick={() => navigate('/bets?status=OPEN')}
          >
            <Statistic title="Open bets" value={data?.openBets} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={6}>
          <Card
            className="pp-dash-card"
            loading={isLoading}
            bordered={false}
            style={cardStyle}
            onClick={() => navigate('/bets?status=OPEN')}
          >
            <Statistic title="Staked on open bets" value={data?.openStake} precision={2} prefix="₹" />
          </Card>
        </Col>
      </Row>
    </>
  );
}
