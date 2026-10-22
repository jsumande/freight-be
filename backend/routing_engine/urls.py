from django.urls import path
from routing_engine.views import HealthCheckView, RouteCalculationView, ForecastTimelineView

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health_check"),
    path("routes/calculate/", RouteCalculationView.as_view(), name="route_calculate"),
    path("routes/forecast-timeline/", ForecastTimelineView.as_view(), name="forecast_timeline"),
]
