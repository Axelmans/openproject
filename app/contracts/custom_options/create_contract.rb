# frozen_string_literal: true

#-- copyright
# OpenProject is an open source project management software.
# Copyright (C) the OpenProject GmbH
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License version 3.
#
# OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
# Copyright (C) 2006-2013 Jean-Philippe Lang
# Copyright (C) 2010-2013 the ChiliProject Team
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
#
# See COPYRIGHT and LICENSE files for more details.
#++

# Added to allow end users to create new "tags" custom field options inline, from the work
# package edit form, instead of only via the custom field's admin settings (which is how every
# other "list"-like custom option is created).
module CustomOptions
  class CreateContract < BaseContract
    validate :custom_field_must_be_tags_format
    validate :user_allowed_to_create_option

    private

    # This endpoint only supports creating options for "tags" custom fields. Admin-managed
    # "list" (and hierarchy/weighted_item_list) options are still only created through the
    # custom field's own admin settings screen, not through this API.
    def custom_field_must_be_tags_format
      return if model.custom_field&.field_format == "tags"

      errors.add :custom_field, :error_unauthorized
    end

    # Anyone who can edit work packages in at least one project where this custom field is
    # active may create a new tag value - matching who can set the field's value in the first
    # place (no separate/stricter permission, unlike e.g. version creation).
    def user_allowed_to_create_option
      return if model.custom_field.blank?

      allowed = Project
        .allowed_to(user, :edit_work_packages)
        .joins(:work_package_custom_fields)
        .exists?(custom_fields: { id: model.custom_field_id })

      errors.add :base, :error_unauthorized unless allowed
    end
  end
end
