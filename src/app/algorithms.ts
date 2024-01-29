import { Airport, GroupedRoutesBySource, Route } from '../data';

type ShortestDistanceTable = {
	[airportId: Airport['id']]: {
		distance: number;
		hops: Route[];
	};
};

const isNewSmallestDistance = (distanceFromSource: number, currentSmallest?: number) =>
	!currentSmallest || distanceFromSource < currentSmallest;

export const dijkstra = (sourceAirport: Airport, airports: Airport[], routesBySource: GroupedRoutesBySource) => {
	const selectNextAirportToVisit = (shortestDistanceTable: ShortestDistanceTable, unvisitedAirports: Airport[]) =>
		unvisitedAirports.reduce((currentMin, airport, index) => {
			const tableEntry = shortestDistanceTable[airport.id];

			if (!tableEntry || (currentMin.distance && currentMin.distance < tableEntry.distance)) {
				return currentMin;
			}

			return { distance: tableEntry.distance, airport, index };

		}, {} as { distance: number; airport: Airport; index: number });

	const unvisitedAirports: Airport[] = [...airports];

	const shortestDistances: ShortestDistanceTable = {
		[sourceAirport.id]: {
			distance: 0,
			hops: [],
		},
	};

	while (true) {
		const {
			distance,
			airport: currentAirport,
			index: currentAirportIndex,
		} = selectNextAirportToVisit(shortestDistances, unvisitedAirports);

		if (!currentAirport) {
			break;
		}

		const currentAirportConnections = routesBySource[currentAirport.id] || [];

		for (const connection of currentAirportConnections) {
			const distanceFromSource = distance + connection.distance;
			const destinationId = connection.destination.id;
			const currentSmallestDistance = shortestDistances[destinationId]?.distance;

			if (isNewSmallestDistance(distanceFromSource, currentSmallestDistance)) {
				shortestDistances[destinationId] = {
					distance: distanceFromSource,
					hops: [...shortestDistances[currentAirport.id].hops, connection],
				};
			}
		}

		unvisitedAirports.splice(currentAirportIndex, 1);
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
	
	const shortestDistances: ShortestDistanceTable = {
		[sourceAirport.id]: {
			distance: 0,
			hops: [],
		},
	};

	const unfinishedTravels: { distance: number; location: Airport['id']; hops: Route[] }[] = [
		{ distance: 0, location: sourceAirport.id, hops: [] },
	];

	while (unfinishedTravels.length > 0) {
		const travelToExtend = unfinishedTravels.pop();
		const connectionsFromTravelEnd = routesBySource[travelToExtend.location];

		if (!connectionsFromTravelEnd) {
			continue;
		}

		for (const connection of connectionsFromTravelEnd) {
			const destinationId = connection.destination.id;
			const distanceFromSource = travelToExtend.distance + connection.distance;
			const currentSmallestDistance = shortestDistances[destinationId]?.distance;
			const hopsToConnectionEnd = [...travelToExtend.hops, connection];

			if (isNewSmallestDistance(distanceFromSource, currentSmallestDistance)) {
				shortestDistances[destinationId] = {
					distance: distanceFromSource,
					hops: hopsToConnectionEnd,
				};
			}

			const { hops: dijkstraHops, distance: dijkstraDistance } = dijkstraShortestDistance[destinationId];

			if (
				hopsToConnectionEnd.length < allowedHops &&
				(dijkstraHops.length > hopsToConnectionEnd.length || dijkstraDistance === distanceFromSource)
			) {
				unfinishedTravels.push({
					distance: distanceFromSource,
					location: destinationId,
					hops: hopsToConnectionEnd,
				});
			}
		}
	}

	return shortestDistances;
};
