from django.contrib import admin
from django.urls import path, include
from django.views.generic import RedirectView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Default landing page redirects directly to Swagger UI
    path("", RedirectView.as_view(url="/api/docs/", permanent=False), name="index-to-swagger"),

    path("admin/", admin.site.urls),
    path("api/", include("routing_engine.urls")),

    # OpenAPI Schema & Swagger Documentation Endpoints
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
