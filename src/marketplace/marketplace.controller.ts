import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { MarketplaceService } from './marketplace.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { PaginationQueryDto } from './dtos/pagination-query.dto';
import { ProductCategory } from './enums/product-category.enum';
import { JwtAuthGuard } from '../auth/jwt.auth-guard';
import { AdminGuard } from '../auth/admin.guard';
import { uploadConfig } from '../jobs/upload.config';

@Controller('/api/marketplace/products')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', uploadConfig))
  create(@Body() dto: CreateProductDto, @UploadedFile() image: Express.Multer.File | undefined, @Req() request: Request) {
    const imageUrl = image ? this.buildImageUrl(request, image.filename) : undefined;
    return this.marketplaceService.create(dto, imageUrl);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', uploadConfig))
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @UploadedFile() image: Express.Multer.File | undefined, @Req() request: Request) {
    const imageUrl = image ? this.buildImageUrl(request, image.filename) : undefined;
    return this.marketplaceService.update(id, dto, imageUrl);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  delete(@Param('id') id: string) {
    return this.marketplaceService.delete(id);
  }

  @Get()
  getAll(@Query() pagination: PaginationQueryDto) {
    return this.marketplaceService.getAll(pagination);
  }

  @Get('category/:category')
  getByCategory(@Param('category', new ParseEnumPipe(ProductCategory)) category: ProductCategory, @Query() pagination: PaginationQueryDto) {
    return this.marketplaceService.getByCategory(category, pagination);
  }

  @Get('problem/:problem')
  getByProblem(@Param('problem') problem: string, @Query() pagination: PaginationQueryDto) {
    return this.marketplaceService.getByProblem(problem, pagination);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.marketplaceService.getOne(id);
  }

  private buildImageUrl(request: Request, filename: string): string {
    return `${request.protocol}://${request.get('host')}/uploads/${filename}`;
  }
}