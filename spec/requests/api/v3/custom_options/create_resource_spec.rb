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

require "spec_helper"
require "rack/test"

# Added to allow end users to create new "tags" custom field options inline, from the work
# package edit form.
RSpec.describe "POST api/v3/custom_options", :aggregate_failures, content_type: :json do
  include Rack::Test::Methods
  include API::V3::Utilities::PathHelper

  shared_let(:project) { create(:project, enabled_module_names: %w[work_package_tracking]) }
  shared_let(:tags_custom_field) do
    create(:tags_wp_custom_field, projects: [project])
  end

  let(:path) { api_v3_paths.custom_options }
  let(:body) do
    {
      value: "urgent",
      _links: {
        customField: {
          href: api_v3_paths.custom_field(tags_custom_field.id)
        }
      }
    }.to_json
  end

  subject(:response) { last_response }

  before do
    login_as current_user
    post path, body
  end

  context "with a user allowed to edit work packages in a project where the field is active" do
    let(:current_user) do
      create(:user, member_with_permissions: { project => %i[edit_work_packages] })
    end

    it "responds with 201" do
      expect(response).to have_http_status(:created)
    end

    it "creates the custom option" do
      expect(tags_custom_field.custom_options.reload.pluck(:value))
        .to contain_exactly("urgent")
    end

    it "returns the newly created custom option", :aggregate_failures do
      expect(response.body).to be_json_eql("CustomOption".to_json).at_path("_type")
      expect(response.body).to be_json_eql("urgent".to_json).at_path("value")
    end
  end

  context "with a user lacking edit_work_packages in any project where the field is active" do
    let(:current_user) do
      create(:user, member_with_permissions: { project => %i[view_work_packages] })
    end

    it "responds with 403" do
      expect(response).to have_http_status(:forbidden)
    end

    it "does not create a custom option" do
      expect(tags_custom_field.custom_options.reload).to be_empty
    end
  end

  context "with a target custom field that is not tags-format" do
    shared_let(:list_custom_field) do
      create(:list_wp_custom_field, projects: [project])
    end

    let(:body) do
      {
        value: "smuggled option",
        _links: {
          customField: {
            href: api_v3_paths.custom_field(list_custom_field.id)
          }
        }
      }.to_json
    end
    let(:current_user) do
      create(:user, member_with_permissions: { project => %i[edit_work_packages] })
    end

    it "responds with 422" do
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "does not create the smuggled custom option" do
      expect(list_custom_field.custom_options.reload.pluck(:value))
        .not_to include("smuggled option")
    end
  end
end
