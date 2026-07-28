export interface SpeciesSearchQueryDto {
  q?: string;
  limit?: string;
  page?: string;
  sourceTable?: string;
  kingdom?: string;
  className?: string;
  order?: string;
  family?: string;
  genus?: string;
  taxonId?: string;
}
