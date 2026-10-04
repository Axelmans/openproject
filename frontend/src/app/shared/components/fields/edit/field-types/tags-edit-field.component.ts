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

import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  MultiSelectEditFieldComponent,
} from 'core-app/shared/components/fields/edit/field-types/multi-select-edit-field.component';
import { HalResource } from 'core-app/features/hal/resources/hal-resource';
import { ApiV3Service } from 'core-app/core/apiv3/api-v3.service';
import { HalResourceNotificationService } from 'core-app/features/hal/services/hal-resource-notification.service';

/**
 * Edit field for "tags" custom fields: a multi-select where the user can either pick from
 * existing tag values or type a new one to create it inline (mirroring how
 * VersionsEditFieldComponent lets users create a new version from within the field).
 *
 * Unlike versions, creating a new tag value carries no separate permission check: anyone who
 * can edit this field can also add new tag values to the shared pool.
 */
@Component({
  templateUrl: './tags-edit-field.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false,
})
export class TagsEditFieldComponent extends MultiSelectEditFieldComponent implements OnInit {
  readonly apiV3Service = inject(ApiV3Service);

  readonly halNotification = inject(HalResourceNotificationService);

  public createLabel = this.I18n.t('js.label_create');

  public createNewTag = (name:string):Promise<HalResource> => this.createTag(name);

  private get customFieldId():string {
    return this.name.replace('customField', '');
  }

  private createTag(value:string):Promise<HalResource> {
    return firstValueFrom(this.apiV3Service.custom_options.post(this.tagPayload(value)))
      .then((option) => {
        // The new option must be an available option for the selected option mapping to find it.
        this.availableOptions = [...(this.availableOptions as HalResource[]), option];
        return option;
      })
      .catch((error) => {
        this.halNotification.handleRawError(error);
        throw error;
      });
  }

  private tagPayload(value:string) {
    return {
      value,
      _links: {
        customField: {
          href: this.apiV3Service.custom_fields.id(this.customFieldId).path,
        },
      },
    };
  }
}
