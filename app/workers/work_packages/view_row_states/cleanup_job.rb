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
    # Added to allow persisting per-user hierarchy row collapse state per work package list
    #
    # Strips ids of deleted work packages from stored collapse maps (the API
    # already prunes on every read/write, this job catches rows nobody has
    # opened in a while, e.g. after a bulk work package destroy) and removes
    # rows left with an empty collapsed map.
    class CleanupJob < ApplicationJob
      queue_with_priority :low

      def perform
        ::WorkPackages::ViewRowState.find_each do |record|
          pruned = ::WorkPackages::ViewRowState.prune(record.collapsed)

          next if pruned == record.collapsed

          if pruned.empty?
            record.destroy!
          else
            record.update!(collapsed: pruned)
          end
        end
      end
    end
  end
end
