import { Component, EventEmitter, Input, Output } from '@angular/core';

import type { TaxonomyTreeNode } from '../../../../data-access/models/taxonomy.model';

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
    return this.node.vietnameseName || this.node.canonicalName;
  }

  protected hasScientificName(): boolean {
    return Boolean(this.node.vietnameseName && this.node.vietnameseName !== this.node.canonicalName);
  }

  protected select(): void {
    this.selectNode.emit(this.node);
  }
}
