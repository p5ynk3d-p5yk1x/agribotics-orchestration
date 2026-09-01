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
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { JwtAuthGuard } from '../auth/jwt.auth-guard';
import { CreateProductDto } from './dtos/create-product.dto';
import { PaginationQueryDto } from './dtos/pagination-query.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { ProductCategory } from './enums/product-category.enum';
import { MarketplaceService } from './marketplace.service';

@Controller('/api/marketplace/products')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateProductDto) {
    return this.marketplaceService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.marketplaceService.update(id, dto);
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
  getByCategory(
    @Param('category', new ParseEnumPipe(ProductCategory))
    category: ProductCategory,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.marketplaceService.getByCategory(category, pagination);
  }

  @Get('problem/:problem')
  getByProblem(
    @Param('problem') problem: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.marketplaceService.getByProblem(problem, pagination);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.marketplaceService.getOne(id);
  }
}
