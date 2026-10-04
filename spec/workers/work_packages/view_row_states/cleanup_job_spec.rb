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

# Added to allow persisting per-user hierarchy row collapse state per work package list
require "spec_helper"

RSpec.describe WorkPackages::ViewRowStates::CleanupJob do
  shared_let(:user) { create(:user) }
  shared_let(:project) { create(:project) }
  shared_let(:work_package) { create(:work_package, project:) }

  it "strips stale work package ids from a row's collapsed map without deleting the row" do
    state = create(:work_package_view_row_state,
                   user:,
                   project:,
                   collapsed: { work_package.id.to_s => true, "999999" => true })

    described_class.new.perform

    expect(state.reload.collapsed).to eq(work_package.id.to_s => true)
  end

  it "deletes a row whose collapsed map becomes empty after pruning" do
    state = create(:work_package_view_row_state, user:, project:, collapsed: { "999999" => true })

    described_class.new.perform

    expect(WorkPackages::ViewRowState.exists?(state.id)).to be false
  end

  it "leaves a row untouched when all its ids are still valid" do
    state = create(:work_package_view_row_state, user:, project:, collapsed: { work_package.id.to_s => true })

    expect { described_class.new.perform }.not_to change { state.reload.updated_at }
  end
end
