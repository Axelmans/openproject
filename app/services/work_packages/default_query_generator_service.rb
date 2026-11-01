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

module ::WorkPackages
  class DefaultQueryGeneratorService
    DEFAULT_QUERY = :all_open
    # Changed: added :all_closed, :due_soon and :watched_by_me, each placed next to the
    # existing view it complements (all open / overdue / assigned to me).
    QUERY_OPTIONS = [
      DEFAULT_QUERY,
      :all_closed,
      :latest_activity,
      :recently_created,
      :overdue,
      :due_soon,
      :summary,
      :created_by_me,
      :assigned_to_me,
      :watched_by_me,
      :shared_with_users,
      :shared_with_me
    ].freeze

    DEFAULT_PARAMS =
      {
        g: "",
        hi: false,
        t: "updatedAt:desc,id:asc"
      }.freeze

    attr_reader :project

    def initialize(with_project:)
      @project = with_project
    end

    def call(query_key: DEFAULT_QUERY)
      return { work_package_default: true } if query_key == DEFAULT_QUERY

      params = self.class.assign_params(query_key, project)

      return if params.nil?

      { query_props: params.to_json, name: query_key, show_enterprise_icon: self.class.show_enterprise_icon?(query_key) }
    end

    class << self
      def latest_activity_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type status assignee updatedAt],
            t: "updatedAt:desc",
            f: [{ "n" => "status", "o" => "*", "v" => [] }]
          }
        )
      end

      def recently_created_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type status assignee createdAt],
            t: "createdAt:desc",
            f: [{ "n" => "status", "o" => "o", "v" => [] }]
          }
        )
      end

      def overdue_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id type subject status startDate dueDate duration],
            t: "createdAt:desc",
            f: [{ "n" => "dueDate", "o" => "<t-", "v" => ["1"] },
                { "n" => "status", "o" => "o", "v" => [] }]
          }
        )
      end

      # Added to allow a quick view of finished work, most recently closed/updated first
      def all_closed_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type status assignee updatedAt],
            t: "updatedAt:desc",
            f: [{ "n" => "status", "o" => "c", "v" => [] }]
          }
        )
      end

      # Added to allow seeing open work that is due within the next 7 days
      # (counterpart of the overdue view)
      def due_soon_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id type subject status startDate dueDate duration],
            t: "dueDate:asc",
            f: [{ "n" => "dueDate", "o" => "<t+", "v" => ["7"] },
                { "n" => "status", "o" => "o", "v" => [] }]
          }
        )
      end

      def summary_query
        {}
      end

      def created_by_me_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type status assignee updatedAt],
            f: [{ "n" => "status", "o" => "o", "v" => [] },
                { "n" => "author", "o" => "=", "v" => ["me"] }]
          }
        )
      end

      def assigned_to_me_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type status author updatedAt],
            f: [{ "n" => "status", "o" => "o", "v" => [] },
                { "n" => "assigneeOrGroup", "o" => "=", "v" => ["me"] }]
          }
        )
      end

      # Added to allow seeing open work packages the current user is watching
      def watched_by_me_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type status assignee updatedAt],
            f: [{ "n" => "status", "o" => "o", "v" => [] },
                { "n" => "watcher", "o" => "=", "v" => ["me"] }]
          }
        )
      end

      def shared_with_users_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type project sharedWithUsers],
            f: [{ "n" => "sharedWithUser", "o" => "*", "v" => [] }]
          }
        )
      end

      def shared_with_me_query
        DEFAULT_PARAMS.merge(
          {
            c: %w[id subject type project],
            f: [{ "n" => "sharedWithMe", "o" => "=", "v" => "t" }]
          }
        )
      end

      def assign_params(query_key, project)
        case query_key
        when :latest_activity
          latest_activity_query
        when :recently_created
          recently_created_query
        when :overdue
          overdue_query
        # Added: new non user-specific default views
        when :all_closed
          all_closed_query
        when :due_soon
          due_soon_query
        when :summary
          return if project.blank?

          summary_query
        else
          return unless User.current.logged?

          user_specific_queries(query_key)
        end
      end

      def user_specific_queries(query_key)
        case query_key
        when :created_by_me
          created_by_me_query
        when :assigned_to_me
          assigned_to_me_query
        # Added: only for logged-in users, like the other "me" views
        when :watched_by_me
          watched_by_me_query
        when :shared_with_users
          shared_with_users_query
        when :shared_with_me
          shared_with_me_query
        end
      end

      def show_enterprise_icon?(query_key)
        # Added: respects the user's personal "hide enterprise banners" preference.
        !EnterpriseToken.allows_to?(:work_package_sharing) &&
          %i[shared_with_users shared_with_me].any?(query_key) &&
          !User.current.pref.hide_enterprise_banners?
      end
    end
  end
end
