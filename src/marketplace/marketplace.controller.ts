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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MarketplaceService } from './marketplace.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { PaginationQueryDto } from './dtos/pagination-query.dto';
import { ProductCategory } from './enums/product-category.enum';
import { JwtAuthGuard } from '../auth/jwt.auth-guard';
import { AdminGuard } from '../auth/admin.guard';
import { uploadConfig } from '../common/upload.config';

@Controller('/api/marketplace/products')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', uploadConfig))
  create(@Body() dto: CreateProductDto, @UploadedFile() image: Express.Multer.File | undefined) {
    return this.marketplaceService.create(dto, image);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('image', uploadConfig))
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @UploadedFile() image: Express.Multer.File | undefined) {
    return this.marketplaceService.update(id, dto, image);
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
}