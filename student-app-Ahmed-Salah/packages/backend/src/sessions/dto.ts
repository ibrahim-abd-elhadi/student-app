import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateSessionDto {
  @IsUUID() exam_id!: string;

  @IsArray() @ArrayMinSize(1) @IsUUID('4', { each: true })
  student_ids!: string[];

  @IsInt() @Min(1) @Max(360)
  duration_minutes!: number;
}
