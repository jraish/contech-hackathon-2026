variable "do_token" {
  description = "DigitalOcean API token. Get one at https://cloud.digitalocean.com/account/api/tokens"
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "GitHub repo in 'org/repo' format, e.g. 'yourname/solar-buildings'"
  type        = string
}

variable "github_branch" {
  description = "Branch to deploy from"
  type        = string
  default     = "main"
}

variable "nyc_app_token" {
  description = "NYC Open Data app token (optional but prevents rate limiting). Get one free at https://data.cityofnewyork.us/profile/app_tokens"
  type        = string
  default     = ""
  sensitive   = true
}
