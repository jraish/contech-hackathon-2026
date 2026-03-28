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
      instance_size_slug = "apps-s-1vcpu-0.5gb"  # cheapest tier ~$5/mo

      # App Platform builds the Docker image straight from your repo
      github {
        repo           = var.github_repo        # e.g. "yourorg/solar-buildings"
        branch         = var.github_branch      # e.g. "main"
        deploy_on_push = true
      }

      # Path to the Dockerfile inside your repo
      dockerfile_path = "backend/Dockerfile"

      # Internal only — NOT exposed to the internet
      # The frontend reaches it via the internal service name: http://backend
      internal_ports = [8000]

      health_check {
        http_path             = "/health"
        initial_delay_seconds = 10
        period_seconds        = 30
      }

      # Secrets injected as environment variables — values come from variables.tf
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

    # ── Frontend (React, served as static files) ──────────────────────────────
    static_site {
      name = "frontend"

      github {
        repo           = var.github_repo
        branch         = var.github_branch
        deploy_on_push = true
      }

      dockerfile_path    = "frontend/Dockerfile"
      output_dir         = "/app/dist"   # wherever `npm run build` outputs to

      # Rewrite all paths to index.html so React Router works
      catchall_document = "index.html"

      # Tell the frontend where the backend lives.
      # App Platform gives each service an internal hostname: http://<service-name>
      # But the browser can't reach internal services — so we use a route proxy instead.
      # See the route block below.
      env {
        key   = "VITE_API_URL"
        value = "/api"   # frontend calls /api/..., which gets proxied to backend
        scope = "BUILD_TIME"
      }
    }

    # ── Ingress: route /api/* to backend, everything else to frontend ─────────
    ingress {
      rule {
        component {
          name = "backend"
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
