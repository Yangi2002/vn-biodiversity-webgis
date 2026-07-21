import { Controller, Get, Param, Query } from '@nestjs/common';
import type { TaxonomySearchQueryDto } from './dto/taxonomy-search-query.dto';
import { TaxonomyService } from './taxonomy.service';

@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly taxonomyService: TaxonomyService) {}

  @Get('search')
  search(@Query() query: TaxonomySearchQueryDto) {
    return this.taxonomyService.search(query);
  }

  @Get('tree')
  treeRoots() {
    return this.taxonomyService.treeRoots();
  }

  @Get('tree/:taxonId/children')
  treeChildren(@Param('taxonId') taxonId: string) {
    return this.taxonomyService.treeChildren(taxonId);
  }
}
