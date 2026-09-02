import { Body, Controller, Post } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('/api/auth')
export class AuthController {
  private readonly client: OAuth2Client;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>('google.clientId');
    this.client = new OAuth2Client(clientId);
  }

  @Post('google/mobile')
  async googleMobileLogin(@Body() body: { idToken: string }) {
    const { idToken } = body;

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience: this.configService.get<string>('google.clientId'),
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new Error('Invalid Google token');
    }

    const user = await this.authService.validateOAuthUser({
      profile: {
        id: payload.sub,
        emails: [{ value: payload.email }],
        displayName: payload.name,
      },
    });

    const token = this.authService.generateJwt(user);

    return { accessToken: token };
  }

  @Post('admin/login')
  async adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.loginAdmin(dto.email, dto.password);
  }
}