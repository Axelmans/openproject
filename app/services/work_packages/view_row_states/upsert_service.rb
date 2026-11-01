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
  module ViewRowStates
    # Finds or creates the ViewRowState row for a (user, scope) and
    # full-replaces its collapsed map, pruning ids of work packages that no
    # longer exist.
    #
    # Changed: the update is partial - only the given attributes (collapsed and/or
    # column_widths; nil = leave untouched) are replaced, so saving column widths does not
    # wipe the collapse state and vice versa.
    class UpsertService
      def initialize(user:)
        @user = user
      end

      def call(query: nil, project: nil, collapsed: nil, column_widths: nil)
        project = nil if query

        record = WorkPackages::ViewRowState.find_or_initialize_by(user: @user, query:, project:)
        record.collapsed = WorkPackages::ViewRowState.prune(collapsed) unless collapsed.nil?
        # Added to allow persisting per-user column widths
        record.column_widths = WorkPackages::ViewRowState.sanitize_widths(column_widths) unless column_widths.nil?
        record.save!

        record
      end
    end
  end
end
