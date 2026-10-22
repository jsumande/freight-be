# Weather-Aware Commercial Freight Truck Routing Engine

A full-stack operational web application built with **Django REST Framework** and **React (TypeScript + Vite + Leaflet)** designed for commercial freight dispatch operations. The system dynamically evaluates live weather hazards (crosswinds, heavy rainfall, severe snowfall), applies vehicle stability cargo-weight physics overrides, samples geometric checkpoints, and recommends the safest route using deterministic lexicographical multi-hazard ranking.

---

## 1. System Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │      React 19 + TypeScript + Vite Client     │
                    │  (Interactive Leaflet Map, Timeline Slider)  │
                    └──────────────────────┬───────────────────────┘
                                           │ HTTP REST (JSON)
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │          Django REST Framework API           │
                    │  (/api/routes/calculate/, /api/docs/ Swagger)│
                    └──────┬───────────────┬────────────────┬──────┘
                           │               │                │
                           ▼               ▼                ▼
                  ┌────────────────┐┌──────────────┐┌───────────────┐
                  │ Open-Meteo Geo ││   OSRM v5    ││  Open-Meteo   │
                  │  & Nominatim   ││ Highway Engine││ Hourly (0-48h)│
                  └────────────────┘└──────────────┘└───────────────┘
                                           │
                                           ▼
                           ┌───────────────────────────────┐
                           │ Checkpoint Polyline Generator │
                           │  (Step ETA Monotonic Timing)  │
                           └───────────────┬───────────────┘
                                           ▼
                           ┌───────────────────────────────┐
                           │   Risk Engine & Weight Rules  │
                           │   (Strict Boundary Logic)     │
                           └───────────────┬───────────────┘
                                           ▼
                           ┌───────────────────────────────┐
                           │    Lexicographical Ranking    │
                           │  (1D Voronoi Mile Aggregator) │
                           └───────────────────────────────┘
