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

# Added to allow resetting a user's remembered hierarchy row collapse state for debugging.
#
# The "collapse hierarchy on load" user preference is only ever applied in the frontend
# (WorkPackageViewHierarchiesService) - the backend has no notion of it at all. So the only
# thing that can be verified on this side of the "reset in combination with the setting"
# behavior is the precondition the frontend fallback relies on: after a reset, a subsequent
# read for that scope must come back with an empty collapsed map, regardless of whatever the
# setting is. See wp-view-hierarchy.service.spec.ts for tests of the fallback behavior itself.
require "spec_helper"

RSpec.describe "Resetting remembered work package view row states",
               :skip_csrf,
               type: :rails_request do
  include API::V3::Utilities::PathHelper

  shared_let(:project) { create(:project) }
  shared_let(:work_package) { create(:work_package, project:) }
  let(:user) { create(:user, member_with_permissions: { project => %i[view_work_packages] }) }

  before do
    login_as(user)
  end

  it "clears the stored explicit collapse state, regardless of the collapse_hierarchy_on_load setting, " \
     "so a subsequent read for the same scope comes back empty" do
    user.pref.collapse_hierarchy_on_load = true
    user.pref.save!
    create(:work_package_view_row_state, user:, project:, collapsed: { work_package.id.to_s => true })

    delete my_view_row_states_path

    expect(response).to redirect_to(my_interface_path)
    expect(WorkPackages::ViewRowState.scoped_to(user:, project:)).to be_nil

    get api_v3_paths.view_row_states(project_id: project.id)

    expect(response.body).to be_json_eql({}.to_json).at_path("collapsed")
  end

  it "does not clear another user's stored collapse state" do
    other_user = create(:user, member_with_permissions: { project => %i[view_work_packages] })
    create(:work_package_view_row_state, user: other_user, project:, collapsed: { work_package.id.to_s => true })

    delete my_view_row_states_path

    expect(WorkPackages::ViewRowState.scoped_to(user: other_user, project:)).to be_present
  end
end
