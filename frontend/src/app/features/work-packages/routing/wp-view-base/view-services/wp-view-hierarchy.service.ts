import { QueryResource } from 'core-app/features/hal/resources/query-resource';
import { Injectable, inject } from '@angular/core';
import { WorkPackageViewHierarchies } from 'core-app/features/work-packages/routing/wp-view-base/view-services/wp-table-hierarchies';
import { WorkPackageQueryStateService } from './wp-view-base.service';
import { WorkPackageCollectionResource } from 'core-app/features/hal/resources/wp-collection-resource';
import { ConfigurationService } from 'core-app/core/config/configuration.service';

@Injectable()
export class WorkPackageViewHierarchiesService extends WorkPackageQueryStateService<WorkPackageViewHierarchies> {
  private readonly configurationService = inject(ConfigurationService);
  
  public valueFromQuery(query:QueryResource, results:WorkPackageCollectionResource):WorkPackageViewHierarchies {
    const value = new WorkPackageViewHierarchies(query.showHierarchies);
    // Altered to allow user to set automatic collapse of hierarchy on load
    const previousState = this.lastUpdatedState.value;

    if (previousState) {
      value.collapsed = previousState.collapsed;
    }

    else if (query.showHierarchies && this.configurationService.collapseHierarchyOnLoad()) {
      value.collapsed = this.collapseAllParents(results);
    }

    return value;
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
    this.update(state);
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

    return state;
  }

  private get initialState():WorkPackageViewHierarchies {
    return new WorkPackageViewHierarchies(false);
  }
}
