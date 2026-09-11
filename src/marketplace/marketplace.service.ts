import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model, QueryFilter } from 'mongoose';
import { v4 as uuid } from 'uuid';
import { S3StorageService } from '../common/storage/s3.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { PaginationQueryDto } from './dtos/pagination-query.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { ProductCategory } from './enums/product-category.enum';
import { Product, ProductDocument } from './schemas/product.schema';

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly s3StorageService: S3StorageService,
  ) {}

  async create(dto: CreateProductDto, image?: Express.Multer.File) {
    const productId = uuid();
    const imageKey = image ? this.s3StorageService.getProductKey(productId) : undefined;

    if (image && imageKey) {
      await this.s3StorageService.upload(image, imageKey);
    }

    try {
      const product = await this.productModel.create({
        productId,
        ...this.normalize(dto),
        ...(imageKey && { imageKey }),
      });

      return this.withImageUrl(product.toObject());
    } catch (error) {
      if (imageKey) await this.s3StorageService.delete(imageKey).catch(() => undefined);
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto, image?: Express.Multer.File) {
    this.validateId(id);

    const existingProduct = await this.productModel.findById(id);
    if (!existingProduct) throw new NotFoundException('Product not found');

    let imageKey: string | undefined;

    if (image) {
      imageKey = this.s3StorageService.getProductKey(existingProduct.productId);
      await this.s3StorageService.upload(image, imageKey);
    }

    const product = await this.productModel.findByIdAndUpdate(
      id,
      {
        ...this.normalize(dto),
        ...(imageKey && { imageKey }),
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!product) throw new NotFoundException('Product not found');
    return this.withImageUrl(product.toObject());
  }

  async delete(id: string) {
    this.validateId(id);

    const product = await this.productModel.findByIdAndDelete(id);
    if (!product) throw new NotFoundException('Product not found');

    if (product.imageKey) {
      await this.s3StorageService.delete(product.imageKey).catch(() => undefined);
    }

    return {
      deleted: true,
    };
  }
  async getOne(id: string) {
    this.validateId(id);

    const product = await this.productModel.findById(id).lean().exec();
    if (!product) throw new NotFoundException('Product not found');

    return this.withImageUrl(product);
  }

  async getAll(pagination: PaginationQueryDto) {
    return this.paginate({}, pagination);
  }

  async getByCategory(category: ProductCategory, pagination: PaginationQueryDto) {
    return this.paginate({ category }, pagination);
  }

  async getByProblem(problem: string, pagination: PaginationQueryDto) {
    const normalizedProblem = problem.trim().toLowerCase();
    return this.paginate({ problemKeywords: normalizedProblem }, pagination);
  }

  private async paginate(filter: QueryFilter<ProductDocument>, { page, limit }: PaginationQueryDto) {
    const [products, total] = await Promise.all([
      this.productModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    const items = await Promise.all(products.map((product) => this.withImageUrl(product)));

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

  private async withImageUrl<T extends { imageKey?: string }>(product: T): Promise<T & { imageUrl?: string }> {
    if (!product.imageKey) return product;

    return {
      ...product,
      imageUrl: await this.s3StorageService.createSignedUrl(product.imageKey),
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