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

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Injector, Input, OnInit, Output, ViewEncapsulation, OnDestroy, inject } from '@angular/core';
import { QueryResource } from 'core-app/features/hal/resources/query-resource';
import { I18nService } from 'core-app/core/i18n/i18n.service';
import {
  TableEventComponent,
  TableHandlerRegistry,
} from 'core-app/features/work-packages/components/wp-fast-table/handlers/table-handler-registry';
import { IsolatedQuerySpace } from 'core-app/features/work-packages/directives/query-space/isolated-query-space';
import { combineLatest } from 'rxjs';
import { QueryColumn } from 'core-app/features/work-packages/components/wp-query/query-column';
import { WorkPackageViewSortByService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-sort-by.service';
import { WorkPackageCollectionResource } from 'core-app/features/hal/resources/wp-collection-resource';
import { WorkPackageViewGroupByService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-group-by.service';
import { WorkPackageViewColumnsService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-columns.service';
import { createScrollSync } from 'core-app/features/work-packages/components/wp-table/wp-table-scroll-sync';
import { WpTableHoverSync } from 'core-app/features/work-packages/components/wp-table/wp-table-hover-sync';
import { WorkPackageTimelineTableController } from 'core-app/features/work-packages/components/wp-table/timeline/container/wp-timeline-container.directive';
import { WorkPackageTable } from 'core-app/features/work-packages/components/wp-fast-table/wp-fast-table';
import { WorkPackageViewTimelineService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-timeline.service';
import { UntilDestroyedMixin } from 'core-app/shared/helpers/angular/until-destroyed.mixin';
import { WorkPackageViewSumService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-sum.service';
import {
  WorkPackageTableConfiguration,
  WorkPackageTableConfigurationObject,
} from 'core-app/features/work-packages/components/wp-table/wp-table-configuration';
import { States } from 'core-app/core/states/states.service';
import { QueryGroupByResource } from 'core-app/features/hal/resources/query-group-by-resource';
import { WorkPackageViewBaselineService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-baseline.service';
import {
  ColumnWidths,
  WorkPackageViewColumnWidthsService,
} from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-column-widths.service';

export interface WorkPackageFocusContext {
  /** Work package that was focused */
  workPackageId:string;
  /** Through what action did the focus happen */
  through:'row-double-click'|'id-click'|'details-icon';
}

@Component({
  templateUrl: './wp-table.component.html',
  styleUrls: ['./wp-table.component.sass'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'wp-table',
  standalone: false,
})
export class WorkPackagesTableComponent extends UntilDestroyedMixin implements OnInit, TableEventComponent, OnDestroy {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly injector = inject(Injector);
  readonly states = inject(States);
  readonly querySpace = inject(IsolatedQuerySpace);
  readonly I18n = inject(I18nService);
  readonly cdRef = inject(ChangeDetectorRef);
  readonly wpTableGroupBy = inject(WorkPackageViewGroupByService);
  readonly wpTableTimeline = inject(WorkPackageViewTimelineService);
  readonly wpTableColumns = inject(WorkPackageViewColumnsService);
  readonly wpTableSortBy = inject(WorkPackageViewSortByService);
  readonly wpTableSums = inject(WorkPackageViewSumService);
  readonly wpTableBaseline = inject(WorkPackageViewBaselineService);
  // Added to allow resizing columns of the work package table
  readonly wpTableColumnWidths = inject(WorkPackageViewColumnWidthsService);

  @Input() projectIdentifier:string;

  @Input('configuration') configurationObject:WorkPackageTableConfigurationObject;

  @Output() selectionChanged = new EventEmitter<string[]>();

  @Output() itemClicked = new EventEmitter<{ workPackageId:string, double:boolean }>();

  @Output() stateLinkClicked = new EventEmitter<{ workPackageId:string, requestedState:string }>();

  public configuration:WorkPackageTableConfiguration;

  private element:HTMLElement;

  private scrollSyncUpdate:(timelineVisible:boolean) => any;

  private wpTableHoverSync:WpTableHoverSync;

  public tableElement:HTMLElement;

  public workPackageTable:WorkPackageTable;

  public tbody:HTMLTableSectionElement;

  public query:QueryResource;

  public timeline:HTMLElement;

  public locale:string;

  public text:any;

  public results:WorkPackageCollectionResource;

  public groupBy:QueryGroupByResource|null;

  public columns:QueryColumn[];

  public numTableColumns:number;

  public timelineVisible:boolean;

  public manualSortEnabled:boolean;

  public baselineEnabled:boolean;

  public limitedResults = false;

  // We need to sync certain height difference to the timeline
  // depending on whether inline create or sums rows are being shown
  public inlineCreateVisible = false;

  public sumVisible = false;

  // Added to allow resizing columns of the work package table: identifies this table in the
  // generated width rules (several tables can be on one page) and holds those rules.
  public readonly columnWidthsTableId = `wp-table-${Math.random().toString(36).slice(2, 10)}`;

  private columnWidthsStyle:HTMLStyleElement|null = null;

  // Added to allow resizing columns: true while a resize handle is being dragged
  private columnResizeActive = false;

  // Added for smoother column resizing: pixels to move before a drag starts, and how long
  // after a drag a double-click is still treated as part of dragging (not as a reset)
  private static readonly columnResizeThreshold = 3;

  private static readonly columnResizeDblclickGuard = 600;

  private lastColumnResizeEnd = 0;

  // Added (fixed column layout): the width each column needs for its content, used for every
  // column the user has not resized. Measured, not saved. null until first measured.
  private naturalColumnWidths:ColumnWidths|null = null;

  // Added (fixed column layout): cells of the columns that are not query columns
  private static readonly extraColumnSelectors:Record<string, { th:string, td:string }> = {
    '__manual_sort': { th: 'th.wp-table--manual-sort-th', td: 'td.wp-table--sort-td' },
    '__baseline': { th: 'th.wp-table--baseline-th', td: 'td.op-table-baseline--column-cell' },
    '__settings': { th: 'th.wp-table--context-menu-th', td: 'td.wp-table--context-menu-td' },
  };

  // Added: set while minimum widths are being applied, so that correction does not trigger
  // yet another check (one check per change, never a chain)
  private enforcingMinimumWidths = false;

  ngOnInit():void {
    this.configuration = new WorkPackageTableConfiguration(this.configurationObject);
    this.element = this.elementRef.nativeElement;

    // Clear any old table subscribers
    this.querySpace.stopAllSubscriptions.next();

    this.locale = I18n.locale;

    this.text = {
      cancel: I18n.t('js.button_cancel'),
      noResults: {
        title: I18n.t('js.work_packages.no_results.title'),
        description: I18n.t('js.work_packages.no_results.description'),
      },
      limitedResults: (count:number, total:number) => I18n.t('js.work_packages.limited_results', { count, total }),
      tableSummary: I18n.t('js.work_packages.table.summary'),
      // Added to allow resizing columns of the work package table
      resizeColumn: I18n.t('js.work_packages.table.resize_column'),
      tableSummaryHints: [
        I18n.t('js.work_packages.table.text_inline_edit'),
        I18n.t('js.work_packages.table.text_select_hint'),
        I18n.t('js.work_packages.table.text_sort_hint'),
      ].join(' '),
    };

    const statesCombined = combineLatest([
      this.querySpace.results.values$(),
      this.wpTableGroupBy.live$(),
      this.wpTableColumns.live$(),
      this.wpTableTimeline.live$(),
      this.wpTableSortBy.live$(),
      this.wpTableSums.live$(),
      this.wpTableBaseline.live$(),
    ]);

    statesCombined.pipe(
      this.untilDestroyed(),
    ).subscribe(([results, groupBy, columns, timelines, sort, sums]) => {
      this.query = this.querySpace.query.value!;

      this.results = results;
      this.sumVisible = sums;

      this.groupBy = groupBy;
      this.columns = columns;

      this.timelineVisible = timelines.visible;

      this.manualSortEnabled = this.wpTableSortBy.isManualSortingMode;
      this.baselineEnabled = this.wpTableBaseline.isActive();
      this.limitedResults = this.manualSortEnabled && results.total > results.count;

      // Total columns = all available columns + id + context menu
      this.numTableColumns = this.columns.length + 2;

      if (this.manualSortEnabled) {
        this.numTableColumns += 1;
      }

      if (this.baselineEnabled) {
        this.numTableColumns += 1;
      }

      if (this.workPackageTable) {
        this.workPackageTable.colspan = this.numTableColumns;
      }

      if (this.scrollSyncUpdate && this.timelineVisible !== timelines.visible) {
        this.scrollSyncUpdate(timelines.visible);
      }

      this.cdRef.detectChanges();
    });

    // Added to allow resizing columns of the work package table. Embedded tables (e.g.
    // children/relations in the details view) keep automatic widths.
    if (this.columnsResizable) {
      this.wpTableColumnWidths.activate();
      this.wpTableColumnWidths
        .live$
        .pipe(this.untilDestroyed())
        .subscribe((widths) => {
          this.applyColumnWidths(widths);
          // Added: also check once stored widths arrive (they load after the first render).
          // Skipped while dragging, where the drag handler clamps itself.
          if (!this.columnResizeActive && !this.enforcingMinimumWidths) {
            requestAnimationFrame(() => this.enforceMinimumColumnWidths());
          }
        });

      // Added: once rows are (re)rendered, measure the widths the columns need for their
      // (new) content - for the fixed column layout - and keep resized columns from hiding text
      this.querySpace.tableRendered
        .values$()
        .pipe(this.untilDestroyed())
        .subscribe(() => requestAnimationFrame(() => {
          this.measureNaturalColumnWidths();
          this.enforceMinimumColumnWidths();
        }));
    }

    this.cdRef.detectChanges();
  }

  public ngOnDestroy():void {
    super.ngOnDestroy();
    this.wpTableHoverSync.deactivate();
    // Added to allow resizing columns of the work package table
    this.columnWidthsStyle?.remove();
  }

  // Added to allow resizing columns of the work package table
  public get columnsResizable():boolean {
    return !this.configuration.isEmbedded;
  }

  // Added to allow resizing columns of the work package table.
  // Changed: Subject is resizable too (see applyColumnWidths for who takes the free space).
  public isColumnResizable(_column:QueryColumn):boolean {
    return this.columnsResizable;
  }

  /**
   * Added to allow resizing columns of the work package table.
   *
   * Drag the handle on a header's right edge: the width is previewed live and saved on
   * release. Pointer capture keeps the drag going when the pointer leaves the handle.
   */
  public onColumnResizeStart(event:PointerEvent, column:QueryColumn):void {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const handle = event.currentTarget as HTMLElement;
    const th = handle.closest('th')!;
    const startX = event.clientX;
    const startWidth = th.getBoundingClientRect().width;
    // Added: the column may not get narrower than its longest content (header included)
    const minWidth = this.contentWidth(column.id);

    // Added (Excel-like): a column right of a flexible Subject would otherwise shift left
    // when widened (Subject gives up the space), so its edge would not land on the guide
    // and the separators in between would move too.
    // In that case Subject is pinned at its current width, so only the columns right of
    // the resized one move and the free space goes to the end of the row.
    const subjectIndex = this.columns.findIndex((c) => c.id === 'subject');
    const pinSubject = column.id !== 'subject'
      && subjectIndex !== -1
      && subjectIndex < this.columns.findIndex((c) => c.id === column.id)
      && this.wpTableColumnWidths.current.subject === undefined;
    const subjectWidth = pinSubject
      ? this.element.querySelector<HTMLElement>('th[data-column-id="subject"]')?.getBoundingClientRect().width
      : undefined;
    const thLeft = th.getBoundingClientRect().left;
    const widthAt = (clientX:number) => Math.max(minWidth, startWidth + (clientX - startX));

    // Changed (Excel / Google Sheets style): while dragging, only a guide line follows the
    // pointer - the table itself does not change until the handle is released. Nothing in
    // the table moves or jumps during the drag, and the browser does not have to re-layout
    // the whole table on every pointer move. The line stops where the column's content
    // would no longer fit. A drag only starts after a few pixels, so a plain click never
    // changes anything.
    let dragging = false;
    let pointerX = startX;
    let guide:HTMLElement|null = null;

    handle.setPointerCapture(event.pointerId);
    this.columnResizeActive = true;
    th.classList.add('-resizing');
    document.body.classList.add('-column-resizing');

    const onMove = (moveEvent:PointerEvent) => {
      pointerX = moveEvent.clientX;

      if (!dragging && Math.abs(pointerX - startX) < WorkPackagesTableComponent.columnResizeThreshold) {
        return;
      }
      dragging = true;

      guide ??= this.createColumnResizeGuide();
      guide.style.left = `${thLeft + widthAt(pointerX)}px`;
    };

    const onEnd = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onEnd);
      handle.removeEventListener('pointercancel', onEnd);
      guide?.remove();
      th.classList.remove('-resizing');
      document.body.classList.remove('-column-resizing');
      this.columnResizeActive = false;

      if (dragging) {
        if (subjectWidth !== undefined) {
          this.wpTableColumnWidths.set('subject', subjectWidth);
        }
        this.wpTableColumnWidths.set(column.id, widthAt(pointerX));
        // Remember when a drag ended: releasing and grabbing the handle again quickly
        // fires a dblclick, which must not reset the column that was just resized
        this.lastColumnResizeEnd = Date.now();
      }
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onEnd);
    handle.addEventListener('pointercancel', onEnd);
  }

  // Added to allow resizing columns with the keyboard: arrow keys resize in 10px steps,
  // Enter restores the automatic width
  public onColumnResizeKeydown(event:KeyboardEvent, column:QueryColumn):void {
    const th = (event.currentTarget as HTMLElement).closest('th')!;
    const step = { ArrowLeft: -10, ArrowRight: 10 }[event.key];

    if (step !== undefined) {
      // Changed: never narrower than the column's longest content
      this.wpTableColumnWidths.set(
        column.id,
        Math.max(this.contentWidth(column.id), th.getBoundingClientRect().width + step),
      );
    } else if (event.key === 'Enter') {
      this.wpTableColumnWidths.reset(column.id);
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  // Added to allow resizing columns of the work package table: double-click restores the
  // automatic width
  public onColumnResizeReset(event:MouseEvent, column:QueryColumn):void {
    event.preventDefault();
    event.stopPropagation();

    // Fixed: two quick drags in a row are seen by the browser as a double-click, which
    // reset the column to its automatic width in the middle of resizing it. Only a real
    // double-click (no drag just before) resets.
    if (Date.now() - this.lastColumnResizeEnd < WorkPackagesTableComponent.columnResizeDblclickGuard) {
      return;
    }

    this.wpTableColumnWidths.reset(column.id);
  }

  /**
   * Added to prevent resizing a column so narrow that text gets hidden.
   *
   * The width the column needs to show all of its content: for the header and every
   * rendered cell, the natural (max-content) width of its content measured from the cell's
   * left edge, plus a right gap equal to the column's left gap (cell edge to start of text),
   * so the content sits evenly inside the column.
   *
   * Changed: the content is briefly given its natural width (width: max-content) and
   * measured, all in one batch (one layout), then put back before the browser paints. The
   * previous approach measured where text and icons currently sit, but some of them are
   * pushed against the cell's right edge (e.g. the header's dropdown arrow), which made the
   * minimum follow the current width - a column could only be narrowed a bit at a time.
   */
  private contentWidth(columnId:string):number {
    const scope = `table[data-column-widths-id="${this.columnWidthsTableId}"]`;
    const { th, td } = this.columnCellSelectors(columnId);
    const cells = Array.from(this.element.querySelectorAll<HTMLElement>(`${scope} ${th}, ${scope} ${td}`));
    const excluded = '.sr-only, .hidden-for-sighted, .generic-table--column-resizer, [hidden]';

    const contents = cells.flatMap((cell) => this.measuredContent(cell)
      .filter((child) => !child.matches(excluded))
      .map((child) => ({
        cell, child, width: child.style.width, maxWidth: child.style.maxWidth, flex: child.style.flex,
      })));

    // Write all, then read all, then restore all: a single forced layout
    contents.forEach(({ child }) => {
      child.style.width = 'max-content';
      child.style.maxWidth = 'none';
      child.style.flex = 'none';
    });

    let contentRight = 0;
    let leftGap = Number.POSITIVE_INFINITY;
    try {
      contents.forEach(({ cell, child }) => {
        const rect = child.getBoundingClientRect();
        if (rect.width > 0) {
          contentRight = Math.max(contentRight, rect.right - cell.getBoundingClientRect().left);
        }
      });

      cells.forEach((cell) => {
        const cellLeft = cell.getBoundingClientRect().left;
        this.textRects(cell, excluded).forEach((rect) => {
          leftGap = Math.min(leftGap, rect.left - cellLeft);
        });
      });
    } finally {
      contents.forEach(({ child, width, maxWidth, flex }) => {
        child.style.width = width;
        child.style.maxWidth = maxWidth;
        child.style.flex = flex;
      });
    }

    if (contentRight === 0) {
      return WorkPackageViewColumnWidthsService.minWidth;
    }

    const gap = Number.isFinite(leftGap) ? Math.max(0, leftGap) : 0;
    return Math.max(WorkPackageViewColumnWidthsService.minWidth, Math.ceil(contentRight + gap));
  }

  /**
   * Added: the elements whose natural width a cell needs. For a column header that is its
   * visible label (hierarchy icon, name, sort arrow) - not the dropdown arrow, which is
   * invisible until hovered, nor the header's extra right padding reserved for it. Counting
   * those made e.g. the ID column impossible to narrow much below ~100px although its values
   * are only a few digits wide. For body cells it is their content.
   */
  private measuredContent(cell:HTMLElement):HTMLElement[] {
    const label = Array
      .from(cell.querySelectorAll<HTMLElement>('.generic-table--sort-header > *'))
      .filter((el) => !el.querySelector('.dropdown-indicator') && !el.matches('.dropdown-indicator'));

    if (label.length > 0) {
      return label;
    }

    return Array.from(cell.children).filter((child):child is HTMLElement => child instanceof HTMLElement);
  }

  // Added to allow measuring where the text of a table cell starts: the boxes of its
  // visible, non-empty text nodes
  private textRects(cell:HTMLElement, excluded:string):DOMRect[] {
    const rects:DOMRect[] = [];
    const range = document.createRange();
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);

    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.textContent?.trim() && !node.parentElement?.closest(excluded)) {
        range.selectNodeContents(node);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          rects.push(rect);
        }
      }
    }

    return rects;
  }

  /**
   * Added to prevent stored widths from hiding text: after (re)rendering, e.g. when a
   * longer value appears, columns narrower than their content are widened again. This is
   * only applied, not saved, so the stored width wins again once the content fits.
   */
  private enforceMinimumColumnWidths():void {
    const widths = this.wpTableColumnWidths.current;

    this.enforcingMinimumWidths = true;
    try {
      Object.entries(widths).forEach(([columnId, width]) => {
        const minimum = this.contentWidth(columnId);
        if (minimum > width) {
          this.wpTableColumnWidths.preview(columnId, minimum);
        }
      });
    } finally {
      this.enforcingMinimumWidths = false;
    }
  }

  // Added (Excel-style resizing): the vertical line showing where the column's new right
  // edge will be, spanning the visible table area. Fixed positioning, so it is independent
  // of the table's scroll position and layout.
  private createColumnResizeGuide():HTMLElement {
    const container = this.element.querySelector<HTMLElement>('.work-package-table--container') ?? this.element;
    const rect = container.getBoundingClientRect();
    const guide = document.createElement('div');

    guide.className = 'generic-table--column-resize-guide';
    guide.style.top = `${rect.top}px`;
    guide.style.height = `${rect.height}px`;
    document.body.appendChild(guide);

    return guide;
  }

  // Added (fixed column layout): header and body cell selectors of a column key - a query
  // column id, or one of the extra columns (drag handle, baseline, settings)
  private columnCellSelectors(key:string):{ th:string, td:string } {
    const extra = WorkPackagesTableComponent.extraColumnSelectors[key];
    if (extra) {
      return extra;
    }

    const id = CSS.escape(key);
    return { th: `th[data-column-id="${id}"]`, td: `td.wp-table--cell-td.${id}` };
  }

  // Added (fixed column layout): all columns of the table, left to right
  private get columnKeys():string[] {
    const scope = `table[data-column-widths-id="${this.columnWidthsTableId}"]`;
    const present = (key:string) => !!this.element.querySelector(`${scope} ${this.columnCellSelectors(key).th}`);

    return [
      ...['__manual_sort', '__baseline'].filter(present),
      ...this.columns.map((column) => column.id),
      ...['__settings'].filter(present),
    ];
  }

  // Added (fixed column layout): measure the width every column needs for its content
  private measureNaturalColumnWidths():void {
    if (this.columnResizeActive) {
      return;
    }

    const natural:ColumnWidths = {};
    this.columnKeys.forEach((key) => {
      natural[key] = this.contentWidth(key);
    });

    this.naturalColumnWidths = natural;
    this.applyColumnWidths(this.wpTableColumnWidths.current);
  }

  /**
   * Added to allow resizing columns of the work package table.
   *
   * Changed: the table uses a fixed column layout (like a spreadsheet). In the browser's
   * automatic table layout, changing one column's width made the browser re-distribute
   * all columns, so other separators moved along. Now every column gets an explicit width -
   * the user's width, or else the width its content needs - and exactly one column has no
   * width and takes the remaining space: Subject while it is flexible, otherwise the empty
   * settings column at the end. Resizing a column therefore only moves its own right edge
   * and the columns to the right of it.
   *
   * Widths are applied through generated CSS rules because the body cells are rendered
   * outside Angular (fast table). In a fixed layout only the header row decides the widths.
   */
  private applyColumnWidths(widths:ColumnWidths):void {
    if (!this.columnWidthsStyle) {
      this.columnWidthsStyle = document.createElement('style');
      this.element.appendChild(this.columnWidthsStyle);
    }

    // Until the content has been measured once, keep the browser's automatic layout
    if (!this.naturalColumnWidths) {
      return;
    }

    const scope = `table[data-column-widths-id="${this.columnWidthsTableId}"]`;
    const natural = this.naturalColumnWidths;
    const keys = this.columnKeys;
    const flexible = widths.subject === undefined && keys.includes('subject') ? 'subject' : '__settings';

    const rules:string[] = [];
    let fixedTotal = 0;

    keys
      .filter((key) => key !== flexible)
      .forEach((key) => {
        const width = widths[key] ?? natural[key] ?? WorkPackageViewColumnWidthsService.minWidth;
        fixedTotal += width;
        rules.push(`${scope} ${this.columnCellSelectors(key).th} {`
          + ` box-sizing: border-box; width: ${width}px !important; max-width: none !important; }`);
      });

    // The flexible column never gets narrower than its content: the table then grows
    // (and scrolls horizontally) instead
    const flexibleMinimum = natural[flexible] ?? WorkPackageViewColumnWidthsService.minWidth;
    rules.push(`${scope} { table-layout: fixed; width: 100%;`
      + ` min-width: ${Math.ceil(fixedTotal + flexibleMinimum)}px; }`);
    rules.push(`${scope} ${this.columnCellSelectors(flexible).th} { width: auto !important; max-width: none !important; }`);

    this.columnWidthsStyle.textContent = rules.join('\n');
  }

  public registerTimeline(controller:WorkPackageTimelineTableController, timelineBody:HTMLElement) {
    const tbody = this.element.querySelector<HTMLTableSectionElement>('.work-package--results-tbody')!;
    const scrollContainer = this.element.querySelector<HTMLElement>('.work-package-table--container')!;
    this.workPackageTable = new WorkPackageTable(
      this.injector,
      // Outer container for both table + Timeline
      this.element,
      // Scroll container for the table/timeline
      scrollContainer,
      // Table tbody to insert into
      tbody,
      // Timeline body to insert into
      timelineBody,
      // Timeline controller
      controller,
      // Table configuration
      this.configuration,
    );
    this.workPackageTable.colspan = this.numTableColumns;

    this.tbody = tbody;
    controller.workPackageTable = this.workPackageTable;
    new TableHandlerRegistry(this.injector).attachTo(this);

    // Locate table and timeline elements
    const tableAndTimeline = this.getTableAndTimelineElement();
    this.tableElement = tableAndTimeline[0];
    this.timeline = tableAndTimeline[1];

    // sync hover from table to timeline
    this.wpTableHoverSync = new WpTableHoverSync(this.element);
    this.wpTableHoverSync.activate();

    // sync scroll from table to timeline
    this.scrollSyncUpdate = createScrollSync(this.element);
    this.scrollSyncUpdate(this.timelineVisible);

    this.cdRef.detectChanges();
  }

  public get isEmbedded() {
    return this.configuration.isEmbedded;
  }

  private getTableAndTimelineElement():[HTMLElement, HTMLElement] {
    const tableSide = this.element.querySelector<HTMLElement>('.work-packages-tabletimeline--table-side');
    const timelineSide = this.element.querySelector<HTMLElement>('.work-packages-tabletimeline--timeline-side');

    if (!tableSide || !timelineSide) {
      throw new Error('invalid state');
    }

    return [tableSide, timelineSide];
  }
}
