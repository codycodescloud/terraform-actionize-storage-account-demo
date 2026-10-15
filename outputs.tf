output "board_url" {
  description = "Put this on the projector."
  value       = "https://${azurerm_linux_function_app.demo.default_hostname}/"
}

output "hack_url" {
  description = "Hand this (or the QR code on the board) to the audience."
  value       = "https://${azurerm_linux_function_app.demo.default_hostname}/hack"
}

output "storage_account_name" {
  value = azurerm_storage_account.board.name
}

output "storage_account_id" {
  value = azurerm_storage_account.board.id
}

output "resource_group_name" {
  value = azurerm_resource_group.demo.name
}
