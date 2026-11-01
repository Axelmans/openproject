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

import { Observable } from 'rxjs';
import { ApiV3ResourcePath } from 'core-app/core/apiv3/paths/apiv3-resource';
import { HalResource } from 'core-app/features/hal/resources/hal-resource';

// Added to allow persisting per-user hierarchy row collapse state per work package list
export interface ViewRowStateScope {
  queryId?:string|null;
  projectId?:string|null;
}

// Added to allow partial updates of the per-user view state (collapse state, column widths)
export interface ViewRowStateChanges {
  collapsed?:Record<string, boolean>;
  columnWidths?:Record<string, number>;
}

// Added to allow persisting per-user hierarchy row collapse state per work package list
export class ApiV3ViewRowStates extends ApiV3ResourcePath {
  public get(scope:ViewRowStateScope):Observable<HalResource> {
    return this.halResourceService.get(this.scopedPath(scope));
  }

  // Changed: partial update - only the given attributes are sent (and thus written by the
  // server), so saving column widths does not wipe the collapse state and vice versa.
  public patch(scope:ViewRowStateScope, changes:ViewRowStateChanges):Observable<HalResource> {
    const payload:Record<string, unknown> = {};

    if (changes.collapsed !== undefined) {
      payload.collapsed = changes.collapsed;
    }

    if (changes.columnWidths !== undefined) {
      payload.columnWidths = changes.columnWidths;
    }

    return this.halResourceService.patch(this.scopedPath(scope), payload);
  }

  private scopedPath(scope:ViewRowStateScope):string {
    const params = new URLSearchParams();

    if (scope.queryId) {
      params.set('query_id', scope.queryId);
    } else if (scope.projectId) {
      params.set('project_id', scope.projectId);
    }

    const query = params.toString();
    return query ? `${this.path}?${query}` : this.path;
  }
}
