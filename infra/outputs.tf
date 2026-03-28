output "app_url" {
  description = "Public URL for the frontend — share this with your team"
  value       = "https://${digitalocean_app.solar_app.live_url}"
}

output "app_id" {
  description = "DigitalOcean App ID (useful for debugging in the DO console)"
  value       = digitalocean_app.solar_app.id
}
