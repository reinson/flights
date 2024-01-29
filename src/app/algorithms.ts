import { Airport, GroupedRoutesBySource, Route } from '../data';

type ShortestDistanceTable = {
	[airportId: Airport['id']]: {
		distance: number;
		hops: Route[];
	};
};

const selectNextAirportToVisit = (shortestDistanceTable: ShortestDistanceTable, unvisitedAirports: Airport[]) =>
	unvisitedAirports.reduce<{ distance: number; airport: Airport; index: number } | null>(
		(currentMin, airport, index) => {
			const { distance } = shortestDistanceTable[airport.id];

			if (!currentMin || currentMin.distance > distance) {
				return { distance, airport, index };
			}

			return currentMin;
		},
		null,
	);

export const dijkstra = (sourceAirport: Airport, airports: Airport[], routesBySource: GroupedRoutesBySource) => {
	const unvisitedAirports: Airport[] = [...airports];

	const shortestDistances: ShortestDistanceTable = Object.fromEntries(
		airports.map((a) => [a.id, { distance: a.id === sourceAirport.id ? 0 : Infinity, hops: [] }]),
	);

	while (unvisitedAirports.length) {
		const {
			distance,
			airport: currentAirport,
			index: currentAirportIndex,
		} = selectNextAirportToVisit(shortestDistances, unvisitedAirports);

		unvisitedAirports.splice(currentAirportIndex, 1);

		const currentAirportConnections = routesBySource[currentAirport.id] || [];

		for (const connection of currentAirportConnections) {
			const distanceFromSource = distance + connection.distance;
			const destinationId = connection.destination.id;
			const currentSmallestDistance = shortestDistances[destinationId]?.distance;

			if (distanceFromSource < currentSmallestDistance) {
				shortestDistances[destinationId] = {
					distance: distanceFromSource,
					hops: [...shortestDistances[currentAirport.id].hops, connection],
				};
			}
		}
	}

	return shortestDistances;
};

export const findShortestDistances = (
	sourceAirport: Airport,
	allowedHops: number,
	routesBySource: GroupedRoutesBySource,
	airports: Airport[],
) => {
	const dijkstraShortestDistance = dijkstra(sourceAirport, airports, routesBySource);

	const shortestDistances: ShortestDistanceTable = Object.fromEntries(
		airports.map((a) => [a.id, { distance: a.id === sourceAirport.id ? 0 : Infinity, hops: [] }]),
	);

	const unfinishedTravels: { distance: number; location: Airport['id']; hops: Route[] }[] = [
		{ distance: 0, location: sourceAirport.id, hops: [] },
	];

	while (unfinishedTravels.length > 0) {
		const travelToExtend = unfinishedTravels.pop();
		const connectionsFromTravelEnd = routesBySource[travelToExtend.location] || [];

		for (const connection of connectionsFromTravelEnd) {
			const destinationId = connection.destination.id;
			const distanceFromSource = travelToExtend.distance + connection.distance;
			const currentSmallestDistance = shortestDistances[destinationId]?.distance;
			const newHops = [...travelToExtend.hops, connection];

			if (distanceFromSource < currentSmallestDistance) {
				shortestDistances[destinationId] = {
					distance: distanceFromSource,
					hops: newHops,
				};
			}

			const { hops: dijkstraHops, distance: dijkstraDistance } = dijkstraShortestDistance[destinationId];

			// continue this travel if the limit of allowed hops is not met yet
			// and it is possible to get to destination with fewer hops compared to dijkstra or this is the dijkstra path
			if (
				newHops.length < allowedHops &&
				(dijkstraHops.length > newHops.length || dijkstraDistance === distanceFromSource)
			) {
				unfinishedTravels.push({
					distance: distanceFromSource,
					location: destinationId,
					hops: newHops,
				});
			}
		}
	}

	return shortestDistances;
};
