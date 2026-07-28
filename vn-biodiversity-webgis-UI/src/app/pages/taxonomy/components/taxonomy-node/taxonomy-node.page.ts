import { Component, EventEmitter, Input, Output } from '@angular/core';

import type { TaxonomyTreeNode } from '../../../../data-access/models/taxonomy.model';
import { hasSeparateScientificName, taxonomyDisplayName } from '../../../../shared/utils/taxonomy-display.util';

@Component({
  selector: 'app-taxonomy-node',
  imports: [],
  templateUrl: './taxonomy-node.page.html',
  styleUrl: './taxonomy-node.page.css',
})
export class TaxonomyNodePage {
  @Input({ required: true }) node!: TaxonomyTreeNode;
  @Input() isSelected = false;

  @Output() readonly selectNode = new EventEmitter<TaxonomyTreeNode>();

  protected displayName(): string {
    return taxonomyDisplayName(this.node.canonicalName, this.node.vietnameseName);
  }

  protected hasScientificName(): boolean {
    return hasSeparateScientificName(this.node.canonicalName, this.displayName());
  }

  protected select(): void {
    this.selectNode.emit(this.node);
  }
}
