import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
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

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsString()
  affiliateUrl!: string;
}