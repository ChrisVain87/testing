import { IsString, IsIn, IsInt, IsNumber, Min, Max, MinLength, MaxLength } from 'class-validator';

const PRESETS = ['blobbo', 'fuzzling', 'snorkle', 'zipplet', 'gloomp', 'wobblo', 'squidlet', 'boomba', 'fluffnik', 'crinkle', 'plonker', 'zazzle'];
const PROVIDERS = ['openai', 'anthropic', 'google', 'xai'];

export class CreateCreatureDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  name: string;

  @IsString()
  @IsIn(PRESETS)
  preset: string;

  @IsInt()
  @Min(0)
  @Max(4)
  colorVariant: number;

  @IsString()
  @IsIn(PROVIDERS)
  llmProvider: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  apiKey: string;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  systemPrompt: string;
}
