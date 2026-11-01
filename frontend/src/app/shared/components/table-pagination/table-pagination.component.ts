//-- copyright
// OpenProject is an open source project management software.
// Copyright (C) the OpenProject GmbH
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See COPYRIGHT and LICENSE files for more details.
//++

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, inject } from '@angular/core';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import { UntilDestroyedMixin } from 'core-app/shared/helpers/angular/until-destroyed.mixin';
import { PaginationInstance } from 'core-app/shared/components/table-pagination/pagination-instance';
import { PaginationService } from 'core-app/shared/components/table-pagination/pagination-service';

@Component({
  selector: '[tablePagination]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './table-pagination.component.html',
  standalone: false,
})
export class TablePaginationComponent extends UntilDestroyedMixin implements OnInit {
  protected paginationService = inject(PaginationService);
  protected cdRef = inject(ChangeDetectorRef);
  protected I18n = inject(I18nService);
  // Added to allow closing the page jump popover when clicking outside of it
  protected elementRef = inject(ElementRef);

  @Input() totalEntries:string;

  @Input() hideForSinglePageResults = false;

  @Input() showPerPage = true;

  @Input() showPageSelections = true;

  @Input() infoText?:string;

  @Output() updateResults = new EventEmitter<PaginationInstance>();

  public pagination:PaginationInstance;

  public text = {
    label_previous: this.I18n.t('js.label_previous'),
    label_next: this.I18n.t('js.label_next'),
    per_page: this.I18n.t('js.label_per_page'),
    no_other_page: this.I18n.t('js.pagination.no_other_page'),
    pages_skipped: this.I18n.t('js.pagination.pages_skipped'),
    page_navigation: this.I18n.t('js.pagination.page_navigation'),
    per_page_navigation: this.I18n.t('js.pagination.per_page_navigation'),
    page_number: (num:number) => this.I18n.t('js.pagination.pages.page_number', { number: num }),
    show_per_page: (num:number) => this.I18n.t('js.pagination.pages.show_per_page', { number: num }),
    // Added to allow labelling the clickable ellipsis and its page jump popover
    show_skipped_pages: (from:number, to:number) => this.I18n.t('js.pagination.show_skipped_pages', { from, to }),
    go_to_page: this.I18n.t('js.pagination.go_to_page'),
    go: this.I18n.t('js.pagination.go'),
  };

  public currentRange = '';

  public pageNumbers:number[] = [];

  public postPageNumbers:number[] = [];

  public prePageNumbers:number[] = [];

  public perPageOptions:number[] = [];

  // Added to allow jumping to pages hidden behind the "…" via a small popover
  public totalPages = 0;

  public preSkippedPages:number[] = [];

  public postSkippedPages:number[] = [];

  public openGap:'pre'|'post'|null = null;

  ngOnInit():void {
    const paginationOptions = this.paginationService.getPaginationOptions();
    this.perPageOptions = paginationOptions.perPageOptions;
    this.pagination = new PaginationInstance(1, parseInt(this.totalEntries, 10), paginationOptions.perPage);
  }

  public update() {
    this.updateCurrentRangeLabel();
    this.updatePageNumbers();
    this.cdRef.detectChanges();
  }

  public selectPerPage(perPage:number) {
    this.pagination.perPage = perPage;
    this.paginationService.setPerPage(perPage);
    this.showPage(1);
  }

  public showPage(page:number) {
    this.pagination.page = page;

    this.updateCurrentRangeLabel();
    this.updatePageNumbers();

    this.onUpdatedPage();
    this.cdRef.detectChanges();
  }

  public onUpdatedPage() {
    this.updateResults.emit(this.pagination);
  }

  public get isVisible() {
    return !this.hideForSinglePageResults || (this.pagination.total > this.pagination.perPage);
  }

  /**
   * @name updateCurrentRange
   *
   * @description Defines a string containing page bound information inside the directive scope
   */
  public updateCurrentRangeLabel() {
    if (this.pagination.total) {
      const totalItems = this.pagination.total;
      const lowerBound = this.pagination.getLowerPageBound();
      const upperBound = this.pagination.getUpperPageBound(this.pagination.total);

      this.currentRange = `(${lowerBound} - ${upperBound}/${totalItems})`;
    } else {
      this.currentRange = '(0 - 0/0)';
    }
  }

