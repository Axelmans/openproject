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

RSpec.describe "account/login" do
  context "with password login enabled" do
    before do
      render
    end

    it "shows a login field" do
      expect(rendered).to include "Password"
    end
  end

  context "with password login disabled" do
    before do
      allow(OpenProject::Configuration).to receive(:disable_password_login?).and_return(true)
      render
    end

    it "does not show a login field" do
      expect(rendered).not_to include "Password"
    end
  end

  context "if user is not logged in" do
    before do
      User.anonymous.pref.update(settings: { "theme" => "sync_with_os" })
    end

    it "the underlying preference helper still reflects whatever is stored for the anonymous user" do
      theme_data = view.user_theme_data_attributes

      expect(theme_data[:auto_theme_switcher_theme_value]).to eq("sync_with_os")
      # Check that contrast flags exist
      expect(theme_data).to have_key(:auto_theme_switcher_force_light_contrast_value)
      expect(theme_data).to have_key(:auto_theme_switcher_force_dark_contrast_value)
      # Check logo classes
      expect(theme_data[:auto_theme_switcher_desktop_light_high_contrast_logo_class]).to eq("op-logo--link_high_contrast")
      expect(theme_data[:auto_theme_switcher_mobile_white_logo_class]).to eq("op-logo--icon_white")
    end

    # Added: the actual page (via #body_data_attributes, not the raw preference helper
    # above) always forces dark for anonymous visitors - login/registration/password-reset
    # pages should not reveal or depend on any stored theme preference before someone is
    # identified, regardless of the stored (even "sync_with_os") preference above.
    it "body_data_attributes forces dark mode regardless of the stored anonymous preference" do
      body_data = view.body_data_attributes({})

      expect(body_data[:color_mode]).to eq("dark")
      expect(body_data[:dark_theme]).to eq("dark")
      expect(body_data).not_to have_key(:light_theme)
      expect(body_data[:auto_theme_switcher_theme_value]).to eq("dark")
    end
  end
end
