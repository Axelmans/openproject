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

RSpec.describe WorkPackages::ViewRowState do
  shared_let(:user) { create(:user) }
  shared_let(:project) { create(:project) }
  shared_let(:query) { create(:query, project:, user:) }
  shared_let(:work_package) { create(:work_package, project:) }

  describe "uniqueness per scope" do
    it "allows only one row per user per query" do
      create(:work_package_view_row_state, user:, query:)

      duplicate = build(:work_package_view_row_state, user:, query:)

      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "allows only one row per user per project ad-hoc scope" do
      create(:work_package_view_row_state, user:, project:)

      duplicate = build(:work_package_view_row_state, user:, project:)

      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "allows only one global row per user" do
      create(:work_package_view_row_state, user:)

      duplicate = build(:work_package_view_row_state, user:)

      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "allows the same user to have a global row, a project row, and a query row simultaneously" do
      create(:work_package_view_row_state, user:)
      create(:work_package_view_row_state, user:, project:)
      create(:work_package_view_row_state, user:, query:)

      expect(described_class.where(user:).count).to eq(3)
    end

    it "allows two different users to each have a global row" do
      other_user = create(:user)

      create(:work_package_view_row_state, user:)

      expect { create(:work_package_view_row_state, user: other_user) }.not_to raise_error
    end
  end

  describe "validations" do
    it "requires a project to be blank when a query is set" do
      state = build(:work_package_view_row_state, user:, query:, project:)

      expect(state).not_to be_valid
      expect(state.errors[:project]).to be_present
    end
  end

  describe ".scoped_to" do
    it "finds the row for a query scope" do
      state = create(:work_package_view_row_state, user:, query:)

      expect(described_class.scoped_to(user:, query:)).to eq(state)
    end

    it "finds the row for a project scope" do
      state = create(:work_package_view_row_state, user:, project:)

      expect(described_class.scoped_to(user:, project:)).to eq(state)
    end

    it "finds the global row" do
      state = create(:work_package_view_row_state, user:)

      expect(described_class.scoped_to(user:)).to eq(state)
    end

    it "returns nil when nothing is stored for the scope" do
      expect(described_class.scoped_to(user:, query:)).to be_nil
    end
  end

  describe ".prune" do
    it "drops ids of work packages that no longer exist" do
      collapsed = { work_package.id.to_s => true, "999999" => false }

      expect(described_class.prune(collapsed)).to eq(work_package.id.to_s => true)
    end

    it "returns an empty hash for a blank input" do
      expect(described_class.prune(nil)).to eq({})
      expect(described_class.prune({})).to eq({})
    end
  end
end
