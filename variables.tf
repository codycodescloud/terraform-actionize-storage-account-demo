variable "prefix" {
  description = "Short, lowercase prefix for every resource name."
  type        = string
  default     = "moo"

  validation {
    condition     = can(regex("^[a-z][a-z0-9]{1,9}$", var.prefix))
    error_message = "prefix must be 2-10 lowercase letters/digits (it ends up in storage account names)."
  }
}

variable "location" {
  description = "Azure region."
  type        = string
  default     = "westus2"
}

variable "app_service_sku" {
  description = "App Service plan SKU. B1 is always-on (no cold starts while the audience is watching)."
  type        = string
  default     = "B1"
}
