import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabsParamList = {
  Home: undefined;
  Markets: undefined;
  Wallet: undefined;
  MyBets: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  ForgotPassword: undefined;
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  MarketDetail: { marketId: number };
  CryptoDetail: { eventId: number };
  Football: undefined;
  Election: undefined;
  LiveMatch: { eventId: number };
  BetSlip: undefined;
  BetConfirmation: undefined;
  WalletTransactions: undefined;
  PermissionRequests: undefined;
  CreateRequest: undefined;
  BetDetail: { betId: number };
  Notifications: undefined;
  PersonalInfo: undefined;
  ChangePassword: undefined;
  HelpSupport: undefined;
  AboutUs: undefined;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- required for React Navigation's declaration merging
    interface RootParamList extends RootStackParamList {}
  }
}
