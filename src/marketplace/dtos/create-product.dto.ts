import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { ProductCategory } from '../enums/product-category.enum';

export class CreateProductDto {
  @IsString()
  @MaxLength(150)
  name!: string;

  @IsString()
  @MaxLength(3000)
  description!: string;

  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  problemKeywords!: string[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsUrl({ require_protocol: true })
  affiliateUrl!: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;
}
