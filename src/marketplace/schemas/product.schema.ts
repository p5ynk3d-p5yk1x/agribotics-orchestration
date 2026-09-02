import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ProductCategory } from '../enums/product-category.enum';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ type: String, enum: ProductCategory, required: true, index: true })
  category!: ProductCategory;

  @Prop({ type: [String], required: true, index: true })
  problemKeywords!: string[];

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, trim: true })
  currency!: string;

  @Prop({ required: true, trim: true })
  affiliateUrl!: string;

  @Prop({ trim: true })
  imageUrl?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);