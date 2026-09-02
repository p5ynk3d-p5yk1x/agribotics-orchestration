import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, resolve } from 'path';

const uploadDirectory = resolve(process.cwd(), 'uploads');

if (!existsSync(uploadDirectory)) mkdirSync(uploadDirectory, { recursive: true });

export const uploadConfig = {
  storage: diskStorage({
    destination: uploadDirectory,
    filename: (_, file, cb) => {
      cb(null, `${Date.now()}${extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new BadRequestException('Only jpeg, png, and webp files are allowed'), false);
    }
    cb(null, true);
  },
};