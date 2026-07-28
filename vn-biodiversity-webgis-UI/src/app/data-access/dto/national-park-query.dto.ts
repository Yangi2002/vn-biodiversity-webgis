export interface NationalParkQueryDto {
  q?: string;
  source?: string;
  hasImage?: 'all' | 'true' | 'false';
  page?: number;
  limit?: number;
}
