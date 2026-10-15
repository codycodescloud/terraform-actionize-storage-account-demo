terraform {
  required_version = "1.16.6"

  cloud {

    organization = "codycodes" # TODO: change for your org!

    workspaces {
      name = "terraform-actionize-storage-account-rotate"
    }
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 5.10"
    }
    # Not used yet: terraform-actionize adds an azapi_resource_action for storage key rotation.
    # Declared up front so `terraform init` is already done before the demo.
    azapi = {
      source  = "Azure/azapi"
      version = "~> 2.9"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.8"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

provider "azurerm" {
  features {}
}
