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

module API
  module V3
    module CustomOptions
      class CustomOptionRepresenter < ::API::Decorators::Single
        include API::Decorators::LinkedResource

        self_link

        def _type
          "CustomOption"
        end

        property :id

        property :value

        # Added to allow creating new "tags" custom options inline (POST /api/v3/custom_options),
        # which needs a way to specify which custom field the new option belongs to.
        resource_link :customField,
                      getter: ->(*) {
                        next unless represented.custom_field_id

                        {
                          href: api_v3_paths.custom_field(represented.custom_field_id),
                          title: represented.custom_field&.name
                        }
                      },
                      setter: ->(fragment:, **) {
                        next unless fragment

                        represented.custom_field_id = ::API::Utilities::ResourceLinkParser
                                                       .parse_id fragment["href"],
                                                                 property: "customField",
                                                                 expected_version: "3",
                                                                 expected_namespace: "custom_fields"
                      }
      end
    end
  end
end
