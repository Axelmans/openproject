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

RSpec.describe CustomOptions::CreateContract do
  let(:user) { build_stubbed(:user) }
  let(:custom_field) { build_stubbed(:tags_wp_custom_field) }
  let(:custom_option) { CustomOption.new(value: "urgent", custom_field:) }

  subject(:contract) { described_class.new(custom_option, user) }

  def stub_allowed_to_edit_work_packages(allowed)
    projects = instance_double(ActiveRecord::Relation)
    allow(Project).to receive(:allowed_to).with(user, :edit_work_packages).and_return(projects)
    allow(projects).to receive(:joins).with(:work_package_custom_fields).and_return(projects)
    allow(projects).to receive(:exists?).and_return(allowed)
  end

  context "when the custom field is not tags-format" do
    let(:custom_field) { build_stubbed(:list_wp_custom_field) }

    it "is invalid" do
      expect(contract).not_to be_valid
      expect(contract.errors[:custom_field]).to be_present
    end
  end

  context "when the custom field is tags-format" do
    context "when the user is allowed to edit work packages where the field is active" do
      before do
        stub_allowed_to_edit_work_packages(true)
      end

      it "is valid" do
        expect(contract).to be_valid
      end
    end

    context "when the user is not allowed to edit work packages where the field is active" do
      before do
        stub_allowed_to_edit_work_packages(false)
      end

      it "is invalid" do
        expect(contract).not_to be_valid
        expect(contract.errors[:base]).to be_present
      end
    end
  end
end
