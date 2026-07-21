import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import type { TaxonomyTreeNode } from '../../../../data-access/models/taxonomy.model';
import { TaxonomyNodePage } from '../taxonomy-node/taxonomy-node.page';

@Component({
  selector: 'app-taxonomy-branches',
  imports: [NgTemplateOutlet, TaxonomyNodePage],
  templateUrl: './taxonomy-branches.page.html',
  styleUrl: './taxonomy-branches.page.css',
})
export class TaxonomyBranchesPage {
  @Input({ required: true }) roots: TaxonomyTreeNode[] = [];
  @Input() selectedTaxonId: string | null = null;

  @Output() readonly selectNode = new EventEmitter<TaxonomyTreeNode>();

  protected select(node: TaxonomyTreeNode): void {
    this.selectNode.emit(node);
  }
}
