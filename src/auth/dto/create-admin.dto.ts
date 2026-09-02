import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(12)
  password!: string;

  @IsString()
  name!: string;
}