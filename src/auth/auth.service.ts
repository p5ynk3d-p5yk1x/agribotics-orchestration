import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { User, UserDocument } from '../user/user.schema';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService, @InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async validateOAuthUser(data: any) {
    const { profile } = data;

    if (!profile.emails || profile.emails.length === 0) {
      throw new Error('No email from Google');
    }

    const email = profile.emails[0].value;

    let user = await this.userModel.findOne({ googleId: profile.id });

    if (!user) {
      user = await this.userModel.create({
          googleId: profile.id,
          email,
          name: profile.displayName
        });
      } else {
          user.name = profile.displayName;
          await user.save();
      }
      return user;
    }

  generateJwt(user: any) {
    const payload = {
        sub: user._id,
        email: user.email,
    };

    return this.jwtService.sign(payload);
  }
}   