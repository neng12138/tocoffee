import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateSpecGroupDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  multiSelect?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  minSelect?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSelect?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;
}

export class UpdateSpecGroupDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  multiSelect?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  minSelect?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSelect?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;
}

export class CreateSpecOptionDto {
  @IsString()
  @Length(1, 50)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(-100000)
  @Max(100000)
  priceDeltaCents?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;
}

export class UpdateSpecOptionDto {
  @IsOptional()
  @IsString()
  @Length(1, 50)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(-100000)
  @Max(100000)
  priceDeltaCents?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  sort?: number;
}
