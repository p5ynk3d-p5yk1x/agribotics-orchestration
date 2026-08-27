import { Controller, Post, Body } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';


@Controller('auth')
export class AuthController {
  private client: OAuth2Client;
  constructor(private authService: AuthService, private configService: ConfigService,) {
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
}