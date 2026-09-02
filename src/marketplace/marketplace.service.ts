import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, QueryFilter } from 'mongoose';
import { CreateProductDto } from './dtos/create-product.dto';
import { PaginationQueryDto } from './dtos/pagination-query.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { ProductCategory } from './enums/product-category.enum';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class MarketplaceService {
  constructor(@InjectModel(Product.name) private readonly productModel: Model<ProductDocument>) {}

  create(dto: CreateProductDto, imageUrl?: string) {
    return this.productModel.create({
      ...this.normalize(dto),
      ...(imageUrl && { imageUrl }),
    });
  }

  async update(id: string, dto: UpdateProductDto, imageUrl?: string) {
    this.validateId(id);
    const product = await this.productModel.findByIdAndUpdate(
      id,
      {
        ...this.normalize(dto),
        ...(imageUrl && { imageUrl }),
      },
      { new: true, runValidators: true },
    );
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async delete(id: string) {
    this.validateId(id);
    const product = await this.productModel.findByIdAndDelete(id);
    if (!product) throw new NotFoundException('Product not found');
    return { deleted: true };
  }

  async getOne(id: string) {
    this.validateId(id);
    const product = await this.productModel.findById(id).lean().exec();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  getAll(pagination: PaginationQueryDto) {
    return this.paginate({}, pagination);
  }

  getByCategory(category: ProductCategory, pagination: PaginationQueryDto) {
    return this.paginate({ category }, pagination);
  }

  getByProblem(problem: string, pagination: PaginationQueryDto) {
    const normalizedProblem = problem.trim().toLowerCase();
    return this.paginate({ problemKeywords: normalizedProblem }, pagination);
  }

  private async paginate(filter: QueryFilter<ProductDocument>, { page, limit }: PaginationQueryDto) {
    const [items, total] = await Promise.all([
      this.productModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);
    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private normalize<T extends CreateProductDto | UpdateProductDto>(dto: T): T {
    return {
      ...dto,
      ...(dto.problemKeywords && {
        problemKeywords: [...new Set(dto.problemKeywords.map((keyword) => keyword.trim().toLowerCase()))].filter(Boolean),
      }),
      ...(dto.currency && { currency: dto.currency.toUpperCase() }),
    };
  }

  private validateId(id: string): void {
    if (!isValidObjectId(id)) throw new BadRequestException('Invalid product id');
  }
}