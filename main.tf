resource "random_string" "suffix" {
  length  = 6
  upper   = false
  special = false
}

locals {
  name = "${var.prefix}-${random_string.suffix.result}"

  # Rebuild the zip (and redeploy) whenever anything under app/ changes.
  app_hash = substr(sha1(join("", [
    for f in sort(fileset("${path.module}/app", "**")) : "${f}:${filesha1("${path.module}/app/${f}")}"
  ])), 0, 12)
}

resource "azurerm_resource_group" "demo" {
  name     = "rg-${local.name}"
  location = var.location
}

# -----------------------------------------------------------------------------
# The target: the storage account the "hackers" write to with its leaked key1.
# A Terraform Action (added by terraform-actionize) regenerates key1 to lock them out.
# -----------------------------------------------------------------------------
resource "azurerm_storage_account" "board" {
  name                            = "${var.prefix}board${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.demo.name
  location                        = azurerm_resource_group.demo.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false

  # The whole demo relies on Shared Key auth being allowed.
  shared_access_key_enabled = true
}

resource "azurerm_storage_container" "messages" {
  name                  = "messages"
  storage_account_id    = azurerm_storage_account.board.id
  container_access_type = "private"
}

resource "azurerm_storage_container" "blocked" {
  name                  = "blocked"
  storage_account_id    = azurerm_storage_account.board.id
  container_access_type = "private"
}

# -----------------------------------------------------------------------------
# Function App runtime storage. Kept separate so rotating the board's key can't
# take the Function App itself down.
# -----------------------------------------------------------------------------
resource "azurerm_storage_account" "host" {
  name                            = "${var.prefix}host${random_string.suffix.result}"
  resource_group_name             = azurerm_resource_group.demo.name
  location                        = azurerm_resource_group.demo.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
}

resource "azurerm_service_plan" "demo" {
  name                = "asp-${local.name}"
  resource_group_name = azurerm_resource_group.demo.name
  location            = azurerm_resource_group.demo.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku
}

# A resource (not the data source) so the zip is rebuilt on whichever HCP Terraform
# worker runs the apply.
resource "archive_file" "app" {
  type        = "zip"
  source_dir  = "${path.module}/app"
  output_path = "${path.module}/.build/app-${local.app_hash}.zip"
}

resource "azurerm_linux_function_app" "demo" {
  name                       = "func-${local.name}"
  resource_group_name        = azurerm_resource_group.demo.name
  location                   = azurerm_resource_group.demo.location
  service_plan_id            = azurerm_service_plan.demo.id
  storage_account_name       = azurerm_storage_account.host.name
  storage_account_access_key = azurerm_storage_account.host.primary_access_key
  https_only                 = true
  zip_deploy_file            = archive_file.app.output_path

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on = true

    application_stack {
      node_version = "22"
    }
  }

  app_settings = {
    WEBSITE_RUN_FROM_PACKAGE = "1"
    BOARD_ACCOUNT_NAME       = azurerm_storage_account.board.name
    MESSAGES_CONTAINER       = azurerm_storage_container.messages.name
    BLOCKED_CONTAINER        = azurerm_storage_container.blocked.name

    # The "leaked" credential. The hack endpoint signs blob writes with this and nothing else.
    # Rotating key1 makes this value stale -> 403. A normal `terraform apply` afterwards
    # copies the new key back in (handy for resetting between rehearsals).
    ACCESS_KEY = azurerm_storage_account.board.primary_access_key
  }

  # Restart the app after any in-place update (new zip, changed app settings, ...).
  # Can still be run by hand: terraform apply -invoke=action.azapi_resource_action.restart_function_app
  lifecycle {
    action_trigger {
      events  = [after_update]
      actions = [action.azapi_resource_action.restart_function_app]
    }
  }
}

# The board reads (and records blocked attempts) with the Function App's managed
# identity, so it keeps working after the key is rotated.
resource "azurerm_role_assignment" "board_data" {
  scope                = azurerm_storage_account.board.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_function_app.demo.identity[0].principal_id
  principal_type       = "ServicePrincipal"
}
