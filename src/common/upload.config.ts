import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

export const uploadConfig = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_: unknown, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.mimetype)) {
      return cb(new BadRequestException('Only jpeg, png, and webp files are allowed'), false);
    }

    cb(null, true);
  },
};