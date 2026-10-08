import {
  BankOutlined,
  DashboardOutlined,
  LineChartOutlined,
  LogoutOutlined,
  TeamOutlined,
  TrophyOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Avatar, Dropdown, Layout, Menu, Space, Tag, theme } from 'antd';
import type { ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;

const roleLabel = { SUPER_ADMIN: 'Super Admin', CLIENT_ADMIN: 'Client Admin', CLIENT_USER: 'Player' } as const;

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
    { key: '/users', icon: <TeamOutlined />, label: <Link to="/users">Users</Link> },
    { key: '/fund-requests', icon: <WalletOutlined />, label: <Link to="/fund-requests">Fund Requests</Link> },
    { key: '/bets', icon: <TrophyOutlined />, label: <Link to="/bets">Bets</Link> },
    ...(user?.role === 'SUPER_ADMIN'
      ? [
          { key: '/clients', icon: <BankOutlined />, label: <Link to="/clients">Clients</Link> },
          { key: '/markets', icon: <LineChartOutlined />, label: <Link to="/markets">Markets</Link> },
        ]
      : []),
  ];

  const selectedKey = items.map((item) => item.key).includes(location.pathname) ? location.pathname : '/';

  const userMenu = {
    items: [
      { key: 'change-password', label: <Link to="/change-password">Change password</Link> },
      { key: 'logout', label: 'Log out', icon: <LogoutOutlined />, onClick: async () => { await logout(); navigate('/login'); } },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, padding: '18px 24px' }}>PulsePlay Admin</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: colorBgContainer, padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar>{user?.name.slice(0, 1).toUpperCase()}</Avatar>
              <span>{user?.name}</span>
              <Tag color={user?.role === 'SUPER_ADMIN' ? 'gold' : 'blue'}>{user ? roleLabel[user.role] : ''}</Tag>
              {user?.client && <Tag>{user.client.name}</Tag>}
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24 }}>{children}</Content>
      </Layout>
    </Layout>
  );
}
