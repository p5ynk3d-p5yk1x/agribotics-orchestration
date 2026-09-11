import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateSoilJobDto {
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  nitrogenLevel!: number;

  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  potassiumLevel!: number;

  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  phosphorousLevel!: number;

  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  organicCarbonLevel!: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  ironLevel?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  zincLevel?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  manganeseLevel?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  copperLevel?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  boronLevel?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  sulphurLevel?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  salinityLevel?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  electricalConductivity?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false,allowInfinity: false })
  @Min(0)
  @Max(14)
  pH?: number;
}