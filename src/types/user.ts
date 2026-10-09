export interface User {
  id: number;
  name: string;
  userCode: string;
  email: string;
  mobile: string;
  avatarUrl?: string;
  mustChangePassword: boolean;
}
