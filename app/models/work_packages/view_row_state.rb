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

module WorkPackages
  # Persists, per (user, work package list), which hierarchy rows the user has
  # explicitly expanded/collapsed, so the state survives between visits.
  #
  # A "work package list" is one of:
  #   - a saved Query (query set, project irrelevant)
  #   - a project's default/ad-hoc work packages view (query nil, project set)
  #   - the global default/ad-hoc work packages view (query nil, project nil)
  class ViewRowState < ApplicationRecord
    self.table_name = "work_package_view_row_states"

    belongs_to :user
    belongs_to :query, optional: true
    belongs_to :project, optional: true

    validates :user, presence: true
    validate :project_blank_when_query_present

    # Finds (without creating) the row for the given scope.
    def self.scoped_to(user:, query: nil, project: nil)
      if query
        find_by(user:, query:)
      else
        find_by(user:, query: nil, project:)
      end
    end

    # Drops ids of work packages that no longer exist from a collapsed map.
    # Guards against the map accumulating stale ids of deleted work packages,
    # since jsonb keys cannot be cleaned up via a foreign key cascade.
    def self.prune(collapsed)
      return {} if collapsed.blank?

      existing_ids = WorkPackage.where(id: collapsed.keys).pluck(:id).map(&:to_s)
      collapsed.slice(*existing_ids)
    end

    private

    def project_blank_when_query_present
      errors.add(:project, :present) if query_id.present? && project_id.present?
    end
  end
end
