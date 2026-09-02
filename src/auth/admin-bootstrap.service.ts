import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../user/user.schema';
import { UserRole } from '../user/user-role.enum';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.configService.get<string>('admin.email')?.trim().toLowerCase();
    const password = this.configService.get<string>('admin.password');
    const saltRounds = this.configService.get<number>('security.bcryptSaltRounds') ?? 12;

    if (!email || !password) {
      this.logger.warn('Default admin credentials are not configured. Admin bootstrap skipped.');
      return;
    }

    const existingUser = await this.userModel.findOne({ email });

    if (existingUser) {
      if (existingUser.role === UserRole.ADMIN) {
        this.logger.log(`Default admin already exists: ${email}`);
        return;
      }
      this.logger.error(`Cannot bootstrap admin. Email ${email} already belongs to a non-admin user.`);
      return;
    }

    const passwordHash = await bcrypt.hash(password, saltRounds);

    await this.userModel.create({
      email,
      name: 'Default Admin',
      role: UserRole.ADMIN,
      passwordHash,
    });

    this.logger.log(`Default admin created: ${email}`);
  }
}