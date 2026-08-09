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

import { QueryResource } from 'core-app/features/hal/resources/query-resource';
import { Injectable } from '@angular/core';
import { WorkPackageQueryStateService } from './wp-view-base.service';

// Added to allow closed work packages to be sorted to the bottom regardless of the chosen sort criteria
@Injectable()
export class WorkPackageViewClosedWorkPackagesLastService extends WorkPackageQueryStateService<boolean> {
  public valueFromQuery(query:QueryResource) {
    return !!query.closedWorkPackagesLast;
  }

  public initialize(query:QueryResource) {
    this.pristineState.putValue(!!query.closedWorkPackagesLast);
  }

  public hasChanged(query:QueryResource) {
    return query.closedWorkPackagesLast !== this.isEnabled;
  }

  public applyToQuery(query:QueryResource) {
    query.closedWorkPackagesLast = this.isEnabled;
    return true;
  }

  public toggle() {
    this.updatesState.putValue(!this.current);
  }

  public setEnabled(value:boolean) {
    this.updatesState.putValue(value);
  }

  public get isEnabled() {
    return this.current;
  }

  public get current():boolean {
    return this.lastUpdatedState.getValueOr(false);
  }
}
