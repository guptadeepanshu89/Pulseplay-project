import { BankOutlined, ClockCircleOutlined, TrophyOutlined, WalletOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Card, Col, Row, Statistic, Typography } from 'antd';

import { fetchDashboard } from '../api/dashboard';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: () => fetchDashboard() });

  return (
    <>
      <Typography.Title level={3}>
        {user?.role === 'SUPER_ADMIN' ? 'Platform overview' : `${user?.client?.name ?? 'Your client'} overview`}
      </Typography.Title>
      <Row gutter={16}>
        {user?.role === 'SUPER_ADMIN' && (
          <Col xs={24} sm={12} lg={6}>
            <Card loading={isLoading}>
              <Statistic title="Active clients" value={data?.activeClients} prefix={<BankOutlined />} />
            </Card>
          </Col>
        )}
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic title="Active players" value={data?.activeUsers} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic title="Pending fund requests" value={data?.pendingRequests} prefix={<WalletOutlined />} valueStyle={data && data.pendingRequests > 0 ? { color: '#d48806' } : undefined} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic title="Open bets" value={data?.openBets} prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={isLoading}>
            <Statistic title="Staked on open bets" value={data?.openStake} precision={2} prefix="₹" />
          </Card>
        </Col>
      </Row>
    </>
  );
}
