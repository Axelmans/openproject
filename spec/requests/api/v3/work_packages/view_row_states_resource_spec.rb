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
require "rack/test"

RSpec.describe "API v3 work package view row states resource", content_type: :json do
  include Rack::Test::Methods
  include API::V3::Utilities::PathHelper

  subject(:response) { last_response }

  shared_let(:project) { create(:project) }
  shared_let(:work_package) { create(:work_package, project:) }
  let(:user) { create(:user, member_with_permissions: { project => %i[view_work_packages] }) }

  current_user { user }

  describe "#GET" do
    context "when scoped to a query the user may see" do
      let(:query) { create(:query, project:, user:) }

      before do
        get api_v3_paths.view_row_states(query_id: query.id)
      end

      it "responds with 200 and an empty collapsed map when nothing was ever stored" do
        expect(response).to have_http_status(200)
        expect(response.body).to be_json_eql({}.to_json).at_path("collapsed")
      end

      context "with an existing stored state" do
        before do
          create(:work_package_view_row_state, user:, query:, collapsed: { work_package.id.to_s => true })

          get api_v3_paths.view_row_states(query_id: query.id)
        end

        it "returns the stored collapsed map" do
          expect(response.body)
            .to be_json_eql({ work_package.id.to_s => true }.to_json).at_path("collapsed")
        end
      end

      context "with a stale work package id in the stored state" do
        before do
          create(:work_package_view_row_state, user:, query:, collapsed: { "999999" => true, work_package.id.to_s => true })

          get api_v3_paths.view_row_states(query_id: query.id)
        end

        it "prunes the id of the deleted work package" do
          expect(response.body)
            .to be_json_eql({ work_package.id.to_s => true }.to_json).at_path("collapsed")
        end
      end
    end

    context "when scoped to a query the user may not see" do
      let(:other_user) { create(:user) }
      let(:query) { create(:query, project:, user: other_user, public: false) }

      before do
        get api_v3_paths.view_row_states(query_id: query.id)
      end

      it "responds with 404" do
        expect(response).to have_http_status(404)
      end
    end

    context "when scoped to a project the user may see" do
      before do
        get api_v3_paths.view_row_states(project_id: project.id)
      end

      it "responds with 200" do
        expect(response).to have_http_status(200)
        expect(response.body).to be_json_eql({}.to_json).at_path("collapsed")
      end
    end

    context "when scoped to a project the user has no access to" do
      let(:other_project) { create(:project) }

      before do
        get api_v3_paths.view_row_states(project_id: other_project.id)
      end

      it "responds with 403" do
        expect(response).to have_http_status(403)
      end
    end

    context "when scoped globally (no query or project)" do
      before do
        get api_v3_paths.view_row_states
      end

      it "responds with 200" do
        expect(response).to have_http_status(200)
        expect(response.body).to be_json_eql({}.to_json).at_path("collapsed")
      end
    end

    context "when not logged in" do
      let(:user) { User.anonymous }

      before do
        get api_v3_paths.view_row_states
      end

      it_behaves_like "unauthenticated access"
    end

    context "when another user has stored state for the same query" do
      let(:query) { create(:query, project:, user:) }
      let(:other_user) { create(:user, member_with_permissions: { project => %i[view_work_packages] }) }

      before do
        create(:work_package_view_row_state, user: other_user, query:, collapsed: { work_package.id.to_s => true })

        get api_v3_paths.view_row_states(query_id: query.id)
      end

      it "does not leak the other user's state" do
        expect(response.body).to be_json_eql({}.to_json).at_path("collapsed")
      end
    end
  end

  describe "#PATCH" do
    let(:query) { create(:query, project:, user:) }
    let(:params) { { collapsed: { work_package.id.to_s => true } } }

    before do
      patch api_v3_paths.view_row_states(query_id: query.id), params.to_json
    end

    it "responds with 200 and persists the collapsed map" do
      expect(response).to have_http_status(200)
      expect(response.body)
        .to be_json_eql({ work_package.id.to_s => true }.to_json).at_path("collapsed")

      expect(WorkPackages::ViewRowState.scoped_to(user:, query:).collapsed)
        .to eq(work_package.id.to_s => true)
    end

    it "full-replaces the map on a subsequent PATCH rather than merging" do
      other_work_package = create(:work_package, project:)

      patch api_v3_paths.view_row_states(query_id: query.id),
            { collapsed: { other_work_package.id.to_s => true } }.to_json

      expect(WorkPackages::ViewRowState.scoped_to(user:, query:).collapsed)
        .to eq(other_work_package.id.to_s => true)
    end

    context "when not logged in" do
      let(:user) { User.anonymous }

      it "responds with 401" do
        expect(response).to have_http_status(401)
      end
    end
  end
end
