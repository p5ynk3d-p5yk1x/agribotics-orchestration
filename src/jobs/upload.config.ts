import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, resolve } from 'path';

export const uploadConfig = {
  storage: diskStorage({
    destination: resolve(process.cwd(), 'uploads'),

    filename: (_, file, cb) => {
      cb(null, `${Date.now()}${extname(file.originalname)}`);
    },
  }),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (_, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new BadRequestException(
          'Only jpeg, png, and webp files are allowed',
        ),
        false,
      );
    }

    cb(null, true);
  },
};