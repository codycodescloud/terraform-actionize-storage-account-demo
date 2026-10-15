# terraform-actionize-storage-account-demo

Demo scenario enabling users to "hack" a storage account by using its access key to post messages (add files) displayed on a webapp. Terraform Actions provides a mechanism to rotate the storage account key & prevent any more hacking!!

## How it works

One Azure Function App with two pages. Each page talks to the **same** storage account using a **different** kind of auth:

```
                         ┌──────────────────────── Function App (Node 22, B1) ───────────────────────┐
 📱 audience phones ───▶ │  GET/POST /hack    signs Put Blob with ACCESS_KEY (Shared Key)  ──────────┼──┐
                         │                                                                           │  │  ✅ before rotation
 📽️ projector ─────────▶ │  GET /             board page, polls ↓                                    │  │  🚫 403 after rotation
                         │  GET /api/messages lists blobs with the MANAGED IDENTITY (Entra ID) ──────┼──┤  ✅ always
                         └───────────────────────────────────────────────────────────────────────────┘  │
                                                                                                        ▼
                                                     storage account "board"  (messages/, blocked/ containers)
                                                            ▲
                         terraform apply -invoke=… ─────────┘  regenerateKey key1
```

- **Hackers** use `/hack` on their phones: pick a character, type a message, and the function writes a blob named `<cow> -_- <message> -_- #<id>` (e.g. `cow -_- helloworld -_- #3f9a1c`; the random id lets people post the same message twice), signed only with the "leaked" `ACCESS_KEY` app setting (`key1`).
- **The board** (`/`) lists the blobs with the Function App's managed identity and renders each filename with cowsay. It has a QR code that links to `/hack`.
- **The rotation:** the Terraform Action regenerates `key1`. The `ACCESS_KEY` the app holds is now stale, so every hack attempt gets a **403**. The board keeps working because it never used the key. Blocked attempts are saved (via managed identity) to the `blocked` container, and the board shows a red **"🔒 Key rotated · N hack attempts blocked"** banner with the messages struck out.
- The Functions runtime uses its own `host` storage account, so rotating the board's key can't take the app down.
- The app has zero npm dependencies (a hand-rolled Shared Key signer, managed identity client and cowsay), so Terraform zips `app/` and deploys it with no build step.

Characters: cow, tux, dragon, stegosaurus, vader, moose, sheep, turtle, daemon, kitty, bunny, ghost.

## Prerequisites

- Terraform **1.16.6** (pinned in `terraform.tf`).
- HCP Terraform workspace `codycodes/terraform-actionize-storage-account-rotate` with Azure credentials: either dynamic provider credentials (`TFC_AZURE_PROVIDER_AUTH=true`, `TFC_AZURE_RUN_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID`) or `ARM_CLIENT_ID` / `ARM_CLIENT_SECRET` / `ARM_TENANT_ID` / `ARM_SUBSCRIPTION_ID`.
- That identity needs **Owner** (or Contributor + User Access Administrator) on the subscription, because the config creates a role assignment.
- The subscription must allow Shared Key access on storage accounts. Some org policies deny `allowSharedKeyAccess`.

## Demo runbook

### 0. Before the meetup: deploy

```sh
terraform init
terraform apply
terraform output board_url   # projector
terraform output hack_url    # audience (or they scan the QR on the board)
```

Give the role assignment a few minutes to propagate. Until then the board shows "board read failed". Open both URLs and post a test message.

### 1. Create the action

Run the `terraform-actionize` skill and ask it to add storage key rotation for `azurerm_storage_account.board`, using **`key1`** (the key the app leaks). `azapi` is already in `required_providers`, so no re-init is needed.

<details>
<summary>Fallback if live-coding goes sideways (add to <code>actions.tf</code>)</summary>

```hcl
action "azapi_resource_action" "rotate_storage_key" {
  config {
    type        = "Microsoft.Storage/storageAccounts@2023-05-01"
    resource_id = azurerm_storage_account.board.id
    action      = "regenerateKey"
    method      = "POST"
    body = {
      keyName = "key1"
    }
  }
}
```

</details>

### 2. "The key leaked!"

Put the board on the projector and let the audience scan the QR code. Messages appear on the board within about 3 seconds.

### 3. Rotate the key

```sh
terraform apply -invoke=action.azapi_resource_action.rotate_storage_key
```

The next hack attempt on any phone gets **🚫 403 AuthenticationFailed**. Meanwhile the board stays live and starts counting blocked attempts.

## Resetting between rehearsals

```sh
terraform apply   # copies the new key1 into ACCESS_KEY -> hacking works again
az storage blob delete-batch --account-name "$(terraform output -raw storage_account_name)" -s messages
az storage blob delete-batch --account-name "$(terraform output -raw storage_account_name)" -s blocked
```

> A normal `terraform apply` after the rotation "re-arms" the hackers, because `ACCESS_KEY` comes from `primary_access_key`. Don't run one between step 3 and the end of the talk. It also makes a good talking point: rotating a key fixes nothing if the leaked config gets refreshed with the new one.

## Layout

```
terraform.tf / main.tf / variables.tf / outputs.tf   infrastructure
app/host.json                       routePrefix "" so routes are /, /hack, /api/messages, /cowsay.js
app/board/  app/hack/  app/messages/  app/cowsay/    HTTP functions (v3 function.json model, no deps)
app/shared/storage.js               Shared Key signer + managed identity blob client
app/shared/cowsay.js                cowsay renderer shared by Node and the browser
app/shared/board.html, hack.html    the two pages
```
