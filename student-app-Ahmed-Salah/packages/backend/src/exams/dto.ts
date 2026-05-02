import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ChoiceDto {
  @IsString() @MinLength(1) id!: string;
  @IsString() @MinLength(1) text!: string;
}

export class QuestionDto {
  @IsInt() @Min(1) ordinal!: number;
  @IsString() @MinLength(1) prompt!: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => ChoiceDto)
  choices!: ChoiceDto[];
  @IsString() @MinLength(1) correct_id!: string;
  @IsInt() @Min(1) @IsOptional() points?: number;
}

export class CreateExamDto {
  @IsString() @MinLength(1) title!: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(1) default_duration!: number;
  @IsOptional() @IsBoolean() shuffle_questions?: boolean;
  @IsOptional() @IsBoolean() is_published?: boolean;
}

export class UpdateExamDto extends CreateExamDto {}

export class ReplaceQuestionsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => QuestionDto)
  questions!: QuestionDto[];
}
