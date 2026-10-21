import {
  BankOutlined,
  CloseOutlined,
  DashboardOutlined,
  LineChartOutlined,
  LogoutOutlined,
  MenuOutlined,
  TeamOutlined,
  TrophyOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Dropdown, Grid, Layout, Menu, Space, Tag, theme } from 'antd';
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
  const [navOpen, setNavOpen] = useState(false);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.lg === false;

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, isMobile]);
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
        {isMobile && navOpen && (
          <button type="button" className="pp-sider-mask" aria-label="Close menu" onClick={() => setNavOpen(false)} />
        )}
        <Sider
          className="pp-app-sider"
          width={232}
          collapsedWidth={0}
          collapsed={isMobile && !navOpen}
          trigger={null}
          collapsible
        >
          <div className="pp-sider-brand">PulsePlay Admin</div>
          <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={items} style={{ borderInlineEnd: 0, marginTop: 8 }} />
        </Sider>
        <Layout className="pp-app-main">
          <Header
            className="pp-app-header"
            style={{
              background: colorBgContainer,
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
            <div className="pp-header-tools">
              {isMobile && (
                <Button
                  className="pp-nav-toggle"
                  type="text"
                  aria-label={navOpen ? 'Close menu' : 'Open menu'}
                  icon={navOpen ? <CloseOutlined /> : <MenuOutlined />}
                  onClick={() => setNavOpen((open) => !open)}
                />
              )}
              {headerExtras}
            </div>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space className="pp-user-chip" size={10}>
                <Avatar style={{ background: '#5b21b6' }}>{user?.name.slice(0, 1).toUpperCase()}</Avatar>
                <span className="pp-user-label">{user?.name}</span>
                <span className="pp-user-tags">
                  <Tag color={user?.role === 'SUPER_ADMIN' ? 'gold' : 'purple'}>{user ? roleLabel[user.role] : ''}</Tag>
                  {user?.client && <Tag>{user.client.name}</Tag>}
                </span>
              </Space>
            </Dropdown>
          </Header>
          <Content className="pp-app-content">{children}</Content>
        </Layout>
      </Layout>
    </HeaderExtrasContext.Provider>
  );
}