```

### OpenAPI & Interactive Swagger Documentation
The backend exposes comprehensive OpenAPI 3.0 documentation generated dynamically via `drf-spectacular`:
- **Interactive Swagger UI**: [`http://localhost:8000/api/docs/`](http://localhost:8000/api/docs/)
- **Redoc Documentation**: [`http://localhost:8000/api/redoc/`](http://localhost:8000/api/redoc/)
- **OpenAPI Schema (YAML/JSON)**: [`http://localhost:8000/api/schema/`](http://localhost:8000/api/schema/)

### Key Engineering Principles
- **Separation of Concerns**: Pure domain risk evaluation (`risk_assessment.py` and `route_ranking.py`) is completely decoupled from I/O, database models, and network requests, enabling 100% boundary unit test coverage.
- **Genuine Live Integrations**: Live routing via Open Source Routing Machine (OSRM) and live weather forecasts via Open-Meteo API. No fabricated mock data or fake calculations.
- **Mileage Conservation**: Checkpoint risk attribution uses 1D Voronoi segment midpoints ($\Delta d_i$). The sum of all segment miles strictly matches total route distance ($\sum \Delta d_i \equiv D_{\text{total}}$), preventing sampling distortion.
- **Zero-Compromise Safety Policy**: Any route containing a `NO_TRAVEL` hazard is strictly disqualified. If all alternative routes exhibit `NO_TRAVEL`, the system explicitly reports **"No Safe Route Available"** rather than presenting the least dangerous path.

---

## 2. Risk Assessment & Physics Overrides

### 2.1 Exact Hazard Thresholds
| Severity Level | Wind Speed ($v$) | Rainfall Intensity ($r$) | Snowfall Intensity ($s$) |
| :--- | :--- | :--- | :--- |
| **LOW** | $v < 25.0$ mph | $r < 0.10$ in/hr | $s < 0.50$ in/hr |
| **MODERATE** | $25.0 \le v < 35.0$ mph | $0.10 \le r < 0.25$ in/hr | $0.50 \le s < 1.00$ in/hr |
| **HIGH** | $35.0 \le v < 45.0$ mph | $0.25 \le r < 0.50$ in/hr | $1.00 \le s < 2.00$ in/hr |
| **SEVERE** | $45.0 \le v < 55.0$ mph | $0.50 \le r \le 1.00$ in/hr *(inclusive)* | $2.00 \le s \le 3.00$ in/hr *(inclusive)* |
| **NO TRAVEL** | $v \ge 55.0$ mph | $r > 1.00$ in/hr | $s > 3.00$ in/hr |

### 2.2 Cargo-Weight Overrides
To account for lateral aerodynamic torque and rollover risk on commercial vehicles:
1. **$v \ge 55.0$ mph**: Enforces **NO TRAVEL** for every vehicle load.
2. **$45.0 \le v < 55.0$ mph**: Enforces **NO TRAVEL** if cargo weight $> 30,000$ lbs. (Retains **SEVERE** if $\le 30,000$ lbs).
3. **$35.0 \le v < 45.0$ mph**: Enforces **SEVERE** if cargo weight $> 40,000$ lbs. (Retains **HIGH** if $\le 40,000$ lbs).

### 2.3 Multi-Hazard Aggregation
For each checkpoint, the overall risk is the maximum severity across all applicable hazards:
$$\text{Overall Risk} = \max(\text{WindRisk}_{\text{adjusted}},\, \text{RainRisk},\, \text{SnowRisk})$$
Missing weather measurements are preserved as `UNKNOWN` and never silently converted to `LOW`.

---

## 3. Deterministic Route Ranking Algorithm

Routes are evaluated and sorted using a deterministic lexicographical priority key:
1. **Fewest miles classified as Severe**
2. **Fewest miles classified as High**
3. **Lowest distance-weighted Average Risk Score** (Numerical scale: Low=1.0, Moderate=2.0, High=3.0, Severe=4.0, No Travel=5.0)
4. **Shortest estimated travel duration**

A route containing any `NO_TRAVEL` mileage is disqualified (`is_safe = False`). If all routes are disqualified, the system declares `ALL_ROUTES_UNSAFE`.

---

## 4. Local Development Setup

### Prerequisites
- Python 3.12+ (managed with `uv`)
- Node.js 20+ & npm

### Backend Setup
```bash
# Navigate to backend
cd backend

# Sync dependencies using uv
uv sync

# Run database migrations
uv run python manage.py migrate

# Start Django development server (runs on port 8000)
uv run python manage.py runserver 127.0.0.1:8000
```

### Frontend Setup
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install --legacy-peer-deps

# Start Vite development server (runs on port 5173 with proxy to 8000)
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 5. Automated Test Suites

### Backend Unit & Boundary Tests (Pytest)
Comprehensive suite covering exact threshold boundaries, weight overrides, Voronoi mileage conservation, ranking priorities, and API endpoints:
```bash
cd backend
uv run pytest tests -v
```
*Current test suite: 42 passed tests.*

### Frontend Component & Interaction Tests (Vitest)
Tests search parameter submission, route selection, checkpoint inspection with weight override alerts, and timeline updates:
```bash
cd frontend
npm test
```
*Current test suite: 5 passed tests.*

### Frontend Production Build & Typecheck
```bash
cd frontend
npm run build
```

---

## 6. Docker Deployment

A production-ready `docker-compose.yml` is provided for containerized deployment:

```bash
# Build and run containers in background
docker compose up --build -d
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000/api/`

---

## 7. Engineering Trade-Offs & Disclosed Limitations

1. **Routing Provider Profile**:
   - Routes and geometries are retrieved from OSRM's public highway network. OSRM calculates standard vehicle drive times and highway networks.
   - *Limitation*: Commercial truck clearance restrictions (e.g. low underpasses under 13'6", bridge weight limits, hazmat tunnel bans) are not enforced by OSRM. This limitation is explicitly stated in the UI and API responses.
2. **Weather Temporal Resolution**:
   - Open-Meteo forecasts are resolved on an hourly interval. Checkpoint ETAs are aligned to the nearest hourly forecast step. Local microbursts or transient gusts between forecast cycles may differ.
3. **Timeline Slider Performance**:
   - The 0–48 hour timeline slider sends debounced re-evaluation queries to the backend (`/api/routes/forecast-timeline/`). Stale response discard guarantees that rapid slider movements never cause out-of-order state updates.
