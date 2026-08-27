import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  googleId!: string;

  @Prop({ required: true, unique: true })
  email!: string;

  @Prop()
  name!: string;

  @Prop({ default: uuidv4 })
  uuid!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);