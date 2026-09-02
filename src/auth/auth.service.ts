import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../user/user.schema';
import { UserRole } from '../user/user-role.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async validateOAuthUser(data: any) {
    const { profile } = data;

    if (!profile.emails || profile.emails.length === 0) {
      throw new Error('No email from Google');
    }

    const email = profile.emails[0].value.trim().toLowerCase();

    let user = await this.userModel.findOne({ googleId: profile.id });

    if (!user) {
      const existingEmailUser = await this.userModel.findOne({ email });
      if (existingEmailUser) {
        throw new UnauthorizedException('Account cannot be authenticated using Google');
      }
      user = await this.userModel.create({
        googleId: profile.id,
        email,
        name: profile.displayName,
        role: UserRole.USER,
      });
    } else {
      user.name = profile.displayName;
      await user.save();
    }
    return user;
  }

  async loginAdmin(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const admin = await this.userModel.findOne({email: normalizedEmail,role: UserRole.ADMIN,}).select('+passwordHash');

    if (!admin?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      accessToken: this.generateJwt(admin),
    };
  }
  async createAdmin(email: string, password: string, name: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.userModel.findOne({ email: normalizedEmail });

    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const saltRounds = this.configService.get<number>('security.bcryptSaltRounds') ?? 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const admin = await this.userModel.create({
      email: normalizedEmail,
      name,
      role: UserRole.ADMIN,
      passwordHash,
    });

    return {
      id: admin._id.toString(),
      uuid: admin.uuid,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
  }

  async deleteAdmin(adminId: string, requestingAdminId: string) {
    if (!isValidObjectId(adminId)) {
      throw new BadRequestException('Invalid admin ID');
    }

    if (adminId === requestingAdminId) {
      throw new BadRequestException('You cannot delete your own admin account');
    }

    const admin = await this.userModel.findOne({
      _id: adminId,
      role: UserRole.ADMIN,
    });

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    const defaultAdminEmail = this.configService.get<string>('admin.email')?.trim().toLowerCase();

    if (admin.email === defaultAdminEmail) {
      throw new BadRequestException('The default admin cannot be deleted');
    }

    await this.userModel.deleteOne({ _id: admin._id });

    return {
      message: 'Admin deleted successfully',
    };
  }

  generateJwt(user: UserDocument) {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }
}