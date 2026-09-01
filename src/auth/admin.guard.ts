import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';
import { UserRole } from '../user/user-role.enum';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();
    return request.user?.role === UserRole.ADMIN;
  }
}
