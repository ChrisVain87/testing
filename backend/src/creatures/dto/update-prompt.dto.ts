import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdatePromptDto {
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  systemPrompt: string;
}
