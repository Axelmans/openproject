import { QueryResource } from 'core-app/features/hal/resources/query-resource';
import { Injectable, inject } from '@angular/core';
import { WorkPackageViewHierarchies } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-table-hierarchies';
import { WorkPackageQueryStateService } from './wp-view-base.service';
import { WorkPackageCollectionResource } from 'core-app/features/hal/resources/wp-collection-resource';
import { ConfigurationService } from 'core-app/core/config/configuration.service';
// Added to allow persisting per-user hierarchy row collapse state per work package list
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
// Added to allow persisting per-user hierarchy row collapse state per work package list
import { ViewRowStateScope } from 'core-app/core/apiv3/endpoints/work_packages/apiv3-view-row-states';
// Added to allow persisting per-user hierarchy row collapse state per work package list
import { CurrentProjectService } from 'core-app/core/current-project/current-project.service';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Injectable()
export class WorkPackageViewHierarchiesService extends WorkPackageQueryStateService<WorkPackageViewHierarchies> {
  private readonly configurationService = inject(ConfigurationService);

  // Added to allow persisting per-user hierarchy row collapse state per work package list
  private readonly apiV3Service = inject(ApiV3Service);

  // Added to allow persisting per-user hierarchy row collapse state per work package list
  private readonly currentProjectService = inject(CurrentProjectService);

  // Added to allow persisting per-user hierarchy row collapse state per work package list.
  // Debounced so rapid successive toggles result in a single PATCH.
  private readonly persistTrigger = new Subject<ViewRowStateScope>();

  private readonly persistSubscription = this
    .persistTrigger
    .pipe(debounceTime(1000))
    .subscribe((scope) => this.persistExplicitState(scope));

  public valueFromQuery(query:QueryResource, results:WorkPackageCollectionResource):WorkPackageViewHierarchies {
    const value = new WorkPackageViewHierarchies(query.showHierarchies);
    // Altered to allow user to set automatic collapse of hierarchy on load
    const previousState = this.lastUpdatedState.value;

    if (previousState) {
      value.collapsed = previousState.collapsed;
      // Added to allow persisting per-user hierarchy row collapse state per work package list
      value.explicit = previousState.explicit;
    }

    else if (query.showHierarchies && this.configurationService.collapseHierarchyOnLoad()) {
      value.collapsed = this.collapseAllParents(results);
    }

    return value;
  }

  public initialize(query:QueryResource, results:WorkPackageCollectionResource) {
    super.initialize(query, results);

    // Added to allow persisting per-user hierarchy row collapse state per work package list.
    // Fired in parallel, not blocking the initial (fallback-derived) render. Skipped
    // entirely when the user has turned remembering off, so the feature behaves as if it
    // were not there at all (falling back to collapseHierarchyOnLoad only).
    if (this.configurationService.rememberHierarchyCollapseState()) {
      this.loadPersistedState(this.resolveScope(query));
    }
  }

  // Added to allow persisting per-user hierarchy row collapse state per work package list.
  // A saved query is scoped by its id; otherwise, in a project context, by the project's
  // numeric id (available synchronously via CurrentProjectService, no extra HTTP call);
  // otherwise the global (no query, no project) scope.
  private resolveScope(query:QueryResource):ViewRowStateScope {
    if (query.id) {
      return { queryId: query.id };
    }

    if (this.currentProjectService.inProjectContext) {
      return { projectId: this.currentProjectService.id };
    }

    return {};
  }

  // Added to allow persisting per-user hierarchy row collapse state per work package list
  private loadPersistedState(scope:ViewRowStateScope):void {
    this
      .apiV3Service
      .work_packages
      .view_row_states
      .get(scope)
      .subscribe((resource) => {
        const persisted = (resource.collapsed ?? {}) as Record<string, boolean>;

        if (Object.keys(persisted).length === 0) {
          return;
        }

        // Persisted, explicitly-set values always win over the fallback-derived state,
        // regardless of whether "collapse hierarchy on load" is currently on or off.
        const state = {
          ...this.current,
          collapsed: { ...this.current.collapsed, ...persisted },
          explicit: { ...this.current.explicit },
        };
        Object.keys(persisted).forEach((wpId) => { state.explicit[wpId] = true; });

        this.update(state);
      });
  }

  // Added to allow persisting per-user hierarchy row collapse state per work package list
  private persistExplicitState(scope:ViewRowStateScope):void {
    const { explicit, collapsed } = this.current;
    const payload:Record<string, boolean> = {};

    Object.keys(explicit).forEach((wpId) => { payload[wpId] = collapsed[wpId]; });

    this
      .apiV3Service
      .work_packages
      .view_row_states
      .patch(scope, payload)
      .subscribe({ error: () => null });
  }

  private collapseAllParents(results:WorkPackageCollectionResource):Record<string, boolean> {
    const collapsed:Record<string, boolean> = {};

    results.elements.forEach((wp) => {
      wp.getAncestors().forEach((ancestor) => {
        collapsed[ancestor.id as string] = true;
      });
    });

    return collapsed;
  }

  public hasChanged(query:QueryResource) {
    return query.showHierarchies !== this.isEnabled;
  }

  public applyToQuery(query:QueryResource) {
    query.showHierarchies = this.isEnabled;

    // We need to visibly load the ancestors when the mode is activated.
    return this.isEnabled;
  }

  /**
   * Return whether the current hierarchy mode is active
   */
  public get isEnabled():boolean {
    return !!(this.current && this.current.isVisible);
  }

  public setEnabled(active = true) {
    const state = { ...this.current, isVisible: active, last: null };
    this.update(state);
  }

  /**
   * Toggle the hierarchy state
   */
  public toggleState():boolean {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  /**
   * Return whether the given wp ID is collapsed.
   */
  public collapsed(wpId:string):boolean {
    return this.current.collapsed[wpId];
  }

  /**
   * Collapse the hierarchy for this work package
   */
  public collapse(wpId:string):void {
    this.setState(wpId, true);
  }

  /**
   * Expand the hierarchy for this work package
   */
  public expand(wpId:string):void {
    this.setState(wpId, false);
  }

  /**
   * Toggle the hierarchy state
   */
  public toggle(wpId:string):void {
    this.setState(wpId, !this.collapsed(wpId));
  }

  /**
   * Set the collapse/expand state of the given work package id.
   */
  private setState(wpId:string, isCollapsed:boolean):void {
    const state = { ...this.current, last: wpId };
    state.collapsed[wpId] = isCollapsed;
    // Added to allow persisting per-user hierarchy row collapse state per work package list
    state.explicit[wpId] = true;
    this.update(state);

    // Added to allow persisting per-user hierarchy row collapse state per work package list.
    // Skipped when the user has turned remembering off - the toggle still works for the
    // current session, it just is not sent to the server.
    const query = this.querySpace.query.value;
    if (query && this.configurationService.rememberHierarchyCollapseState()) {
      this.persistTrigger.next(this.resolveScope(query));
    }
  }

  /**
   * Get current selection state.
   */
  public get current():WorkPackageViewHierarchies {
    const state = this.lastUpdatedState.value;

    if (state === undefined) {
      return this.initialState;
    }

    if (!state.collapsed) {
      state.collapsed = {};
    }

    // Added to allow persisting per-user hierarchy row collapse state per work package list
    if (!state.explicit) {
      state.explicit = {};
    }

    return state;
  }

  private get initialState():WorkPackageViewHierarchies {
    return new WorkPackageViewHierarchies(false);
  }
}
