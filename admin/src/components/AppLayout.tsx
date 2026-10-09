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
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

const { Header, Sider, Content } = Layout;

const roleLabel = { SUPER_ADMIN: 'Super Admin', CLIENT_ADMIN: 'Client Admin', CLIENT_USER: 'Player' } as const;

const HeaderExtrasContext = createContext<(node: ReactNode | null) => void>(() => {});

/** Page mounts its left-header controls here; cleared on unmount. */
export function useHeaderExtras(node: ReactNode | null) {
  const setExtras = useContext(HeaderExtrasContext);
  useEffect(() => {
    setExtras(node);
    return () => setExtras(null);
  }, [node, setExtras]);
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [headerExtras, setHeaderExtras] = useState<ReactNode | null>(null);
  const {
    token: { colorBgContainer, boxShadowTertiary },
  } = theme.useToken();

  const items = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
    { key: '/users', icon: <TeamOutlined />, label: <Link to="/users">Users</Link> },
    { key: '/fund-requests', icon: <WalletOutlined />, label: <Link to="/fund-requests">Fund Requests</Link> },
    { key: '/bets', icon: <TrophyOutlined />, label: <Link to="/bets">Active Orders</Link> },
    ...(user?.role === 'SUPER_ADMIN'
      ? [
          { key: '/clients', icon: <BankOutlined />, label: <Link to="/clients">Clients</Link> },
          { key: '/markets', icon: <LineChartOutlined />, label: <Link to="/markets">Markets</Link> },
        ]
      : []),
  ];

  const selectedKey = items.map((item) => item.key).includes(location.pathname)
    ? location.pathname
    : location.pathname.startsWith('/users')
      ? '/users'
      : location.pathname.startsWith('/clients')
        ? '/clients'
        : '/';

  const userMenu = {
    items: [
      { key: 'change-password', label: <Link to="/change-password">Change password</Link> },
      {
        key: 'logout',
        label: 'Log out',
        icon: <LogoutOutlined />,
        onClick: async () => {
          await logout();
          navigate('/login');
        },
      },
    ],
  };

  return (
    <HeaderExtrasContext.Provider value={setHeaderExtras}>
      <Layout className="pp-app-shell">
        <Sider className="pp-app-sider" breakpoint="lg" collapsedWidth={0} width={232}>
          <div className="pp-sider-brand">PulsePlay Admin</div>
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} style={{ borderInlineEnd: 0, marginTop: 8 }} />
        </Sider>
        <Layout className="pp-app-main">
          <Header
            className="pp-app-header"
            style={{
              background: colorBgContainer,
              padding: '10px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              borderBottom: '1px solid #ebe4f5',
              boxShadow: boxShadowTertiary,
              height: 'auto',
              minHeight: 60,
              lineHeight: 'normal',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
              {headerExtras}
            </div>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space size={10} style={{ cursor: 'pointer', flexShrink: 0 }}>
                <Avatar style={{ background: '#5b21b6' }}>{user?.name.slice(0, 1).toUpperCase()}</Avatar>
                <span style={{ fontWeight: 600 }}>{user?.name}</span>
                <Tag color={user?.role === 'SUPER_ADMIN' ? 'gold' : 'purple'}>{user ? roleLabel[user.role] : ''}</Tag>
                {user?.client && <Tag>{user.client.name}</Tag>}
              </Space>
            </Dropdown>
          </Header>
          <Content className="pp-app-content">{children}</Content>
        </Layout>
      </Layout>
    </HeaderExtrasContext.Provider>
  );
}
