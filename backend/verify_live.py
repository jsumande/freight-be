from datetime import datetime, timezone
import json
from routing_engine.services.orchestrator import RouteEvaluationOrchestrator

def main():
    print("Testing live geocoding, OSRM routing, and Open-Meteo weather...")
    orchestrator = RouteEvaluationOrchestrator()
    res = orchestrator.evaluate_routes(
        origin_query="Chicago, IL",
        destination_query="Milwaukee, WI",
        departure_time=datetime.now(timezone.utc),
        cargo_weight_lbs=35000,
        checkpoint_interval_miles=25,
    )
    print(f"Status: {res['provider_status']['message']}")
    print(f"Total routes evaluated: {len(res['routes'])}")
    for r in res['routes']:
        print(f" - {r['name']}: {r['distance_miles']} mi, {r['duration_formatted']}, Safe: {r['metrics']['is_safe']}, Rank: {r['rank']}")
        print(f"   Checkpoints count: {len(r['checkpoints'])}")
        for cp in r['checkpoints']:
            print(f"     CP {cp['index']} ({cp['cumulative_miles']} mi): Temp {cp['weather']['temperature_f']}F, Wind {cp['weather']['wind_speed_mph']} mph, Rain {cp['weather']['rainfall_in_hr']} in/hr -> Risk: {cp['risk']['overall_risk']}")
    print("Recommendation:", json.dumps(res['recommendation'], indent=2))

if __name__ == "__main__":
    main()
