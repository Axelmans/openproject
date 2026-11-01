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
import { CurrentProjectService } from 'core-app/core/current-project/current-project.service';
import { ViewRowStateScope } from 'core-app/core/apiv3/endpoints/work_packages/apiv3-view-row-states';

// Added to allow per-user view state (hierarchy collapse state, column widths) to share one
// scope definition per work package list. A saved query is scoped by its id; otherwise, in a
// project context, by the project's numeric id (available synchronously via
// CurrentProjectService, no extra HTTP call); otherwise the global (no query, no project) scope.
export function resolveViewRowStateScope(
  query:QueryResource,
  currentProjectService:CurrentProjectService,
):ViewRowStateScope {
  if (query.id) {
    return { queryId: query.id };
  }

  if (currentProjectService.inProjectContext) {
    return { projectId: currentProjectService.id };
  }

  return {};
}
