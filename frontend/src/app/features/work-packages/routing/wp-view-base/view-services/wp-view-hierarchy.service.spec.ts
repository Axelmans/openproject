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

// Added to allow persisting per-user hierarchy row collapse state per work package list
import { TestBed } from '@angular/core/testing';
import { States } from 'core-app/core/states/states.service';
import { IsolatedQuerySpace } from 'core-app/features/work-packages/directives/query-space/isolated-query-space';
import { WorkPackageViewHierarchiesService } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-view-hierarchy.service';
import { ConfigurationService } from 'core-app/core/config/configuration.service';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
// Added to allow persisting per-user hierarchy row collapse state per work package list
import { CurrentProjectService } from 'core-app/core/current-project/current-project.service';
import { of } from 'rxjs';

describe('WorkPackageViewHierarchiesService', () => {
  let service:WorkPackageViewHierarchiesService;
  let querySpace:IsolatedQuerySpace;
  let configurationServiceStub:{ collapseHierarchyOnLoad:() => boolean, rememberHierarchyCollapseState:() => boolean };
  // Added to allow persisting per-user hierarchy row collapse state per work package list
  let currentProjectServiceStub:{ inProjectContext:boolean, id:string|null };
  let getSpy:ReturnType<typeof vi.fn>;
  let patchSpy:ReturnType<typeof vi.fn>;

  function buildResults(ancestorIds:string[]) {
    return {
      elements: [
        {
          id: 'wp',
          getAncestors: () => ancestorIds.map((id) => ({ id })),
        },
      ],
    } as any;
  }

  function buildQuery(id:string|null, showHierarchies = true) {
    return { id, showHierarchies } as any;
  }

  beforeEach(async () => {
    // Added to allow the user to control whether hierarchy row collapse/expand state is
    // remembered across visits. Defaults to true so existing specs keep exercising the
    // "remembering enabled" path unless a test opts out below.
    configurationServiceStub = { collapseHierarchyOnLoad: () => false, rememberHierarchyCollapseState: () => true };
    // Added to allow persisting per-user hierarchy row collapse state per work package list.
    // Defaults to the global (no project) context; individual tests opt into a project context.
    currentProjectServiceStub = { inProjectContext: false, id: null };
    getSpy = vi.fn().mockReturnValue(of({ collapsed: {} }));
    patchSpy = vi.fn().mockReturnValue(of({ collapsed: {} }));

    const apiV3ServiceStub = {
      work_packages: {
        view_row_states: {
          get: getSpy,
          patch: patchSpy,
        },
      },
    };

    await TestBed.configureTestingModule({
      providers: [
        States,
        IsolatedQuerySpace,
        { provide: ConfigurationService, useValue: configurationServiceStub },
        { provide: ApiV3Service, useValue: apiV3ServiceStub },
        // Added to allow persisting per-user hierarchy row collapse state per work package list
        { provide: CurrentProjectService, useValue: currentProjectServiceStub },
        WorkPackageViewHierarchiesService,
      ],
    }).compileComponents();

    service = TestBed.inject(WorkPackageViewHierarchiesService);
    querySpace = TestBed.inject(IsolatedQuerySpace);
  });

  describe('loading persisted state', () => {
    it('requests the persisted state for the query scope on initialize', () => {
      const query = buildQuery('42');
      service.initialize(query, buildResults([]));

      expect(getSpy).toHaveBeenCalledWith({ queryId: '42' });
    });

    // Added to allow persisting per-user hierarchy row collapse state per work package list
    it('requests the persisted state for the global scope on the ad-hoc (unsaved, no project) view', () => {
      const query = buildQuery(null);
      service.initialize(query, buildResults([]));

      expect(getSpy).toHaveBeenCalledWith({});
    });

    // Added to allow persisting per-user hierarchy row collapse state per work package list
    it('requests the persisted state for the project scope when no query is saved but a project is open', () => {
      currentProjectServiceStub.inProjectContext = true;
      currentProjectServiceStub.id = '45';

      const query = buildQuery(null);
      service.initialize(query, buildResults([]));

      expect(getSpy).toHaveBeenCalledWith({ projectId: '45' });
    });

    // Added to allow persisting per-user hierarchy row collapse state per work package list
    it('prefers the query scope over the project scope when both are available', () => {
      currentProjectServiceStub.inProjectContext = true;
      currentProjectServiceStub.id = '45';

      const query = buildQuery('42');
      service.initialize(query, buildResults([]));

      expect(getSpy).toHaveBeenCalledWith({ queryId: '42' });
    });

    it('keeps the fallback-derived collapse for ids the persisted state does not cover', () => {
      configurationServiceStub.collapseHierarchyOnLoad = () => true;
      getSpy.mockReturnValue(of({ collapsed: {} }));

      const query = buildQuery('42', true);
      service.initialize(query, buildResults(['1']));

      expect(service.collapsed('1')).toBe(true);
    });

    it('overrides the fallback-derived collapse with the persisted explicit value for the same id', () => {
      configurationServiceStub.collapseHierarchyOnLoad = () => true;
      getSpy.mockReturnValue(of({ collapsed: { 1: false } }));

      const query = buildQuery('42', true);
      service.initialize(query, buildResults(['1']));

      expect(service.collapsed('1')).toBe(false);
      expect(service.current.explicit['1']).toBe(true);
    });

    it('applies a persisted collapse even when the fallback setting is off', () => {
      configurationServiceStub.collapseHierarchyOnLoad = () => false;
      getSpy.mockReturnValue(of({ collapsed: { 1: true } }));

      const query = buildQuery('42', true);
      service.initialize(query, buildResults([]));

      expect(service.collapsed('1')).toBe(true);
      expect(service.current.explicit['1']).toBe(true);
    });
  });

  describe('persisting toggles', () => {
    it('marks a toggled row as explicit', () => {
      const query = buildQuery('42');
      service.initialize(query, buildResults([]));
      querySpace.query.putValue(query);

      service.collapse('7');

      expect(service.collapsed('7')).toBe(true);
      expect(service.current.explicit['7']).toBe(true);
    });

    it('debounces rapid successive toggles into a single PATCH with the final state', () => {
      const query = buildQuery('42');
      service.initialize(query, buildResults([]));
      querySpace.query.putValue(query);

      vi.useFakeTimers();
      try {
        service.collapse('7');
        service.expand('7');
        service.collapse('7');

        expect(patchSpy).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(patchSpy).toHaveBeenCalledTimes(1);
        expect(patchSpy).toHaveBeenCalledWith({ queryId: '42' }, { 7: true });
      } finally {
        vi.useRealTimers();
      }
    });

    // Added to allow persisting per-user hierarchy row collapse state per work package list
    it('persists toggles against the global scope on the ad-hoc (unsaved, no project) view', () => {
      const query = buildQuery(null);
      service.initialize(query, buildResults([]));
      querySpace.query.putValue(query);

      vi.useFakeTimers();
      try {
        service.collapse('7');
        vi.advanceTimersByTime(1000);

        expect(patchSpy).toHaveBeenCalledTimes(1);
        expect(patchSpy).toHaveBeenCalledWith({}, { 7: true });
      } finally {
        vi.useRealTimers();
      }
    });

    // Added to allow persisting per-user hierarchy row collapse state per work package list
    it('persists toggles against the project scope when no query is saved but a project is open', () => {
      currentProjectServiceStub.inProjectContext = true;
      currentProjectServiceStub.id = '45';

      const query = buildQuery(null);
      service.initialize(query, buildResults([]));
      querySpace.query.putValue(query);

      vi.useFakeTimers();
      try {
        service.collapse('7');
        vi.advanceTimersByTime(1000);

        expect(patchSpy).toHaveBeenCalledTimes(1);
        expect(patchSpy).toHaveBeenCalledWith({ projectId: '45' }, { 7: true });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // Added to allow the user to control whether hierarchy row collapse/expand state is
  // remembered across visits.
  describe('when remembering is turned off', () => {
    beforeEach(() => {
      configurationServiceStub.rememberHierarchyCollapseState = () => false;
    });

    it('does not request the persisted state on initialize', () => {
      const query = buildQuery('42');
      service.initialize(query, buildResults([]));

      expect(getSpy).not.toHaveBeenCalled();
    });

    it('does not persist a toggle, though it still applies for the current session', () => {
      const query = buildQuery('42');
      service.initialize(query, buildResults([]));
      querySpace.query.putValue(query);

      vi.useFakeTimers();
      try {
        service.collapse('7');
        vi.advanceTimersByTime(1000);

        expect(patchSpy).not.toHaveBeenCalled();
        expect(service.collapsed('7')).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // Added to allow resetting a user's remembered hierarchy row collapse state for debugging.
  // "My Account > Interface > Reset remembered collapse state" (MyController#reset_view_row_states)
  // deletes the persisted WorkPackages::ViewRowState row for the current user/scope. The next time
  // a table for that scope is opened, GET /view_row_states therefore returns an empty collapsed map
  // (exactly like `getSpy`'s default stub below), which must make the "collapse hierarchy on load"
  // setting the sole authority again, with no lingering explicit overrides from before the reset.
  describe('after the persisted state has been reset', () => {
    it('collapses every ancestor by default when "collapse hierarchy on load" is on', () => {
      configurationServiceStub.collapseHierarchyOnLoad = () => true;
      getSpy.mockReturnValue(of({ collapsed: {} }));

      const query = buildQuery('42', true);
      service.initialize(query, buildResults(['1']));

      expect(service.collapsed('1')).toBe(true);
      expect(service.current.explicit).toEqual({});
    });

    it('leaves every row expanded by default when "collapse hierarchy on load" is off', () => {
      configurationServiceStub.collapseHierarchyOnLoad = () => false;
      getSpy.mockReturnValue(of({ collapsed: {} }));

      const query = buildQuery('42', true);
      service.initialize(query, buildResults(['1']));

      expect(service.collapsed('1')).toBeFalsy();
      expect(service.current.explicit).toEqual({});
    });

    it('applies the same fallback behavior for the project ad-hoc scope', () => {
      currentProjectServiceStub.inProjectContext = true;
      currentProjectServiceStub.id = '45';
      configurationServiceStub.collapseHierarchyOnLoad = () => true;
      getSpy.mockReturnValue(of({ collapsed: {} }));

      const query = buildQuery(null, true);
      service.initialize(query, buildResults(['1']));

      expect(getSpy).toHaveBeenCalledWith({ projectId: '45' });
      expect(service.collapsed('1')).toBe(true);
    });

    it('applies the same fallback behavior for the global ad-hoc scope', () => {
      configurationServiceStub.collapseHierarchyOnLoad = () => false;
      getSpy.mockReturnValue(of({ collapsed: {} }));

      const query = buildQuery(null, true);
      service.initialize(query, buildResults(['1']));

      expect(getSpy).toHaveBeenCalledWith({});
      expect(service.collapsed('1')).toBeFalsy();
    });
  });
});