  /**
   * @name updatePageNumbers
   *
   * @description Defines a list of all pages in numerical order inside the scope
   */
  public updatePageNumbers() {
    if (!this.showPageSelections) {
      this.pageNumbers = [];
      this.postPageNumbers = [];
      this.preSkippedPages = [];
      this.postSkippedPages = [];
      return;
    }

    const maxVisible = this.paginationService.getMaxVisiblePageOptions();
    const truncSize = this.paginationService.getOptionsTruncationSize();

    const pageNumbers = [];

    const { perPage } = this.pagination;
    const currentPage = this.pagination.page;
    if (perPage) {
      for (let i = 1; i <= Math.ceil(this.pagination.total / perPage); i++) {
        pageNumbers.push(i);
      }

      // This avoids a truncation when there are not enough elements to truncate for the first elements
      const preVisible = Math.min(currentPage - Math.ceil(maxVisible / 2), pageNumbers.length - maxVisible);

      this.prePageNumbers = this.truncatePageNums(
        pageNumbers,
        (currentPage >= maxVisible) && (pageNumbers.length >= maxVisible + (truncSize * 2)),
        0,
        preVisible,
        truncSize,
      );

      this.postPageNumbers = this.truncatePageNums(
        pageNumbers,
        pageNumbers.length >= maxVisible + (truncSize * 2),
        maxVisible,
        pageNumbers.length,
        0,
      );
    }

    this.pageNumbers = pageNumbers;
    this.updateSkippedPages();
  }

  /**
   * Added to allow the "…" to only show up when pages are actually skipped,
   * and to know which pages to offer in the page jump popover.
   */
  private updateSkippedPages() {
    const { perPage, total } = this.pagination;
    this.totalPages = perPage ? Math.ceil(total / perPage) : 0;

    const firstVisible = this.pageNumbers[0];
    const lastVisible = this.pageNumbers[this.pageNumbers.length - 1];

    this.preSkippedPages = this.prePageNumbers.length > 0 && firstVisible
      ? this.range(this.prePageNumbers[this.prePageNumbers.length - 1] + 1, firstVisible - 1)
      : [];

    const postEnd = this.postPageNumbers.length > 0 ? this.postPageNumbers[0] - 1 : this.totalPages;
    this.postSkippedPages = lastVisible ? this.range(lastVisible + 1, postEnd) : [];

    if ((this.openGap === 'pre' && !this.preSkippedPages.length) || (this.openGap === 'post' && !this.postSkippedPages.length)) {
      this.openGap = null;
    }
  }

  private range(from:number, to:number):number[] {
    const result:number[] = [];
    for (let i = from; i <= to; i++) {
      result.push(i);
    }
    return result;
  }

  // Added to allow opening/closing the page jump popover of an ellipsis
  public toggleGap(gap:'pre'|'post') {
    this.openGap = this.openGap === gap ? null : gap;
    this.cdRef.detectChanges();
  }

  public closeGap() {
    if (this.openGap) {
      this.openGap = null;
      this.cdRef.detectChanges();
    }
  }

  // Added to allow jumping to an arbitrary page from the popover (clamped to the existing pages)
  public jumpTo(page:number|string) {
    const parsed = typeof page === 'number' ? page : parseInt(page, 10);
    if (Number.isNaN(parsed) || this.totalPages < 1) {
      return;
    }

    const target = Math.min(Math.max(parsed, 1), this.totalPages);
    this.openGap = null;
    if (target !== this.pagination.page) {
      this.showPage(target);
    } else {
      this.cdRef.detectChanges();
    }
  }

  @HostListener('document:click', ['$event'])
  public onDocumentClick(event:MouseEvent) {
    if (!this.openGap) {
      return;
    }

    const target = event.target as HTMLElement|null;
    const gap = target?.closest('.op-pagination--gap');
    if (!gap || !(this.elementRef.nativeElement as HTMLElement).contains(gap)) {
      this.closeGap();
    }
  }

  @HostListener('document:keydown.escape')
  public onEscape() {
    this.closeGap();
  }

  public showPerPageOptions() {
    return this.showPerPage
      && this.perPageOptions.length > 0
      && this.pagination.total > this.perPageOptions[0];
  }

  private truncatePageNums(pageNumbers:number[], perform:boolean, disectFrom:number, disectLength:number, truncateFrom:number):number[] {
    if (perform) {
      const truncationSize = this.paginationService.getOptionsTruncationSize();
      const truncatedNums = pageNumbers.splice(disectFrom, disectLength);
      if (truncatedNums.length >= truncationSize * 2) {
        truncatedNums.splice(truncateFrom, truncatedNums.length - truncationSize);
      }
      return truncatedNums;
    }
    return [];
  }
}
