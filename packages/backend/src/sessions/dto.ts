import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateSessionDto {
  @IsString()
  @Matches(UUID_PATTERN)
  exam_id!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(UUID_PATTERN, { each: true })
  student_ids!: string[];

  @IsInt() @Min(1) @Max(360)
  duration_minutes!: number;
}
