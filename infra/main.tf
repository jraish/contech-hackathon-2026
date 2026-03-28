terraform {
  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_app" "solar_app" {
  spec {
    name   = "solar-buildings"
    region = "nyc3"

    # ── Backend (FastAPI) ─────────────────────────────────────────────────────
    service {
      name               = "backend"
      instance_count     = 1
      instance_size_slug = "apps-s-1vcpu-0.5gb"

      github {
        repo           = var.github_repo
        branch         = var.github_branch
        deploy_on_push = true
      }

      dockerfile_path = "backend/Dockerfile"

      # Public port — required for ingress routing to work
      http_port = 8000

      health_check {
        http_path             = "/health"
        initial_delay_seconds = 10
        period_seconds        = 30
      }

      env {
        key   = "NYC_OPEN_DATA_URL"
        value = "https://data.cityofnewyork.us/resource/5zhs-2jue.json"
        scope = "RUN_TIME"
      }

      env {
        key   = "NYC_APP_TOKEN"
        value = var.nyc_app_token
        scope = "RUN_TIME"
        type  = "SECRET"
      }
    }

    # ── Frontend (React static site) ──────────────────────────────────────────
    static_site {
      name = "frontend"

      github {
        repo           = var.github_repo
        branch         = var.github_branch
        deploy_on_push = true
      }

      dockerfile_path   = "frontend/Dockerfile"
      output_dir        = "/app/build"
      catchall_document = "index.html"

      env {
        key   = "REACT_APP_API_URL"
        value = "/api"
        scope = "BUILD_TIME"
      }
    }

    # ── Ingress: /api/* → backend, everything else → frontend ─────────────────
    ingress {
      rule {
        component {
          name                 = "backend"
          preserve_path_prefix = false
        }
        match {
          path {
            prefix = "/api"
          }
        }
      }

      rule {
        component {
          name = "frontend"
        }
        match {
          path {
            prefix = "/"
          }
        }
      }
    }
  }
}
