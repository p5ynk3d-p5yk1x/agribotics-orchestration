import { UserRole } from '../../user/user-role.enum';

export interface JwtUser {
  userId: string;
  email: string;
  role: UserRole;
}
