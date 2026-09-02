import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt.auth-guard';
import { AdminGuard } from './admin.guard';
import { CreateAdminDto } from './dto/create-admin.dto';
import type { JwtUser } from '../common/interfaces/jwt-user.interface';

@Controller('api/auth/admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.authService.createAdmin(dto.email, dto.password, dto.name);
  }

  @Delete(':adminId')
  async deleteAdmin(
    @Param('adminId') adminId: string,
    @Req() request: Request & { user: JwtUser },
  ) {
    return this.authService.deleteAdmin(adminId, request.user.userId);
  }
}