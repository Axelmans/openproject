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

import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, EMPTY, Observable, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { CurrentProjectService } from 'core-app/core/current-project/current-project.service';
import { ViewRowStateScope } from 'core-app/core/apiv3/endpoints/work_packages/apiv3-view-row-states';
import { IsolatedQuerySpace } from 'core-app/features/work-packages/directives/query-space/isolated-query-space';
import { resolveViewRowStateScope } from 'core-app/features/work-packages/routing/wp-view-base/view-services/view-row-state-scope';

export type ColumnWidths = Record<string, number>;

/**
 * Added to allow resizing columns of the work package table.
 *
 * Holds the user's custom column widths (column id => px) for the current work package
 * list and persists them per user, next to the hierarchy collapse state of the same list
 * (see WorkPackages::ViewRowState). Columns without an entry keep their automatic width.
 */
@Injectable()
export class WorkPackageViewColumnWidthsService implements OnDestroy {
  public static readonly minWidth = 40;

  public static readonly maxWidth = 2000;

  private readonly apiV3Service = inject(ApiV3Service);

  private readonly currentProjectService = inject(CurrentProjectService);

  private readonly querySpace = inject(IsolatedQuerySpace);

  private readonly widths$ = new BehaviorSubject<ColumnWidths>({});

  private scope:ViewRowStateScope|null = null;

  // Debounced so a burst of changes (e.g. resizing several columns) results in one PATCH
  private readonly persistTrigger = new Subject<void>();

  private readonly subscriptions = new Subscription();

  private activated = false;

  /**
   * Start loading the stored widths for the current work package list, and reload them
   * whenever the table switches to another list. Called by the (non-embedded) table only,
   * so embedded tables sharing this query space do not fire extra requests.
   */
  public activate():void {
    if (this.activated) {
      return;
    }
    this.activated = true;

    this.subscriptions.add(
      this.querySpace.query
        .values$()
        .pipe(
          map((query) => resolveViewRowStateScope(query, this.currentProjectService)),
          distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
          switchMap((scope) => {
            this.scope = scope;
            this.widths$.next({});
            return this.apiV3Service.work_packages.view_row_states
              .get(scope)
              .pipe(catchError(() => EMPTY));
          }),
        )
        .subscribe((resource) => {
          const stored = (resource.columnWidths ?? {}) as ColumnWidths;
          this.widths$.next({ ...stored });
        }),
    );

    this.subscriptions.add(
      this.persistTrigger
        .pipe(debounceTime(500))
        .subscribe(() => this.persist()),
    );
  }

  ngOnDestroy():void {
    this.subscriptions.unsubscribe();
  }

  public get live$():Observable<ColumnWidths> {
    return this.widths$.asObservable();
  }

  public get current():ColumnWidths {
    return this.widths$.value;
  }

  public widthOf(columnId:string):number|undefined {
    return this.current[columnId];
  }

  /**
   * Apply a width without saving it (used while dragging a resize handle).
   */
  public preview(columnId:string, width:number):void {
    this.widths$.next({ ...this.current, [columnId]: this.clamp(width) });
  }

  /**
   * Apply and save a width.
   */
  public set(columnId:string, width:number):void {
    this.preview(columnId, width);
    this.persistTrigger.next();
  }

  /**
   * Return a column to its automatic width and save that.
   */
  public reset(columnId:string):void {
    const widths = { ...this.current };
    delete widths[columnId];
    this.widths$.next(widths);
    this.persistTrigger.next();
  }

  private clamp(width:number):number {
    return Math.round(
      Math.min(
        WorkPackageViewColumnWidthsService.maxWidth,
        Math.max(WorkPackageViewColumnWidthsService.minWidth, width),
      ),
    );
  }

  private persist():void {
    if (this.scope === null) {
      return;
    }

    this
      .apiV3Service
      .work_packages
      .view_row_states
      .patch(this.scope, { columnWidths: this.current })
      .subscribe({ error: () => null });
  }
}
