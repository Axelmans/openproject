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

module API
  module V3
    module WorkPackages
      module ViewRowStates
        # Added to allow persisting per-user hierarchy row collapse state per work package list
        class ViewRowStatesAPI < ::API::OpenProjectAPI
          resource :view_row_states do
            params do
              optional :query_id, type: Integer, desc: "Scope to a saved query"
              optional :project_id, type: Integer, desc: "Scope to a project's default work packages view"
              mutually_exclusive :query_id, :project_id
            end

            after_validation do
              if params[:query_id]
                @query = ::Query.find(params[:query_id])

                authorize_by_with_raise(QueryPolicy.new(current_user).allowed?(@query, :show)) do
                  raise API::Errors::NotFound
                end
              elsif params[:project_id]
                @project = Project.find(params[:project_id])

                authorize_in_project(:view_work_packages, project: @project)
              else
                authorize_in_any_work_package(:view_work_packages)
              end
            end

            get do
              record = ::WorkPackages::ViewRowState.scoped_to(user: current_user, query: @query, project: @project) ||
                       ::WorkPackages::ViewRowState.new(user: current_user, query: @query, project: @project, collapsed: {})
              record.collapsed = ::WorkPackages::ViewRowState.prune(record.collapsed)

              ViewRowStateRepresenter.new(record, query: @query, project: @project, current_user:)
            end

            patch do
              payload = ViewRowStatePayloadRepresenter.create(API::ParserStruct.new, current_user:)
              payload.from_hash(request_body)

              record = ::WorkPackages::ViewRowStates::UpsertService
                         .new(user: current_user)
                         .call(query: @query, project: @project, collapsed: payload.represented.collapsed || {})

              ViewRowStateRepresenter.new(record, query: @query, project: @project, current_user:)
            rescue ActiveRecord::RecordInvalid => e
              raise ::API::Errors::ErrorBase.create_and_merge_errors(e.record.errors)
            end
          end
        end
      end
    end
  end
end
