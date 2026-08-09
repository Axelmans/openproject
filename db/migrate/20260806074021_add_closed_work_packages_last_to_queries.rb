# frozen_string_literal: true

class AddClosedWorkPackagesLastToQueries < ActiveRecord::Migration[8.1]
  def change
    # Added to allow closed work packages to be sorted to the bottom regardless of the chosen sort criteria
    add_column :queries, :closed_work_packages_last, :boolean, default: false, null: false
  end
end
